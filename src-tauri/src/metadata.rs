//! Tag reading/writing with `lofty` (the same crate the importer reads tags with).
//! 2.2.0: full tag set (title, artist, album, album artist, year, genre, composer, lyrics, comment) and embedded
//! cover art, resized/re-encoded to stay under ~500 KB so files don't balloon.
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::tag::{ItemKey, Tag};
use serde::{Deserialize, Serialize};

/// `None` = leave the field as it is; `Some("")` = clear it; `Some(text)` = write it.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MetadataPatch {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    /// 0 clears the year
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub composer: Option<String>,
    pub comment: Option<String>,
    pub lyrics: Option<String>,
    /// Image file chosen in the picker; embedded as the front cover.
    pub cover_path: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FullTags {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: String,
    pub year: Option<u32>,
    pub genre: String,
    pub composer: String,
    pub comment: String,
    pub lyrics: String,
}

fn text(tag: &Tag, key: &ItemKey) -> String {
    tag.get_string(key).unwrap_or("").to_string()
}

fn set_or_clear(tag: &mut Tag, key: ItemKey, value: &str) {
    let v = value.trim();
    if v.is_empty() {
        tag.remove_key(&key);
    } else {
        tag.insert_text(key, v.to_string());
    }
}

/// Resizes to <= 1200px and lowers JPEG quality until the result is under ~500 KB.
fn encode_cover(path: &str) -> Result<Vec<u8>, String> {
    let img = image::open(path).map_err(|e| format!("Couldn't read that image: {e}"))?;
    let img = if img.width().max(img.height()) > 1200 { img.resize(1200, 1200, image::imageops::FilterType::Lanczos3) } else { img };
    let rgb = image::DynamicImage::ImageRgb8(img.to_rgb8());
    let mut quality = 90u8;
    loop {
        let mut buf: Vec<u8> = Vec::new();
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, quality);
        rgb.write_with_encoder(encoder).map_err(|e| format!("Couldn't encode the cover: {e}"))?;
        if buf.len() <= 500 * 1024 || quality <= 40 {
            return Ok(buf);
        }
        quality -= 10;
    }
}

fn apply(tag: &mut Tag, patch: &MetadataPatch) -> Result<(), String> {
    if let Some(v) = &patch.title { if v.trim().is_empty() { tag.remove_title(); } else { tag.set_title(v.trim().to_string()); } }
    if let Some(v) = &patch.artist { if v.trim().is_empty() { tag.remove_artist(); } else { tag.set_artist(v.trim().to_string()); } }
    if let Some(v) = &patch.album { if v.trim().is_empty() { tag.remove_album(); } else { tag.set_album(v.trim().to_string()); } }
    if let Some(v) = &patch.genre { if v.trim().is_empty() { tag.remove_genre(); } else { tag.set_genre(v.trim().to_string()); } }
    if let Some(v) = &patch.comment { if v.trim().is_empty() { tag.remove_comment(); } else { tag.set_comment(v.trim().to_string()); } }
    if let Some(v) = &patch.album_artist { set_or_clear(tag, ItemKey::AlbumArtist, v); }
    if let Some(v) = &patch.composer { set_or_clear(tag, ItemKey::Composer, v); }
    if let Some(v) = &patch.lyrics { set_or_clear(tag, ItemKey::Lyrics, v); }
    if let Some(y) = patch.year { if y == 0 { tag.remove_year(); } else { tag.set_year(y); } }
    if let Some(cover) = &patch.cover_path {
        if !cover.trim().is_empty() {
            let data = encode_cover(cover)?;
            tag.remove_picture_type(PictureType::CoverFront);
            // tag.push_picture(Picture::unchecked(data).pic_type(PictureType::CoverFront).mime_type(MimeType::Jpeg).build());
            // tag.push_picture(Picture::new_unchecked(PictureType::CoverFront, Some(MimeType::Jpeg), None, data));
            // Description must be Some(""), not None: with ID3v2.3 (UTF-16) lofty writes a bare 0x00 for None, which can't be read back.
            tag.push_picture(Picture::new_unchecked(PictureType::CoverFront, Some(MimeType::Jpeg), Some(String::new()), data));
        }
    }
    Ok(())
}

/// Android (scoped storage): the app may READ a song in Downloads/Music but not open it for writing by path (EACCES, os error 13).
/// The JS side asks MediaStore for a write grant (StorageBridge.kt) and passes the resulting file descriptor here. The descriptor
/// is only accepted when /proc/self/fd/<fd> points at the same shared-storage file name as `path`, so it can't be used to touch
/// any other file the process has open.
#[cfg(unix)]
fn adopt_granted_fd(fd: i32, path: &str) -> Result<std::fs::File, String> {
    use std::os::unix::io::FromRawFd;
    let link = std::fs::read_link(format!("/proc/self/fd/{fd}"))
        .map_err(|_| "Android returned an invalid file handle for this song.".to_string())?;
    let same_name = link.file_name().is_some()
        && link.file_name() == std::path::Path::new(path).file_name();
    let shared = link.starts_with("/storage") || link.starts_with("/mnt");
    if !same_name || !shared {
        return Err("Android returned a file handle for a different file; nothing was changed.".to_string());
    }
    // SAFETY: `fd` was detached from a ParcelFileDescriptor by the Android bridge and verified above; File now owns (and closes) it.
    Ok(unsafe { std::fs::File::from_raw_fd(fd) })
}

#[cfg(not(unix))]
fn adopt_granted_fd(_fd: i32, _path: &str) -> Result<std::fs::File, String> {
    Err("Granted file handles are only used on Android.".to_string())
}

/// Puts the backup back: through the granted descriptor when there is one, otherwise by path.
fn put_back(backup: &std::path::Path, path: &str, granted: Option<&mut std::fs::File>) -> bool {
    use std::io::{Seek, SeekFrom};
    match granted {
        Some(f) => match std::fs::File::open(backup) {
            Ok(mut src) => {
                f.seek(SeekFrom::Start(0)).is_ok()
                    && f.set_len(0).is_ok()
                    && std::io::copy(&mut src, f).is_ok()
            }
            Err(_) => false,
        },
        None => std::fs::copy(backup, path).is_ok(),
    }
}

#[tauri::command]
// pub async fn write_metadata(path: String, patch: MetadataPatch) -> Result<(), String> {
pub async fn write_metadata(path: String, patch: MetadataPatch, fd: Option<i32>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tagged = lofty::read_from_path(&path).map_err(|e| format!("Couldn't read this file's tags: {e}"))?;

        // Files with no tag yet (common for fresh MP3s) get one of the format's native type (ID3v2 for MP3).
        if tagged.primary_tag_mut().is_none() {
            let tag_type = tagged.primary_tag_type();
            tagged.insert_tag(Tag::new(tag_type));
        }
        let tag = tagged.primary_tag_mut().ok_or_else(|| "This file format doesn't support tags.".to_string())?;
        apply(tag, &patch)?;

        // 3.0.0 (FEAT-09) safe write: back the file up, write, RE-READ it to prove it still parses and has the same
        // duration, and put the original back if anything looks wrong. A failed edit can never leave a damaged song behind.
        let original_secs = tagged.properties().duration().as_secs_f64();
        let mut granted = match fd {
            Some(n) => Some(adopt_granted_fd(n, &path)?),
            None => None,
        };
        let backup = std::env::temp_dir().join(format!("blackmusic-tagbackup-{}-{}.bak", std::process::id(), path.len() ^ (original_secs as usize)));
        std::fs::copy(&path, &backup).map_err(|e| format!("Couldn't make a safety backup, so nothing was changed: {e}"))?;
        /*let restore = |why: String| -> String {
            let restored = std::fs::copy(&backup, &path).is_ok();
            let _ = std::fs::remove_file(&backup);
            if restored { format!("{why} The original file was restored untouched.") } else { format!("{why} Restoring the original failed — a copy is kept at {}.", backup.display()) }
        };*/
        let restore = |why: String, granted: Option<&mut std::fs::File>| -> String {
            let restored = put_back(&backup, &path, granted);
            let _ = std::fs::remove_file(&backup);
            if restored {
                format!("{why} The original file was restored untouched.")
            } else {
                format!("{why} Restoring the original failed — a copy is kept at {}.", backup.display())
            }
        };

        // ID3v2.3 for MP3: the version Windows Explorer and older players read most reliably.
        // The audio stream is never rewritten — only the tag block.
        let opts = WriteOptions::new().use_id3v23(true);
        let saved = match granted.as_mut() {
            Some(f) => tagged.save_to(f, opts),
            None => tagged.save_to_path(&path, opts),
        };
        
        if let Err(e) = saved {
            let msg = e.to_string();
            let why = if msg.contains("os error 32") || msg.contains("being used by another process") {
                "The file is in use by another program. Pause/skip the track or close the other app, then try again.".to_string()
            } else {
                format!("Couldn't save the tags: {msg}.")
            };
            return Err(restore(why, granted.as_mut()));
        }

        match lofty::read_from_path(&path) {
            Ok(check) if (check.properties().duration().as_secs_f64() - original_secs).abs() <= 1.0 => {
                let _ = std::fs::remove_file(&backup);
                Ok(())
            }
            Ok(_) => Err(restore(
                "After saving, the audio length no longer matched.".to_string(),
                granted.as_mut(),
            )),
            Err(e) => Err(restore(
                format!("After saving, the file could not be read back ({e})."),
                granted.as_mut(),
            )),
        }

    })
    .await
    .map_err(|e| e.to_string())?
}

/// Everything the editor needs to pre-fill (and the batch editor needs to show `<various>`).
#[tauri::command]
pub async fn read_full_tags(path: String) -> Result<FullTags, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let tagged = lofty::read_from_path(&path).map_err(|e| e.to_string())?;
        let Some(t) = tagged.primary_tag().or_else(|| tagged.first_tag()) else { return Ok(FullTags::default()) };
        Ok(FullTags {
            title: t.title().map(|v| v.to_string()).unwrap_or_default(),
            artist: t.artist().map(|v| v.to_string()).unwrap_or_default(),
            album: t.album().map(|v| v.to_string()).unwrap_or_default(),
            album_artist: text(t, &ItemKey::AlbumArtist),
            year: t.year(),
            genre: t.genre().map(|v| v.to_string()).unwrap_or_default(),
            composer: text(t, &ItemKey::Composer),
            comment: t.comment().map(|v| v.to_string()).unwrap_or_default(),
            lyrics: text(t, &ItemKey::Lyrics),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
