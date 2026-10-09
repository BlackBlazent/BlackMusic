//! Tag writing with `lofty` (the same crate the importer reads tags with).
//! ExifTool can NOT write MP3 tags ("Writing of MP3 files is not yet supported"), so it isn't used any more.
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::tag::{Accessor, Tag};

fn apply(tag: &mut Tag, title: &str, artist: &str, album: &str) {
    // An empty field clears that tag instead of writing a blank value.
    if title.trim().is_empty() { tag.remove_title(); } else { tag.set_title(title.trim().to_string()); }
    if artist.trim().is_empty() { tag.remove_artist(); } else { tag.set_artist(artist.trim().to_string()); }
    if album.trim().is_empty() { tag.remove_album(); } else { tag.set_album(album.trim().to_string()); }
}

#[tauri::command]
pub async fn write_metadata(path: String, title: String, artist: String, album: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tagged = lofty::read_from_path(&path)
            .map_err(|e| format!("Couldn't read this file's tags: {e}"))?;

        // Files with no tag yet (common for fresh MP3s) get one of the format's native type (ID3v2 for MP3).
        if tagged.primary_tag_mut().is_none() {
            let tag_type = tagged.primary_tag_type();
            tagged.insert_tag(Tag::new(tag_type));
        }
        let tag = tagged
            .primary_tag_mut()
            .ok_or_else(|| "This file format doesn't support tags.".to_string())?;
        apply(tag, &title, &artist, &album);

        // ID3v2.3 for MP3: the version Windows Explorer and older players read most reliably.
        // Other formats ignore this option. Existing cover art and other tags are preserved.
        tagged
            .save_to_path(&path, WriteOptions::new().use_id3v23(true))
            .map_err(|e| {
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