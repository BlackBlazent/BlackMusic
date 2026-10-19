import { useEffect, useState, type FormEvent } from "react";
import type { Track } from "@/lib/types";
import { readFullTags, writeMetadata, type FullTags } from "@/lib/library/metadataEditor";
import { downloadToTemp, pickImageFile, previewSrc } from "@/lib/library/coverArt";
import { mbCoverCandidates, mbLookupBest } from "@/lib/services/musicbrainzClient";
import { lyricsManager } from "@/app/features/lyrics/services/LyricsManager";
import { linesToLrc, segmentsToLyrics, transcribe } from "@/lib/whisper";
import { useLibrary } from "@/app/context/LibraryContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { FloatingWindow } from "@/app/overlay/FloatingWindow";
import "./EditMetadataModal.css";

type Tab = "details" | "artwork" | "lyrics";

const blank = (v: string, placeholder: string) => (v === placeholder ? "" : v);

/**
 * Edit Metadata — shared by Library → All Music and the Playground queue strip.
 * 2.2.0: renders in the GLOBAL overlay layer as a draggable window (it used to disrupt the layout it was opened from),
 * and edits the full tag set: artwork, title, artist, album, album artist, year, genre, composer, lyrics, comments.
 */
export function EditMetadataModal({ track, onClose }: { track: Track; onClose: () => void }) {
  const { updateTrack } = useLibrary();
  const { push } = useNotifications();
  const [tab, setTab] = useState<Tab>("details");
  const [f, setF] = useState<FullTags>({
    title: track.title,
    artist: blank(track.artist, "Unknown artist"),
    album: blank(track.album, "Unknown album"),
    albumArtist: track.albumArtist ?? "",
    year: track.year ?? null,
    genre: track.genre ?? "",
    composer: track.composer ?? "",
    comment: track.comment ?? "",
    lyrics: "",
  });
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FullTags>(k: K, v: FullTags[K]) => setF((prev) => ({ ...prev, [k]: v }));

  // Pre-fill from the file itself (the library cache only holds title/artist/album).
  useEffect(() => {
    let cancelled = false;
    readFullTags(track.path)
      .then((t) => !cancelled && setF((prev) => ({ ...prev, ...t, title: t.title || prev.title, artist: t.artist || prev.artist, album: t.album || prev.album })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [track.path]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onPickImage = () => run("Picking image…", async () => {
    const p = await pickImageFile();
    if (p) setCoverPath(p);
  });

  const findCovers = () => run("Searching covers…", async () => {
    const urls = await mbCoverCandidates(f.artist, f.album || f.title);
    setCandidates(urls);
    if (urls.length === 0) setError("No online covers found for this album.");
  });

  const useCandidate = (url: string) => run("Downloading cover…", async () => setCoverPath(await downloadToTemp(url)));

  const lookup = () => run("Looking up MusicBrainz…", async () => {
    const m = await mbLookupBest(f.artist, f.title);
    if (!m) throw new Error("MusicBrainz had no match.");
    setF((prev) => ({ ...prev, album: prev.album || m.album || "", year: prev.year ?? m.year ?? null, genre: prev.genre || m.genre || "" }));
  });

  const fetchLyrics = () => run("Finding lyrics…", async () => {
    const doc = await lyricsManager.loadForTrack({ id: track.id, title: f.title, artist: f.artist, album: f.album, duration: track.duration, path: track.path });
    if (!doc) throw new Error("No lyrics found online — try “Transcribe with whisper.cpp”, or type them in.");
    set("lyrics", doc.synced ? linesToLrc(doc) : doc.lines.map((l) => l.text).join("\n"));
  });

  const whisperLyrics = () => run("Transcribing (this can take a while)…", async () => {
    const segs = await transcribe(track.path);
    if (segs.length === 0) throw new Error("whisper.cpp heard no words in this track.");
    set("lyrics", linesToLrc(segmentsToLyrics(track, segs)));
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await writeMetadata(track.path, {
        title: f.title,
        artist: f.artist,
        album: f.album,
        albumArtist: f.albumArtist,
        year: f.year ?? 0,
        genre: f.genre,
        composer: f.composer,
        comment: f.comment,
        lyrics: f.lyrics,
        coverPath: coverPath ?? undefined,
      });
      updateTrack(track.id, {
        title: f.title.trim() || track.title,
        artist: f.artist.trim() || "Unknown artist",
        album: f.album.trim() || "Unknown album",
        albumArtist: f.albumArtist.trim() || undefined,
        year: f.year ?? undefined,
        genre: f.genre.trim() || undefined,
        composer: f.composer.trim() || undefined,
        comment: f.comment.trim() || undefined,
        ...(coverPath ? { artworkUrl: previewSrc(coverPath) } : {}),
      });
      push("Metadata saved", `Updated tags for “${f.title.trim() || track.title}”.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const input = (label: string, key: "title" | "artist" | "album" | "albumArtist" | "genre" | "composer", extra?: { required?: boolean; autoFocus?: boolean }) => (
    <label>
      {label}
      <input value={f[key]} onChange={(e) => set(key, e.target.value)} {...extra} />
    </label>
  );

  return (
    <FloatingWindow id="edit-metadata" title={`Edit metadata — ${track.title}`} onClose={onClose} width={460} minimizable={false} defaultPosition={{ x: 200, y: 80 }}>
      <form className="edit-meta" onSubmit={onSubmit}>
        <p className="edit-meta__path" title={track.path}>{track.path}</p>
        <div className="edit-meta__tabs" role="tablist">
          {(["details", "artwork", "lyrics"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} data-active={tab === t} onClick={() => setTab(t)}>
              {t === "details" ? "Details" : t === "artwork" ? "Album artwork" : "Lyrics"}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <>
            {input("Title", "title", { required: true, autoFocus: true })}
            {input("Artist", "artist")}
            {input("Album", "album")}
            {input("Album artist", "albumArtist")}
            <div className="edit-meta__row">
              <label>
                Release year / date
                <input type="number" min={0} max={9999} value={f.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)} />
              </label>
              {input("Genre / subgenre", "genre")}
            </div>
            {input("Composer / songwriter", "composer")}
            <label>
              Comments
              <textarea rows={2} value={f.comment} onChange={(e) => set("comment", e.target.value)} />
            </label>
            <button type="button" className="edit-meta__secondary" onClick={lookup} disabled={Boolean(busy)}>Fill gaps from MusicBrainz</button>
          </>
        )}

        {tab === "artwork" && (
          <div className="edit-meta__art">
            <div className="edit-meta__art-preview">
              {coverPath ? <img src={previewSrc(coverPath)} alt="New cover" /> : track.artworkUrl ? <img src={track.artworkUrl} alt="Current cover" /> : <span>No cover</span>}
            </div>
            <div className="edit-meta__art-actions">
              <button type="button" onClick={onPickImage} disabled={Boolean(busy)}>Choose image…</button>
              <button type="button" onClick={findCovers} disabled={Boolean(busy)}>Find online</button>
              {coverPath && <button type="button" onClick={() => setCoverPath(null)}>Keep current</button>}
              <small>Embedded at up to 1200 px and re-encoded to stay under 500 KB.</small>
            </div>
            {candidates.length > 0 && (
              <div className="edit-meta__candidates">
                {candidates.map((u) => (
                  <button key={u} type="button" onClick={() => void useCandidate(u)} title="Use this cover">
                    <img src={u} alt="" loading="lazy" onError={(e) => (e.currentTarget.parentElement!.style.display = "none")} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "lyrics" && (
          <>
            <div className="edit-meta__art-actions">
              <button type="button" onClick={fetchLyrics} disabled={Boolean(busy)}>Fetch (Genius / LRCLIB)</button>
              <button type="button" onClick={whisperLyrics} disabled={Boolean(busy)}>Transcribe with whisper.cpp</button>
            </div>
            <label>
              Lyrics — plain text, or synced <code>[mm:ss.xx]</code> lines (.lrc)
              <textarea className="edit-meta__lyrics" rows={9} value={f.lyrics} onChange={(e) => set("lyrics", e.target.value)} placeholder="No lyrics yet — fetch them, transcribe the audio, or type them here." />
            </label>
          </>
        )}

        {busy && <p className="edit-meta__busy">{busy}</p>}
        {error && <p className="edit-meta__error">{error}</p>}
        <div className="edit-meta__actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="edit-meta__save" disabled={saving || Boolean(busy)}>
            {saving ? "Writing tags…" : "Save to file"}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
}
