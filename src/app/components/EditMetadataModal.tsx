import { useState, type FormEvent } from "react";
import type { Track } from "@/lib/types";
import { writeMetadata } from "@/lib/library/metadataEditor";
import { useLibrary } from "@/app/context/LibraryContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { CloseIcon } from "@/app/layout/icons";
import "./EditMetadataModal.css";

/** Edit Metadata (#1) — shared by Library → All Music and the Playground queue strip. */
export function EditMetadataModal({ track, onClose }: { track: Track; onClose: () => void }) {
  const { updateTrack } = useLibrary();
  const { push } = useNotifications();
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist === "Unknown artist" ? "" : track.artist);
  const [album, setAlbum] = useState(track.album === "Unknown album" ? "" : track.album);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await writeMetadata(track.path, { title: title.trim(), artist: artist.trim(), album: album.trim() });
      updateTrack(track.id, {
        title: title.trim() || track.title,
        artist: artist.trim() || "Unknown artist",
        album: album.trim() || "Unknown album",
      });
      push("Metadata saved", `Updated tags for “${title.trim() || track.title}”.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-meta__backdrop" onClick={onClose}>
      <form className="edit-meta" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <div className="edit-meta__header">
          <h2>Edit metadata</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="edit-meta__path" title={track.path}>
          {track.path}
        </p>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </label>
        <label>
          Artist
          <input value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label>
          Album
          <input value={album} onChange={(e) => setAlbum(e.target.value)} />
        </label>
        {error && <p className="edit-meta__error">{error}</p>}
        <div className="edit-meta__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="edit-meta__save" disabled={saving}>
            {saving ? "Writing tags…" : "Save to file"}
          </button>
        </div>
      </form>
    </div>
  );
}
