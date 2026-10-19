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
use lofty::tag::ItemKey;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::ipc::{Channel, Response};

/// 2.2.0: widened (was mp3/flac/wav/ogg/m4a/aac/opus/wma). Audio-only containers other players list — .m4b audiobooks,
/// .oga, .aif/.aiff, .mka, .weba, .mp2/.mpga, .amr/.3ga voice notes — were silently skipped, which is one reason a
/// Downloads folder showed fewer files than other players. Video containers (.mp4/.webm/.3gp) are deliberately NOT listed.
const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "oga", "m4a", "m4b", "aac", "opus", "wma", "aif", "aiff", "mka", "weba", "mp2", "mpga", "amr", "3ga",
];

/// A new scan clears this; `cancel_scan` sets it. Checked in the walk and in every metadata worker.
static SCAN_CANCEL: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct ScanOptions {
    /// Honour Android's `.nomedia` marker and skip hidden folders — used for auto-discovered whole-volume roots,
    /// never for a folder the user picked by hand.
    pub respect_nomedia: bool,
    /// Folder names (case-insensitive) never entered below the root, e.g. "Android", "DCIM".
    pub skip_dirs: Vec<String>,
}

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
    // 2.2.0 extended tags (Library analytics, filters, smart playlists, batch editor)
    pub album_artist: Option<String>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub composer: Option<String>,
    pub comment: Option<String>,
    /// kbps (audio bitrate) — drives the Bitrate Analyzer
    pub bitrate: Option<u32>,
    /// "Mpeg", "Flac", "Mp4", … (lofty FileType debug name)
    pub format: Option<String>,
}

impl Tags {
    pub fn empty(duration: f64) -> Tags {
        Tags { title: None, artist: None, album: None, duration, has_cover: false, album_artist: None, year: None, genre: None, composer: None, comment: None, bitrate: None, format: None }
    }
}

fn non_empty(v: Option<String>) -> Option<String> {
    v.filter(|s| !s.trim().is_empty())
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

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Unreadable {
    pub path: String,
    pub reason: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IgnoredExt {
    pub ext: String,
    pub count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub files: Vec<ScannedFile>,
    pub elapsed_ms: u128,
    /// False when the folder itself couldn't be listed (permission revoked, card removed, deleted). The caller must keep
    /// whatever it already had for this folder — an inaccessible folder is NOT an empty one.
    pub root_accessible: bool,
    pub root_error: Option<String>,
    /// Sub-folders that couldn't be read (first 20 only) and how many in total.
    pub unreadable: Vec<Unreadable>,
    pub unreadable_count: usize,
    /// Non-audio file types seen while walking (top 10) — shows "why isn't my .xyz here" without guessing.
    pub ignored: Vec<IgnoredExt>,
    pub non_utf8_skipped: usize,
    pub cancelled: bool,
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

fn io_reason(e: &std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::PermissionDenied => "permission denied".into(),
        std::io::ErrorKind::NotFound => "not found (deleted or storage removed)".into(),
        other => format!("{other:?}").to_lowercase(),
    }
}

struct Discovery {
    files: Vec<PathBuf>,
    unreadable: Vec<Unreadable>,
    unreadable_count: usize,
    ignored: HashMap<String, usize>,
    non_utf8: usize,
    root_error: Option<String>,
    cancelled: bool,
}

/// Iterative directory walk. Unlike the 2.2.0-initial version it
///   - follows symlinks (the entry's own type says "symlink", which used to be neither dir nor file → silently skipped),
///   - guards against symlink cycles via canonical paths,
///   - records unreadable folders instead of swallowing them, and tells "root can't be listed" apart from "root is empty".
fn discover(root: &str, opts: &ScanOptions, report: &dyn Fn(usize)) -> Discovery {
    let mut d = Discovery { files: Vec::new(), unreadable: Vec::new(), unreadable_count: 0, ignored: HashMap::new(), non_utf8: 0, root_error: None, cancelled: false };
    let root_path = PathBuf::from(root);
    if let Err(e) = fs::read_dir(&root_path) {
        d.root_error = Some(io_reason(&e));
        return d;
    }
    let mut visited: HashSet<PathBuf> = HashSet::new();
    let mut stack = vec![root_path.clone()];
    let mut last_report = 0usize;
    while let Some(dir) = stack.pop() {
        if SCAN_CANCEL.load(Ordering::Relaxed) {
            d.cancelled = true;
            break;
        }
        if !visited.insert(fs::canonicalize(&dir).unwrap_or_else(|_| dir.clone())) {
            continue;
        }
        if opts.respect_nomedia && dir != root_path && dir.join(".nomedia").exists() {
            continue;
        }
        let entries = match fs::read_dir(&dir) {
            Ok(e) => e,
            Err(e) => {
                d.unreadable_count += 1;
                if d.unreadable.len() < 20 {
                    d.unreadable.push(Unreadable { path: dir.to_string_lossy().to_string(), reason: io_reason(&e) });
                }
                continue;
            }
        };
        for entry in entries {
            let Ok(entry) = entry else {
                d.unreadable_count += 1;
                continue;
            };
            let path = entry.path();
            let kind = match entry.file_type() {
                Ok(k) if k.is_symlink() => fs::metadata(&path).map(|m| m.file_type()).ok(),
                Ok(k) => Some(k),
                Err(_) => None,
            };
            let Some(kind) = kind else {
                d.unreadable_count += 1; // dangling symlink / vanished mid-walk
                continue;
            };
            if kind.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if opts.respect_nomedia && name.starts_with('.') {
                    continue;
                }
                if opts.skip_dirs.iter().any(|s| s.eq_ignore_ascii_case(&name)) {
                    continue;
                }
                stack.push(path);
            } else if kind.is_file() {
                if is_audio(&path) {
                    if path.to_str().is_some() {
                        d.files.push(path);
                    } else {
                        d.non_utf8 += 1; // can't cross the IPC boundary losslessly; counted, not hidden
                    }
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    *d.ignored.entry(ext.to_ascii_lowercase()).or_insert(0) += 1;
                }
            }
        }
        if d.files.len() - last_report >= 500 {
            last_report = d.files.len();
            report(d.files.len());
        }
    }
    d
}

fn read_tags(path: &Path) -> Option<Tags> {
    let tagged = lofty::read_from_path(path).ok()?;
    let props = tagged.properties();
    let mut out = Tags::empty(props.duration().as_secs_f64());
    out.bitrate = props.audio_bitrate();
    out.format = Some(format!("{:?}", tagged.file_type()));
    if let Some(t) = tagged.primary_tag().or_else(|| tagged.first_tag()) {
        out.title = non_empty(t.title().map(|v| v.to_string()));
        out.artist = non_empty(t.artist().map(|v| v.to_string()));
        out.album = non_empty(t.album().map(|v| v.to_string()));
        out.has_cover = !t.pictures().is_empty();
        out.album_artist = non_empty(t.get_string(&ItemKey::AlbumArtist).map(|v| v.to_string()));
        out.composer = non_empty(t.get_string(&ItemKey::Composer).map(|v| v.to_string()));
        out.genre = non_empty(t.genre().map(|v| v.to_string()));
        out.comment = non_empty(t.comment().map(|v| v.to_string()));
        out.year = t.year();
    }
    Some(out)
}

#[tauri::command]
pub fn cancel_scan() {
    SCAN_CANCEL.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn scan_folder_fast(
    folder: String,
    known: Vec<KnownFile>,
    on_progress: Channel<Progress>,
    options: Option<ScanOptions>,
) -> Result<ScanResult, String> {
    let options = options.unwrap_or_default();
    SCAN_CANCEL.store(false, Ordering::SeqCst);
    // Blocking work (disk + CPU) must not sit on the async runtime.
    tauri::async_runtime::spawn_blocking(move || {
        let started = std::time::Instant::now();
        let discovery = discover(&folder, &options, &|n| {
            let _ = on_progress.send(Progress { phase: "discovering", done: n, total: 0 });
        });
        let Discovery { files: paths, unreadable, unreadable_count, ignored, non_utf8, root_error, cancelled } = discovery;
        let mut ignored: Vec<IgnoredExt> = ignored.into_iter().map(|(ext, count)| IgnoredExt { ext, count }).collect();
        ignored.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.ext.cmp(&b.ext)));
        ignored.truncate(10);

        let base = |files: Vec<ScannedFile>, cancelled: bool| ScanResult {
            files,
            elapsed_ms: started.elapsed().as_millis(),
            root_accessible: root_error.is_none(),
            root_error: root_error.clone(),
            unreadable: unreadable.clone(),
            unreadable_count,
            ignored: Vec::new(),
            non_utf8_skipped: non_utf8,
            cancelled,
        };
        if root_error.is_some() || cancelled {
            return Ok(base(Vec::new(), cancelled));
        }

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
                        if SCAN_CANCEL.load(Ordering::Relaxed) {
                            break;
                        }
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
                        let tags = if unchanged { None } else { Some(read_tags(path).unwrap_or_else(|| Tags::empty(0.0))) };
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

        let was_cancelled = SCAN_CANCEL.load(Ordering::SeqCst);
        let files: Vec<ScannedFile> = results.into_inner().unwrap().into_iter().flatten().collect();
        let _ = on_progress.send(Progress { phase: "reading", done: total, total });
        let mut result = base(files, was_cancelled);
        result.ignored = ignored;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

// ------------------------------------------------------------------------------------ storage discovery --

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageVolume {
    pub path: String,
    pub label: String,
    pub removable: bool,
    /// Whether the folder can be listed RIGHT NOW (false before the media permission is granted, or when a card is ejected).
    pub readable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageProbe {
    pub platform: &'static str,
    pub volumes: Vec<StorageVolume>,
    pub any_readable: bool,
    /// Plain-language limitation for this platform, shown next to the discovery button.
    pub note: Option<String>,
}

/// Mobile "automatic discovery": the volumes this app is allowed to look at. Android → internal storage plus every
/// removable volume mounted under /storage (SD cards, USB OTG). iOS → the app's own Documents folder only, because iOS
/// gives apps no access to other apps' files or the system music library. Desktop → nothing (folders are added by hand).
#[tauri::command]
pub fn storage_probe(app: tauri::AppHandle) -> StorageProbe {
    probe_impl(&app)
}

#[cfg(target_os = "android")]
fn probe_impl(_app: &tauri::AppHandle) -> StorageProbe {
    let mut volumes: Vec<StorageVolume> = Vec::new();
    let internal = PathBuf::from("/storage/emulated/0");
    volumes.push(StorageVolume { path: internal.to_string_lossy().to_string(), label: "Internal storage".into(), removable: false, readable: fs::read_dir(&internal).is_ok() });
    if let Ok(entries) = fs::read_dir("/storage") {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name == "emulated" || name == "self" || name.starts_with('.') {
                continue;
            }
            let path = entry.path();
            if !fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false) {
                continue;
            }
            volumes.push(StorageVolume { readable: fs::read_dir(&path).is_ok(), path: path.to_string_lossy().to_string(), label: format!("SD card / external ({name})"), removable: true });
        }
    }
    let any_readable = volumes.iter().any(|v| v.readable);
    StorageProbe {
        platform: "android",
        volumes,
        any_readable,
        note: Some("Android only lists audio your app has permission to see. If a folder looks incomplete, allow “Music and audio” access for BlackMusic in system settings, then rescan. An SD card that doesn't appear here must be added with Add folder.".into()),
    }
}

#[cfg(target_os = "ios")]
fn probe_impl(app: &tauri::AppHandle) -> StorageProbe {
    use tauri::Manager;
    let mut volumes = Vec::new();
    if let Ok(docs) = app.path().document_dir() {
        volumes.push(StorageVolume { readable: fs::read_dir(&docs).is_ok(), path: docs.to_string_lossy().to_string(), label: "BlackMusic folder (Files app)".into(), removable: false });
    }
    let any_readable = volumes.iter().any(|v| v.readable);
    StorageProbe { platform: "ios", volumes, any_readable, note: Some("iOS only lets BlackMusic read its own Documents folder (visible in the Files app) and files you pick with Add folder.".into()) }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn probe_impl(_app: &tauri::AppHandle) -> StorageProbe {
    StorageProbe { platform: "desktop", volumes: Vec::new(), any_readable: true, note: None }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn scratch(name: &str) -> PathBuf {
        let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("blackmusic-test-{name}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    fn touch(p: &Path) {
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, b"x").unwrap();
    }
    fn walk(root: &Path, opts: &ScanOptions) -> Discovery {
        discover(root.to_str().unwrap(), opts, &|_| {})
    }

    #[test]
    fn finds_nested_audio_case_insensitively_and_counts_ignored_types() {
        let root = scratch("nested");
        for f in ["a.mp3", "b.FLAC", "sub/c.m4a", "sub/deeper/d.opus", "sub/deeper/e.M4B", "x/y/z/f.wav"] {
            touch(&root.join(f));
        }
        for f in ["notes.txt", "sub/cover.jpg", "sub/cover2.jpg", "video.mp4"] {
            touch(&root.join(f));
        }
        let d = walk(&root, &ScanOptions::default());
        assert_eq!(d.files.len(), 6);
        assert!(d.root_error.is_none());
        assert_eq!(d.ignored.get("jpg"), Some(&2));
        assert_eq!(d.ignored.get("mp4"), Some(&1)); // video containers are reported, not silently dropped
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn empty_folder_is_not_an_error_but_missing_folder_is() {
        let root = scratch("empty");
        let d = walk(&root, &ScanOptions::default());
        assert!(d.root_error.is_none() && d.files.is_empty());
        let _ = fs::remove_dir_all(&root);
        let gone = walk(&root, &ScanOptions::default());
        assert!(gone.root_error.is_some(), "a deleted/unmounted folder must read as inaccessible, not empty");
    }

    #[test]
    fn rescan_sees_new_files_and_removed_files() {
        let root = scratch("rescan");
        touch(&root.join("one.mp3"));
        assert_eq!(walk(&root, &ScanOptions::default()).files.len(), 1);
        touch(&root.join("two.mp3"));
        touch(&root.join("deep/three.ogg"));
        assert_eq!(walk(&root, &ScanOptions::default()).files.len(), 3);
        fs::remove_file(root.join("one.mp3")).unwrap();
        assert_eq!(walk(&root, &ScanOptions::default()).files.len(), 2);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn nomedia_hidden_and_skip_dirs_only_apply_when_asked() {
        let root = scratch("skip");
        touch(&root.join("keep/a.mp3"));
        touch(&root.join("private/b.mp3"));
        touch(&root.join("private/.nomedia"));
        touch(&root.join(".hidden/c.mp3"));
        touch(&root.join("Android/data/d.mp3"));
        // A folder the user picked by hand: everything counts.
        assert_eq!(walk(&root, &ScanOptions::default()).files.len(), 4);
        // Auto-discovered volume root: honour .nomedia, hidden folders and the skip list.
        let auto = ScanOptions { respect_nomedia: true, skip_dirs: vec!["android".into()] };
        assert_eq!(walk(&root, &auto).files.len(), 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn follows_symlinked_folders_and_survives_cycles() {
        let root = scratch("links");
        let outside = scratch("links-outside");
        touch(&outside.join("linked.mp3"));
        touch(&root.join("real.mp3"));
        std::os::unix::fs::symlink(&outside, root.join("link-to-outside")).unwrap();
        std::os::unix::fs::symlink(&root, root.join("loop")).unwrap(); // cycle back to the root
        let d = walk(&root, &ScanOptions::default());
        assert_eq!(d.files.len(), 2, "symlinked folder is followed once, the cycle doesn't repeat files");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[cfg(unix)]
    #[test]
    fn unreadable_subfolder_is_reported_without_aborting_the_scan() {
        use std::os::unix::fs::PermissionsExt;
        let root = scratch("perm");
        touch(&root.join("ok/a.mp3"));
        touch(&root.join("locked/b.mp3"));
        fs::set_permissions(root.join("locked"), fs::Permissions::from_mode(0o000)).unwrap();
        let d = walk(&root, &ScanOptions::default());
        fs::set_permissions(root.join("locked"), fs::Permissions::from_mode(0o755)).unwrap();
        // (When tests run as root the folder is still readable — only assert what must always hold.)
        assert!(d.files.iter().any(|p| p.ends_with("a.mp3")));
        if d.unreadable_count > 0 {
            assert!(d.unreadable[0].reason.contains("permission"));
        }
        let _ = fs::remove_dir_all(&root);
    }
}
