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
            tag.push_picture(Picture::new_unchecked(PictureType::CoverFront, Some(MimeType::Jpeg), None, data));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn write_metadata(path: String, patch: MetadataPatch) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tagged = lofty::read_from_path(&path).map_err(|e| format!("Couldn't read this file's tags: {e}"))?;

        // Files with no tag yet (common for fresh MP3s) get one of the format's native type (ID3v2 for MP3).
        if tagged.primary_tag_mut().is_none() {
            let tag_type = tagged.primary_tag_type();
            tagged.insert_tag(Tag::new(tag_type));
        }
        let tag = tagged.primary_tag_mut().ok_or_else(|| "This file format doesn't support tags.".to_string())?;
        apply(tag, &patch)?;

        // ID3v2.3 for MP3: the version Windows Explorer and older players read most reliably.
        // The audio stream is never rewritten — only the tag block — so the audio data can't be corrupted.
        tagged.save_to_path(&path, WriteOptions::new().use_id3v23(true)).map_err(|e| {
            let msg = e.to_string();
            if msg.contains("os error 32") || msg.contains("being used by another process") {
                "The file is in use by another program. Pause/skip the track or close the other app, then try again.".to_string()
            } else {
                format!("Couldn't save the tags: {msg}")
            }
        })
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
