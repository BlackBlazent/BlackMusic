//! OS file association support (Tauri v2): "Open with BlackMusic".
//!
//! Paths arrive three ways and all of them funnel into `dispatch`:
//!   * launch arguments (Windows / Linux: double-click a file, "Open with")            -> `paths_from_args` in setup
//!   * a SECOND launch while running (single-instance plugin hands us the new argv)    -> `paths_from_args` in the callback
//!   * the native macOS/iOS `RunEvent::Opened` event                                    -> converted to paths in `run()`
//! `dispatch` stores them and emits `files:open`; the renderer drains them with `take_pending_opens`
//! (so a file opened at cold start — before any listener exists — is never lost, and nothing is queued twice).
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Only formats the embedded media engine can play reliably (kept in sync with `bundle.fileAssociations`).
pub const MEDIA_EXTENSIONS: &[&str] = &[
    "mp3", "wav", "flac", "ogg", "opus", "m4a", "aac", "wma", // audio
    "mp4", "webm", "mkv", "mov", "m4v", // video (played as audio + optional stage video)
];

#[derive(Default)]
pub struct PendingOpen(pub Mutex<Vec<String>>);

pub fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| MEDIA_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

/// Keeps real, supported files; drops flags (`--foo`), `blackmusic://` deep links and unsupported formats.
/// Uses `PathBuf` end to end — no shell, so spaces and non-ASCII names are safe.
#[allow(dead_code)]
pub fn paths_from_args<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for arg in args {
        if arg.starts_with('-') || arg.contains("://") {
            continue;
        }
        let path = PathBuf::from(&arg);
        if path.is_file() && is_supported(&path) {
            let s = path.to_string_lossy().to_string();
            if !out.contains(&s) {
                out.push(s);
            }
        }
    }
    out
}

#[allow(dead_code)]
pub fn filter_supported(paths: Vec<String>) -> Vec<String> {
    paths.into_iter().filter(|p| is_supported(Path::new(p))).collect()
}

#[allow(dead_code)]
pub fn dispatch(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    if let Some(state) = app.try_state::<PendingOpen>() {
        let mut guard = state.0.lock().unwrap();
        for p in &paths {
            if !guard.contains(p) {
                guard.push(p.clone());
            }
        }
    }
    let _ = app.emit("files:open", paths);
}

/// The renderer calls this on start-up and whenever `files:open` fires; it returns (and clears) the queue.
#[tauri::command]
pub fn take_pending_opens(state: State<'_, PendingOpen>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}
