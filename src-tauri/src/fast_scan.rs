// Fast local-library import.
//
// The old path (see src/lib/library/scanFolder.ts) reads every file's full
// bytes across the JS<->Rust IPC bridge, then parses tags in JS with
// `music-metadata`, one file at a time (even with 8-way concurrency, that's
// 8-way concurrency bottlenecked on shipping whole FLAC files — tens of MB
// each — over IPC just to read a few KB of tags). On a 17,000-track library
// that's the "~3 songs/second" problem.
//
// This does the same conceptual pipeline but natively:
//   discover paths (one fast recursive walk)
//     -> parallel tag reads across all CPU cores (rayon), never touching
//        audio sample data, only the files' tag blocks (lofty)
//     -> downscaled artwork thumbnails written to a local cache dir instead
//        of base64-encoded into the response (keeps the one JSON payload
//        back to JS small even for a huge library)
//     -> ONE return value, ONE deserialization, ONE place for the JS side to
//        do its one batched DB write + one UI update.
// Periodic (not per-file) `scan-progress` events still let the UI show real
// progress without flooding the event bridge.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use lofty::file::AudioFile;
use lofty::prelude::*;
use lofty::probe::Probe;
use rayon::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

const AUDIO_EXTENSIONS: [&str; 8] = ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma"];
const ARTWORK_MAX_DIMENSION: u32 = 320;

#[derive(Serialize, Clone)]
pub struct ScannedTrack {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    /// Absolute path to a downscaled JPEG thumbnail cached on disk, or
    /// `None` if the file had no embedded art or it couldn't be decoded.
    /// The JS side turns this into a usable URL via `convertFileSrc`.
    pub artwork_path: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct ScanProgress {
    pub scanned: usize,
    pub total: usize,
}

fn has_audio_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// The walk itself is cheap relative to tag reading — doing it single-
/// threaded, fully, before starting the expensive part means the expensive
/// part knows its total workload up front and can report real "x of y"
/// progress rather than a spinner with no sense of how much is left.
fn discover_audio_files(roots: &[String]) -> Vec<PathBuf> {
    let mut files = Vec::new();
    for root in roots {
        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() && has_audio_extension(entry.path()) {
                files.push(entry.path().to_path_buf());
            }
        }
    }
    files
}

fn fallback_title(path: &Path) -> String {
    path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

/// Content-hash-ish naming (the track's own path, not a counter) so
/// re-scanning the same file overwrites its own cached thumbnail instead of
/// piling up duplicates across repeated scans.
fn thumbnail_path_for(cache_dir: &Path, track_path: &Path) -> PathBuf {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    track_path.hash(&mut hasher);
    cache_dir.join(format!("{:x}.jpg", hasher.finish()))
}

fn save_thumbnail(cache_dir: &Path, track_path: &Path, bytes: &[u8]) -> Option<String> {
    let img = image::load_from_memory(bytes).ok()?;
    let thumb = img.thumbnail(ARTWORK_MAX_DIMENSION, ARTWORK_MAX_DIMENSION);
    let out_path = thumbnail_path_for(cache_dir, track_path);
    thumb
        .to_rgb8()
        .save_with_format(&out_path, image::ImageFormat::Jpeg)
        .ok()?;
    out_path.to_str().map(|s| s.to_string())
}

fn read_track(path: &Path, cache_dir: &Path) -> ScannedTrack {
    let path_str = path.to_string_lossy().to_string();
    let fallback = fallback_title(path);

    let tagged_file = match Probe::open(path).and_then(|p| p.read()) {
        Ok(f) => f,
        Err(_) => {
            // Unreadable tags (corrupt file, unsupported codec, permissions)
            // shouldn't drop the file from the scan — fall back to
            // filename-derived metadata, same as the old JS scanner did.
            return ScannedTrack {
                path: path_str,
                title: fallback,
                artist: "Unknown artist".into(),
                album: "Unknown album".into(),
                duration: 0.0,
                artwork_path: None,
            };
        }
    };

    let duration = tagged_file.properties().duration().as_secs_f64();
    let tag = tagged_file.primary_tag();

    let title = tag
        .and_then(|t| t.title())
        .map(|s| s.to_string())
        .unwrap_or(fallback);
    let artist = tag
        .and_then(|t| t.artist())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Unknown artist".into());
    let album = tag
        .and_then(|t| t.album())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "Unknown album".into());

    let artwork_path = tag
        .and_then(|t| t.pictures().first())
        .and_then(|pic| save_thumbnail(cache_dir, path, pic.data()));

    ScannedTrack {
        path: path_str,
        title,
        artist,
        album,
        duration,
        artwork_path,
    }
}

#[tauri::command]
pub async fn scan_music_library(app: AppHandle, folders: Vec<String>) -> Result<Vec<ScannedTrack>, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("artwork");
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    // Both the walk and the tag-reading pool are blocking/CPU work — running
    // them on a blocking thread keeps this command from tying up the async
    // runtime that handles every other Tauri IPC call while a big scan runs.
    let results: Vec<ScannedTrack> = tauri::async_runtime::spawn_blocking(move || {
        let files = discover_audio_files(&folders);
        let total = files.len();
        let scanned_count = AtomicUsize::new(0);

        // Roughly one event per 1% of progress (or every file, for small
        // libraries) — enough for a responsive progress bar without
        // flooding the event bridge the way a per-file event would on a
        // 17,000-track scan.
        let report_every = (total / 100).max(1);

        files
            .par_iter()
            .map(|path| {
                let track = read_track(path, &cache_dir);
                let count = scanned_count.fetch_add(1, Ordering::Relaxed) + 1;
                if count % report_every == 0 || count == total {
                    let _ = app.emit("scan-progress", ScanProgress { scanned: count, total });
                }
                track
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(results)
}
