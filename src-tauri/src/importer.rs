//! Fast library import.
//!
//!   DISCOVER FILES -> batch -> PARALLEL METADATA EXTRACTION -> one result -> ONE UI update
//!
//! The old importer did, per song: read the whole file over IPC -> parse tags in JS ->
//! decode + downscale cover art -> push to React state (~3 songs/second). Here the
//! renderer makes ONE call per folder. Rust walks the tree, stats every file, skips
//! files that haven't changed since the cached scan (path + size + mtime), reads tags
//! for the rest on every CPU core (header-only reads — no whole-file transfer, no art
//! decoding), and returns the lot at once. Cover art is loaded lazily afterwards via
//! `read_cover`, for the tracks that actually need it.

use lofty::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::ipc::{Channel, Response};

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma"];

#[derive(Deserialize)]
pub struct KnownFile {
    pub path: String,
    pub size: u64,
    pub mtime: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tags {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: f64,
    pub has_cover: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub path: String,
    pub size: u64,
    pub mtime: u64,
    /// None => unchanged since the cached scan; reuse the cached track.
    pub tags: Option<Tags>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub files: Vec<ScannedFile>,
    pub elapsed_ms: u128,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    /// "discovering" | "reading"
    pub phase: &'static str,
    pub done: usize,
    pub total: usize,
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Iterative directory walk — just `read_dir` + file type, no per-file stat yet.
fn discover(root: &str, on_progress: &Channel<Progress>) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut stack = vec![PathBuf::from(root)];
    let mut last_report = 0usize;
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let Ok(kind) = entry.file_type() else { continue };
            let path = entry.path();
            if kind.is_dir() {
                stack.push(path);
            } else if kind.is_file() && is_audio(&path) {
                found.push(path);
            }
        }
        if found.len() - last_report >= 500 {
            last_report = found.len();
            let _ = on_progress.send(Progress { phase: "discovering", done: found.len(), total: 0 });
        }
    }
    found
}

fn read_tags(path: &Path) -> Option<Tags> {
    let tagged = lofty::read_from_path(path).ok()?;
    let duration = tagged.properties().duration().as_secs_f64();
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
    Some(match tag {
        Some(t) => Tags {
            title: t.title().map(|v| v.to_string()).filter(|v| !v.trim().is_empty()),
            artist: t.artist().map(|v| v.to_string()).filter(|v| !v.trim().is_empty()),
            album: t.album().map(|v| v.to_string()).filter(|v| !v.trim().is_empty()),
            duration,
            has_cover: !t.pictures().is_empty(),
        },
        None => Tags { title: None, artist: None, album: None, duration, has_cover: false },
    })
}

#[tauri::command]
pub async fn scan_folder_fast(
    folder: String,
    known: Vec<KnownFile>,
    on_progress: Channel<Progress>,
) -> Result<ScanResult, String> {
    // Blocking work (disk + CPU) must not sit on the async runtime.
    tauri::async_runtime::spawn_blocking(move || {
        let started = std::time::Instant::now();
        let paths = discover(&folder, &on_progress);
        let total = paths.len();
        let _ = on_progress.send(Progress { phase: "reading", done: 0, total });

        let known: HashMap<String, (u64, u64)> =
            known.into_iter().map(|k| (k.path, (k.size, k.mtime))).collect();

        let workers = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).clamp(2, 16);
        let next = AtomicUsize::new(0);
        let done = AtomicUsize::new(0);
        let results: Mutex<Vec<Option<ScannedFile>>> = Mutex::new((0..total).map(|_| None).collect());

        std::thread::scope(|scope| {
            for _ in 0..workers {
                scope.spawn(|| {
                    // Each worker accumulates locally and merges in chunks: one lock per 256 files, not per file.
                    let mut local: Vec<(usize, ScannedFile)> = Vec::with_capacity(256);
                    loop {
                        let i = next.fetch_add(1, Ordering::Relaxed);
                        if i >= total {
                            break;
                        }
                        let path = &paths[i];
                        let path_str = path.to_string_lossy().to_string();
                        let meta = fs::metadata(path).ok();
                        let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                        let mtime = meta
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0);
                        let unchanged = known.get(&path_str).map(|k| *k == (size, mtime)).unwrap_or(false);
                        let tags = if unchanged { None } else { Some(read_tags(path).unwrap_or(Tags {
                            title: None, artist: None, album: None, duration: 0.0, has_cover: false,
                        })) };
                        local.push((i, ScannedFile { path: path_str, size, mtime, tags }));

                        let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                        if n % 400 == 0 {
                            let _ = on_progress.send(Progress { phase: "reading", done: n, total });
                        }
                        if local.len() >= 256 {
                            let mut guard = results.lock().unwrap();
                            for (idx, f) in local.drain(..) {
                                guard[idx] = Some(f);
                            }
                        }
                    }
                    let mut guard = results.lock().unwrap();
                    for (idx, f) in local.drain(..) {
                        guard[idx] = Some(f);
                    }
                });
            }
        });

        let files: Vec<ScannedFile> = results.into_inner().unwrap().into_iter().flatten().collect();
        let _ = on_progress.send(Progress { phase: "reading", done: total, total });
        Ok(ScanResult { files, elapsed_ms: started.elapsed().as_millis() })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Raw embedded-cover bytes for one file (the renderer downsizes it lazily). Empty if none.
#[tauri::command]
pub async fn read_cover(path: String) -> Result<Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tagged = lofty::read_from_path(&path).map_err(|e| e.to_string())?;
        let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
        let bytes = tag
            .and_then(|t| t.pictures().first().map(|p| p.data().to_vec()))
            .unwrap_or_default();
        Ok(Response::new(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}
