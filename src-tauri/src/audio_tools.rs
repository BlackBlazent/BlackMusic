//! Native audio helpers built on Symphonia (pure-Rust decoders): whisper input prep, the Audio Cutter, loudness
//! analysis for the Volume Normalizer, and mobile music-folder discovery.
use serde::Serialize;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymErr;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

pub struct Decoded {
    pub sample_rate: u32,
    pub channels: usize,
    /// Interleaved f32 samples.
    pub samples: Vec<f32>,
}

pub fn decode_file(path: &str) -> Result<Decoded, String> {
    let file = File::open(path).map_err(|e| format!("Couldn't open the file: {e}"))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(|e| format!("Unsupported or damaged audio: {e}"))?;
    let mut format = probed.format;
    let track = format.default_track().ok_or("No audio track found.")?;
    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.ok_or("Unknown sample rate.")?;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("No decoder for this format: {e}"))?;

    let mut channels = 2usize;
    let mut samples: Vec<f32> = Vec::new();
    loop {
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(SymErr::IoError(_)) | Err(SymErr::ResetRequired) => break,
            Err(e) => return Err(e.to_string()),
        };
        if packet.track_id() != track_id { continue; }
        match decoder.decode(&packet) {
            Ok(buf) => {
                let spec = *buf.spec();
                channels = spec.channels.count().max(1);
                let mut sb = SampleBuffer::<f32>::new(buf.capacity() as u64, spec);
                sb.copy_interleaved_ref(buf);
                samples.extend_from_slice(sb.samples());
            }
            Err(SymErr::DecodeError(_)) => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    if samples.is_empty() { return Err("The file contains no decodable audio.".into()); }
    Ok(Decoded { sample_rate, channels, samples })
}

fn write_wav_i16(path: &Path, sample_rate: u32, channels: u16, data: &[i16]) -> Result<(), String> {
    let mut f = File::create(path).map_err(|e| e.to_string())?;
    let data_len = (data.len() * 2) as u32;
    let byte_rate = sample_rate * channels as u32 * 2;
    let mut header: Vec<u8> = Vec::with_capacity(44);
    header.extend_from_slice(b"RIFF");
    header.extend_from_slice(&(36 + data_len).to_le_bytes());
    header.extend_from_slice(b"WAVEfmt ");
    header.extend_from_slice(&16u32.to_le_bytes());
    header.extend_from_slice(&1u16.to_le_bytes());
    header.extend_from_slice(&channels.to_le_bytes());
    header.extend_from_slice(&sample_rate.to_le_bytes());
    header.extend_from_slice(&byte_rate.to_le_bytes());
    header.extend_from_slice(&(channels * 2).to_le_bytes());
    header.extend_from_slice(&16u16.to_le_bytes());
    header.extend_from_slice(b"data");
    header.extend_from_slice(&data_len.to_le_bytes());
    f.write_all(&header).map_err(|e| e.to_string())?;
    let mut bytes: Vec<u8> = Vec::with_capacity(data.len() * 2);
    for s in data { bytes.extend_from_slice(&s.to_le_bytes()); }
    f.write_all(&bytes).map_err(|e| e.to_string())
}

fn to_i16(x: f32) -> i16 { (x.clamp(-1.0, 1.0) * 32767.0) as i16 }

/// Mono, 16 kHz, 16-bit PCM — what whisper.cpp expects.
pub fn decode_to_wav_16k(src: &str, dest: &Path) -> Result<(), String> {
    let d = decode_file(src)?;
    let mono: Vec<f32> = d.samples.chunks(d.channels).map(|f| f.iter().sum::<f32>() / d.channels as f32).collect();
    let ratio = d.sample_rate as f64 / 16000.0;
    let out_len = (mono.len() as f64 / ratio) as usize;
    let mut out: Vec<i16> = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let pos = i as f64 * ratio;
        let idx = pos as usize;
        let frac = (pos - idx as f64) as f32;
        let a = mono[idx];
        let b = *mono.get(idx + 1).unwrap_or(&a);
        out.push(to_i16(a + (b - a) * frac)); // linear resample — fine for speech recognition
    }
    write_wav_i16(dest, 16000, 1, &out)
}

/// Audio Cutter: writes [start, end) seconds as a 16-bit WAV, with short fades so the cut doesn't click.
#[tauri::command]
pub async fn export_trim(src: String, start: f64, end: f64, dest: String, fade_ms: Option<u32>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        if end <= start { return Err("The end time must be after the start time.".to_string()); }
        let d = decode_file(&src)?;
        let ch = d.channels;
        let frames = d.samples.len() / ch;
        let a = ((start.max(0.0) * d.sample_rate as f64) as usize).min(frames);
        let b = ((end * d.sample_rate as f64) as usize).min(frames);
        if b <= a { return Err("That range is outside the song.".to_string()); }
        let fade = ((fade_ms.unwrap_or(15) as f64 / 1000.0) * d.sample_rate as f64) as usize;
        let mut out: Vec<i16> = Vec::with_capacity((b - a) * ch);
        for f in a..b {
            let pos = f - a;
            let len = b - a;
            let mut g = 1.0f32;
            if fade > 0 && pos < fade { g = pos as f32 / fade as f32; }
            if fade > 0 && len - pos < fade { g = g.min((len - pos) as f32 / fade as f32); }
            for c in 0..ch { out.push(to_i16(d.samples[f * ch + c] * g)); }
        }
        write_wav_i16(Path::new(&dest), d.sample_rate, ch as u16, &out)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loudness {
    /// RMS level in dBFS (more negative = quieter)
    pub rms_db: f64,
    pub peak_db: f64,
    /// Linear gain that brings this track to `target_db` without clipping past the peak.
    pub gain: f64,
}

/// Volume Normalizer: non-destructive. The renderer applies `gain` through a Web Audio gain node.
#[tauri::command]
pub async fn analyze_loudness(path: String, target_db: Option<f64>) -> Result<Loudness, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let d = decode_file(&path)?;
        let n = d.samples.len() as f64;
        let sum_sq: f64 = d.samples.iter().map(|s| (*s as f64) * (*s as f64)).sum();
        let peak = d.samples.iter().fold(0.0f32, |m, s| m.max(s.abs())) as f64;
        let rms = (sum_sq / n).sqrt().max(1e-9);
        let rms_db = 20.0 * rms.log10();
        let peak_db = 20.0 * peak.max(1e-9).log10();
        let target = target_db.unwrap_or(-16.0);
        let mut gain = 10f64.powf((target - rms_db) / 20.0);
        let max_gain = if peak > 0.0 { 0.98 / peak } else { gain };
        if gain > max_gain { gain = max_gain; }
        Ok(Loudness { rms_db, peak_db, gain: gain.clamp(0.1, 4.0) })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Mobile "automatic discovery": the standard shared-storage music folders that exist on this device.
#[tauri::command]
pub fn default_music_dirs() -> Vec<String> {
    let mut candidates: Vec<String> = Vec::new();
    if cfg!(target_os = "android") {
        for base in ["/storage/emulated/0", "/sdcard"] {
            for sub in ["Music", "Download", "Podcasts", "Audiobooks", "Documents", "Recordings"] {
                candidates.push(format!("{base}/{sub}"));
            }
        }
    }
    let mut seen: Vec<String> = Vec::new();
    for c in candidates {
        if Path::new(&c).is_dir() && !seen.contains(&c) { seen.push(c); }
    }
    // /sdcard is a symlink to /storage/emulated/0 — keep only one spelling of each real folder.
    seen.retain(|p| !p.starts_with("/sdcard/") || !seen_contains_twin(p));
    seen
}

fn seen_contains_twin(p: &str) -> bool {
    Path::new(&p.replacen("/sdcard", "/storage/emulated/0", 1)).is_dir()
}
