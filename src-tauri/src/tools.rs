//! Bundled / importable external tools: yt-dlp, whisper.cpp (`whisper-cli`) and the whisper model manager.
//!
//! Lookup order for every tool:  user-IMPORTED (app data)  ->  BUNDLED sidecar (next to the app executable)  ->  PATH.
//! Placeholders written by scripts/fetch-sidecars.mjs (tiny files) are treated as "not bundled".
use serde::Serialize;
use serde_json::json;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const STUB_BYTES: u64 = 2048;

#[derive(Serialize)]
pub struct CmdOutput {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Serialize)]
pub struct ToolStatus {
    /// "imported" | "bundled" | "system" | "missing"
    pub source: String,
    pub path: Option<String>,
    pub version: Option<String>,
    /// Why a tool that exists on disk can't run (e.g. a missing DLL). `None` when healthy or simply absent.
    pub problem: Option<String>,
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) { format!("{base}.exe") } else { base.to_string() }
}

fn no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

fn app_dir(app: &AppHandle, sub: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join(sub);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn is_real(p: &Path) -> bool {
    fs::metadata(p).map(|m| m.is_file() && m.len() > STUB_BYTES).unwrap_or(false)
}

/// (path, source) — `source` is "imported" | "bundled" | "system".
fn locate(app: &AppHandle, tool: &str) -> (PathBuf, &'static str) {
    if let Ok(dir) = app_dir(app, "tools") {
        let p = dir.join(exe_name(tool));
        if is_real(&p) { return (p, "imported"); }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p = parent.join(exe_name(tool));
            if is_real(&p) { return (p, "bundled"); }
        }
    }
    (PathBuf::from(exe_name(tool)), "system")
}

fn run(path: &Path, args: &[String]) -> Result<CmdOutput, String> {
    let mut cmd = Command::new(path);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    no_window(&mut cmd);
    let out = cmd.output().map_err(|e| format!("Couldn't start {}: {e}", path.display()))?;
    Ok(CmdOutput {
        code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
    })
}

#[tauri::command]
pub async fn ytdlp_run(app: AppHandle, args: Vec<String>) -> Result<CmdOutput, String> {
    let (path, _) = locate(&app, "yt-dlp");
    tauri::async_runtime::spawn_blocking(move || {
        run(&path, &args).map_err(|e| format!("yt-dlp isn't available ({e}). Import it in Settings → Plugins & Tools."))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn version_arg(tool: &str) -> &'static str {
    match tool { "yt-dlp" => "--version", "ffmpeg" => "-version", _ => "--help" }
}

#[tauri::command]
pub async fn tool_status(app: AppHandle, tool: String) -> Result<ToolStatus, String> {
    let (path, source) = locate(&app, &tool);
    let libs = if tool == "whisper-cli" { whisper_lib_dirs(&app, &path) } else { Vec::new() };
    tauri::async_runtime::spawn_blocking(move || {
        let missing = |problem: Option<String>| Ok(ToolStatus { source: "missing".into(), path: None, version: None, problem });
        if tool == "whisper-cli" {
            if let Some(why) = whisper_preflight_cli(&path, &libs) { return missing(Some(why)); }
            return match run_ext(&path, &["--help".to_string()], path.parent(), &libs, None, Duration::from_secs(20)) {
                Ok(out) => {
                    let text = format!("{}{}", out.stdout, out.stderr).to_lowercase();
                    // whisper-cli prints its usage and exits 0 (older builds: 1). A loader failure prints nothing at all.
                    if out.code == 0 || text.contains("usage") {
                        Ok(ToolStatus { source: source.to_string(), path: Some(path.to_string_lossy().to_string()), version: None, problem: None })
                    } else {
                        missing(Some(describe_exit(out.code, &out.stderr, &out.stdout)))
                    }
                }
                Err(RunFail::Spawn(e)) => missing(if source == "system" { None } else { Some(e) }),
                Err(_) => missing(Some("whisper-cli did not answer in time.".into())),
            };
        }
        match run(&path, &[version_arg(&tool).to_string()]) {
            Ok(out) if out.code == 0 => {
                let first = out.stdout.lines().next().unwrap_or("").trim().to_string();
                Ok(ToolStatus { source: source.to_string(), path: Some(path.to_string_lossy().to_string()), version: if first.is_empty() { None } else { Some(first) }, problem: None })
            }
            _ => missing(None),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Copy a user-chosen executable into app data so it wins over the bundled one.
#[tauri::command]
pub fn tool_import(app: AppHandle, tool: String, source_path: String) -> Result<(), String> {
    let allowed = ["yt-dlp", "whisper-cli", "ffmpeg"];
    if !allowed.contains(&tool.as_str()) { return Err("Unknown tool.".into()); }
    let dest = app_dir(&app, "tools")?.join(exe_name(&tool));
    fs::copy(&source_path, &dest).map_err(|e| format!("Couldn't import that file: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&dest, fs::Permissions::from_mode(0o755));
    }
    Ok(())
}

#[tauri::command]
pub fn tool_reset(app: AppHandle, tool: String) -> Result<(), String> {
    let p = app_dir(&app, "tools")?.join(exe_name(&tool));
    if p.exists() { fs::remove_file(p).map_err(|e| e.to_string())?; }
    Ok(())
}

/// `yt-dlp -U` only works on a copy we can write to, so the bundled binary is first copied into app data.
#[tauri::command]
pub async fn ytdlp_update(app: AppHandle) -> Result<String, String> {
    let dir = app_dir(&app, "tools")?;
    let target = dir.join(exe_name("yt-dlp"));
    if !is_real(&target) {
        let (src, source) = locate(&app, "yt-dlp");
        if source != "bundled" { return Err("Nothing to update — import a yt-dlp executable first, or use a build that bundles it.".into()); }
        fs::copy(&src, &target).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&target, fs::Permissions::from_mode(0o755));
        }
    }
    tauri::async_runtime::spawn_blocking(move || {
        let out = run(&target, &["-U".to_string()])?;
        let text = format!("{}{}", out.stdout, out.stderr).trim().to_string();
        if out.code == 0 { Ok(text) } else { Err(text) }
    })
    .await
    .map_err(|e| e.to_string())?
}

// ------------------------------------------------------------------------------------ whisper models --

#[derive(Serialize)]
pub struct ModelInfo {
    pub id: String,
    pub file: String,
    pub approx_mb: u32,
    pub installed: bool,
    pub bundled: bool,
    pub english_only: bool,
}

const MODELS: &[(&str, u32)] = &[
    ("tiny", 75), ("tiny.en", 75), ("base", 142), ("base.en", 142), ("small", 466), ("small.en", 466),
    ("medium", 1500), ("medium.en", 1500), ("large-v1", 2900), ("large-v2", 2900), ("large-v3", 2900), ("large-v3-turbo", 1600),
];

fn model_file(id: &str) -> String { format!("ggml-{id}.bin") }

fn bundled_model(app: &AppHandle, id: &str) -> Option<PathBuf> {
    let res = app.path().resource_dir().ok()?;
    [res.join("resources").join("models").join(model_file(id)), res.join("models").join(model_file(id))]
        .into_iter()
        .find(|p| is_real(p))
}

fn model_path(app: &AppHandle, id: &str) -> Option<PathBuf> {
    if let Ok(dir) = app_dir(app, "models") {
        let p = dir.join(model_file(id));
        if is_real(&p) { return Some(p); }
    }
    bundled_model(app, id)
}

#[tauri::command]
pub fn whisper_list_models(app: AppHandle) -> Result<Vec<ModelInfo>, String> {
    Ok(MODELS
        .iter()
        .map(|(id, mb)| ModelInfo {
            id: id.to_string(),
            file: model_file(id),
            approx_mb: *mb,
            installed: model_path(&app, id).is_some(),
            bundled: bundled_model(&app, id).is_some(),
            english_only: id.ends_with(".en"),
        })
        .collect())
}

/// Streams the model from Hugging Face (ggerganov/whisper.cpp), emitting `whisper:progress` events.
#[tauri::command]
pub async fn whisper_download_model(app: AppHandle, id: String) -> Result<(), String> {
    use futures_util::StreamExt;
    if !MODELS.iter().any(|(m, _)| *m == id) { return Err("Unknown model.".into()); }
    let dir = app_dir(&app, "models")?;
    let final_path = dir.join(model_file(&id));
    let part_path = dir.join(format!("{}.part", model_file(&id)));
    let url = format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}", model_file(&id));

    let response = reqwest::get(&url).await.map_err(|e| format!("Download failed: {e}"))?;
    if !response.status().is_success() { return Err(format!("Hugging Face answered {}.", response.status())); }
    let total = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(&part_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    let mut done: u64 = 0;
    let mut last_emit: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| { let _ = fs::remove_file(&part_path); format!("Download interrupted: {e}") })?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        if done - last_emit > 512 * 1024 {
            last_emit = done;
            let _ = app.emit("whisper:progress", json!({ "id": id, "downloaded": done, "total": total }));
        }
    }
    drop(file);
    fs::rename(&part_path, &final_path).map_err(|e| e.to_string())?;
    let _ = app.emit("whisper:progress", json!({ "id": id, "downloaded": done, "total": total, "done": true }));
    Ok(())
}

/// For when a download fails: import a `ggml-*.bin` the user fetched themselves.
#[tauri::command]
pub fn whisper_import_model(app: AppHandle, source_path: String) -> Result<String, String> {
    let name = Path::new(&source_path).file_name().and_then(|n| n.to_str()).ok_or("Bad path.")?.to_string();
    if !(name.starts_with("ggml-") && name.ends_with(".bin")) {
        return Err("Pick a whisper.cpp model file named like ggml-tiny.bin.".into());
    }
    let dest = app_dir(&app, "models")?.join(&name);
    fs::copy(&source_path, &dest).map_err(|e| e.to_string())?;
    Ok(name.trim_start_matches("ggml-").trim_end_matches(".bin").to_string())
}

#[tauri::command]
pub fn whisper_delete_model(app: AppHandle, id: String) -> Result<(), String> {
    let p = app_dir(&app, "models")?.join(model_file(&id));
    if p.exists() { fs::remove_file(p).map_err(|e| e.to_string())?; }
    Ok(())
}

#[derive(Serialize)]
pub struct Segment {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

// ------------------------------------------------------------------------------- whisper execution --

/// Only one transcription at a time (the model is hundreds of MB of RAM; a second click must not start a second run).
static WHISPER_BUSY: AtomicBool = AtomicBool::new(false);
static WHISPER_CANCEL: AtomicBool = AtomicBool::new(false);
const WHISPER_TIMEOUT: Duration = Duration::from_secs(45 * 60);

struct BusyGuard;
impl BusyGuard {
    fn acquire() -> Option<BusyGuard> {
        WHISPER_BUSY.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).ok().map(|_| {
            WHISPER_CANCEL.store(false, Ordering::SeqCst);
            BusyGuard
        })
    }
}
impl Drop for BusyGuard {
    fn drop(&mut self) { WHISPER_BUSY.store(false, Ordering::SeqCst); }
}

enum RunFail {
    Spawn(String),
    Cancelled,
    TimedOut,
}

/// Like `run`, but with a working directory, extra PATH entries (for DLL lookup), a timeout and cancellation.
fn run_ext(path: &Path, args: &[String], cwd: Option<&Path>, extra_path: &[PathBuf], cancel: Option<&AtomicBool>, timeout: Duration) -> Result<CmdOutput, RunFail> {
    let mut cmd = Command::new(path);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd { cmd.current_dir(dir); }
    if !extra_path.is_empty() {
        let existing = std::env::var_os("PATH").unwrap_or_default();
        if let Ok(joined) = std::env::join_paths(extra_path.iter().cloned().chain(std::env::split_paths(&existing))) {
            cmd.env("PATH", joined);
        }
    }
    no_window(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| RunFail::Spawn(format!("{}: {e}", path.display())))?;
    let mut out_pipe = child.stdout.take();
    let mut err_pipe = child.stderr.take();
    let t_out = std::thread::spawn(move || { let mut b = Vec::new(); if let Some(p) = out_pipe.as_mut() { let _ = p.read_to_end(&mut b); } b });
    let t_err = std::thread::spawn(move || { let mut b = Vec::new(); if let Some(p) = err_pipe.as_mut() { let _ = p.read_to_end(&mut b); } b });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if cancel.map(|c| c.load(Ordering::SeqCst)).unwrap_or(false) {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(RunFail::Cancelled);
                }
                if started.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(RunFail::TimedOut);
                }
                std::thread::sleep(Duration::from_millis(120));
            }
            Err(e) => return Err(RunFail::Spawn(e.to_string())),
        }
    };
    Ok(CmdOutput {
        code: status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&t_out.join().unwrap_or_default()).to_string(),
        stderr: String::from_utf8_lossy(&t_err.join().unwrap_or_default()).to_string(),
    })
}

/// Directories searched for whisper's companion DLLs / shared libraries. A *shared* whisper.cpp build (the official
/// Windows zip) cannot start without them, and Tauri only copies the sidecar .exe — never its DLLs — next to the app.
fn whisper_lib_dirs(app: &AppHandle, cli: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    let mut push = |p: PathBuf| { if p.is_dir() && !dirs.contains(&p) { dirs.push(p); } };
    if let Some(parent) = cli.parent() { push(parent.to_path_buf()); }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() { push(parent.to_path_buf()); push(parent.join("whisper-libs")); }
    }
    if let Ok(res) = app.path().resource_dir() {
        for sub in ["whisper-libs", "resources/whisper-libs", "binaries", "resources/binaries"] { push(res.join(sub)); }
    }
    if let Ok(dir) = app_dir(app, "tools") { push(dir); }
    // `tauri dev` runs straight from the repo, where the loose DLLs sit in src-tauri/binaries.
    #[cfg(debug_assertions)]
    push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries"));
    dirs
}

/// A shared (DLL) build of whisper-cli is ~0.5 MB; a static build is several MB. Catch "DLL build without its DLLs" up front.
fn whisper_preflight_cli(cli: &Path, libs: &[PathBuf]) -> Option<String> {
    if !is_real(cli) {
        return Some("whisper-cli isn't bundled in this build. Import it in Settings → Plugins & Tools, or run `pnpm sidecars:whisper`.".into());
    }
    if cfg!(windows) {
        let size = fs::metadata(cli).map(|m| m.len()).unwrap_or(0);
        let has_whisper_dll = libs.iter().any(|d| is_real(&d.join("whisper.dll")));
        if size < 1_500_000 && !has_whisper_dll {
            return Some("This whisper-cli is a shared build that needs whisper.dll and ggml*.dll next to it, and they weren't found. Use a static build (`pnpm sidecars:whisper`) or keep the DLLs with the app.".into());
        }
    }
    None
}

/// Strip anything that identifies the machine/user from text we hand to the UI.
fn sanitize(app: &AppHandle, text: &str) -> String {
    let mut t = text.to_string();
    for p in [app.path().home_dir().ok(), app.path().app_data_dir().ok()].into_iter().flatten() {
        let needle = p.to_string_lossy().to_string();
        if !needle.is_empty() { t = t.replace(&needle, "…"); }
    }
    t.chars().take(300).collect()
}

/// Turn "process died with code N" into something a person can act on. `unknown error` is never produced.
fn describe_exit(code: i32, stderr: &str, stdout: &str) -> String {
    let tail = |s: &str| s.lines().map(str::trim).filter(|l| !l.is_empty()).rev().take(2).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join(" · ");
    let detail = { let e = tail(stderr); if e.is_empty() { tail(stdout) } else { e } };
    let hex = format!("0x{:08X}", code as u32);
    let known = match code as u32 {
        0xC000_0135 => Some("whisper-cli couldn't start because a required DLL (whisper.dll / ggml*.dll) is missing. Use a static build (`pnpm sidecars:whisper`) or keep the DLLs with the app."),
        0xC000_007B => Some("whisper-cli couldn't start: it (or one of its DLLs) is built for a different CPU architecture."),
        0xC000_0139 | 0xC000_0142 => Some("whisper-cli couldn't start: a bundled DLL is the wrong version."),
        0xC000_001D => Some("whisper-cli crashed: this CPU lacks an instruction the binary was built for. Import a build compiled for your CPU."),
        0xC000_0005 | 0xC000_0409 => Some("whisper-cli crashed while running — the model file may be damaged. Delete and re-download it in Settings → Plugins & Tools."),
        _ => None,
    };
    match (known, detail.is_empty()) {
        (Some(k), true) => format!("{k} (exit {hex})"),
        (Some(k), false) => format!("{k} (exit {hex}) — {detail}"),
        (None, false) => format!("whisper-cli exited with code {code} — {detail}"),
        (None, true) if code < 0 => format!("whisper-cli was stopped by the system before finishing (exit {code}). It may have run out of memory — try a smaller model."),
        (None, true) => format!("whisper-cli exited with code {code} and printed nothing. Run it from a terminal to see why."),
    }
}

/// ggml models start with the magic "ggml" (little-endian "lmgg"); newer ones with "GGUF".
fn model_looks_valid(p: &Path) -> bool {
    let mut magic = [0u8; 4];
    fs::File::open(p).and_then(|mut f| f.read_exact(&mut magic)).is_ok() && (&magic == b"lmgg" || &magic == b"ggml" || &magic == b"GGUF")
}

#[tauri::command]
pub fn whisper_cancel() {
    WHISPER_CANCEL.store(true, Ordering::SeqCst);
}

/// Speech-to-text for lyrics/captions. Audio is decoded + resampled to 16 kHz mono WAV in Rust first, so any format
/// the app plays (mp3, flac, m4a, aac, ogg, wav) works; `translate` asks whisper to translate to English (offline).
/// Desktop only — there is no whisper-cli for Android/iOS, and we say so instead of failing obscurely.
#[tauri::command]
pub async fn whisper_transcribe(app: AppHandle, audio_path: String, model_id: String, language: Option<String>, translate: bool) -> Result<Vec<Segment>, String> {
    if cfg!(any(target_os = "android", target_os = "ios")) {
        return Err("Transcription runs on the desktop app. whisper.cpp has no Android/iOS build in BlackMusic yet.".into());
    }
    let guard = BusyGuard::acquire().ok_or("A transcription is already running — wait for it to finish or cancel it.")?;

    // ---- preflight: every failure here names exactly what is wrong ----
    if !Path::new(&audio_path).is_file() {
        return Err("The audio file couldn't be found. It may have been moved, renamed or sit on a disconnected drive.".into());
    }
    let model = model_path(&app, &model_id).ok_or_else(|| format!("The “{model_id}” model isn't installed. Download or import it in Settings → Plugins & Tools."))?;
    if !model_looks_valid(&model) {
        return Err(format!("The “{model_id}” model file is damaged or isn't a whisper.cpp model. Delete it and download it again in Settings → Plugins & Tools."));
    }
    let (cli, _) = locate(&app, "whisper-cli");
    let libs = whisper_lib_dirs(&app, &cli);
    if let Some(why) = whisper_preflight_cli(&cli, &libs) { return Err(why); }
    // Each run gets its own scratch folder (no clash with another run, nothing stale to read back), always cleaned up.
    let job = app_dir(&app, "tmp")?.join(format!("whisper-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)));
    fs::create_dir_all(&job).map_err(|e| format!("Couldn't create a scratch folder for transcription: {e}"))?;

    let app2 = app.clone();
    let job2 = job.clone();
    let result = tauri::async_runtime::spawn_blocking(move || -> Result<Vec<Segment>, String> {
        let _guard = guard; // held until the work finishes, even if the UI navigates away
        let wav = job2.join("input.wav");
        crate::audio_tools::decode_to_wav_16k(&audio_path, &wav).map_err(|e| format!("Couldn't read this audio file ({e}). The format may be unsupported or the file corrupt."))?;
        let out_base = job2.join("out");

        let mut args: Vec<String> = vec![
            "-m".into(), model.to_string_lossy().to_string(),
            "-f".into(), wav.to_string_lossy().to_string(),
            "-oj".into(), "-of".into(), out_base.to_string_lossy().to_string(), "-np".into(),
            "-l".into(), language.filter(|l| !l.is_empty()).unwrap_or_else(|| "auto".into()),
        ];
        if translate { args.push("-tr".into()); }

        let out = match run_ext(&cli, &args, cli.parent(), &libs, Some(&WHISPER_CANCEL), WHISPER_TIMEOUT) {
            Ok(o) => o,
            Err(RunFail::Cancelled) => return Err("Transcription was cancelled.".into()),
            Err(RunFail::TimedOut) => return Err("Transcription took longer than 45 minutes and was stopped. Try a smaller model.".into()),
            Err(RunFail::Spawn(e)) => return Err(format!("whisper-cli couldn't be started ({}). Import it in Settings → Plugins & Tools.", sanitize(&app2, &e))),
        };
        #[cfg(debug_assertions)]
        eprintln!("[whisper] exit={} stdout={:?} stderr={:?}", out.code, out.stdout.chars().take(600).collect::<String>(), out.stderr.chars().take(600).collect::<String>());
        if out.code != 0 { return Err(sanitize(&app2, &describe_exit(out.code, &out.stderr, &out.stdout))); }

        let json_path = job2.join("out.json");
        let raw = fs::read_to_string(&json_path).map_err(|_| "whisper-cli finished but wrote no transcript. The audio may be silent or too short.".to_string())?;
        let json: serde_json::Value = serde_json::from_str(&raw).map_err(|_| "whisper-cli wrote a transcript that couldn't be read.".to_string())?;
        let segments: Vec<Segment> = json["transcription"].as_array().cloned().unwrap_or_default()
            .iter()
            .filter_map(|s| {
                let text = s["text"].as_str()?.trim().to_string();
                if text.is_empty() { return None; }
                Some(Segment {
                    start: s["offsets"]["from"].as_f64().unwrap_or(0.0) / 1000.0,
                    end: s["offsets"]["to"].as_f64().unwrap_or(0.0) / 1000.0,
                    text,
                })
            })
            .collect();
        // Never hand back an empty transcript as if it were a success — callers would save blank lyrics.
        if segments.is_empty() { return Err("No speech was detected in this track.".into()); }
        Ok(segments)
    })
    .await
    .map_err(|e| format!("Transcription task failed: {e}"));
    let _ = fs::remove_dir_all(&job);
    result?
}

/// ffmpeg is NOT bundled (size/licensing); the Format Converter uses it when present on PATH or imported.
#[tauri::command]
pub async fn ffmpeg_run(app: AppHandle, args: Vec<String>) -> Result<CmdOutput, String> {
    let (path, _) = locate(&app, "ffmpeg");
    tauri::async_runtime::spawn_blocking(move || run(&path, &args).map_err(|_| "ffmpeg isn't installed. Import it in Settings → Plugins & Tools, or install it on your PATH.".to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_dll_exit_code_is_explained_not_unknown() {
        // STATUS_DLL_NOT_FOUND with empty stderr/stdout was the original "whisper-cli failed: unknown error".
        let msg = describe_exit(0xC000_0135u32 as i32, "", "");
        assert!(msg.contains("DLL"), "{msg}");
        assert!(!msg.to_lowercase().contains("unknown error"));
    }

    #[test]
    fn other_failures_always_say_something_actionable() {
        assert!(describe_exit(0xC000_007Bu32 as i32, "", "").contains("architecture"));
        assert!(describe_exit(3, "", "").contains("exited with code 3"));
        assert!(describe_exit(2, "error: failed to load model", "").contains("failed to load model"));
        assert!(describe_exit(-1, "", "").contains("stopped by the system"));
        // stderr wins over stdout, and only the last lines are kept.
        let msg = describe_exit(1, "a\nb\nc\nd", "ignored");
        assert!(msg.contains("c · d") && !msg.contains("ignored"), "{msg}");
    }

    #[test]
    fn model_magic_is_checked() {
        let dir = std::env::temp_dir().join(format!("bm-model-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let good = dir.join("ggml-tiny.bin");
        fs::write(&good, b"lmggrest-of-model").unwrap();
        let bad = dir.join("ggml-bad.bin");
        fs::write(&bad, b"<html>404</html>").unwrap(); // what a failed download page looks like
        assert!(model_looks_valid(&good));
        assert!(!model_looks_valid(&bad));
        assert!(!model_looks_valid(&dir.join("missing.bin")));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn shared_whisper_build_without_dlls_is_caught_before_running() {
        let dir = std::env::temp_dir().join(format!("bm-cli-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let cli = dir.join(exe_name("whisper-cli"));
        fs::write(&cli, vec![0u8; 480_000]).unwrap(); // the size of the shared-DLL whisper-cli.exe from the report
        let why = whisper_preflight_cli(&cli, &[dir.clone()]);
        if cfg!(windows) {
            assert!(why.unwrap().contains("whisper.dll"));
        } else {
            assert!(why.is_none());
        }
        let _ = fs::remove_dir_all(&dir);
    }
}
