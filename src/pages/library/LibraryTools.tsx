import { useMemo, useState, type ReactNode } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { FloatingWindow } from "@/app/overlay/FloatingWindow";
import { useSharedSetting } from "@/lib/sharedSetting";
import { useT } from "@/lib/i18n";
import { FILENAME_PATTERNS, guessTagsFromFilename, writeMetadata, type MetadataPatch } from "@/lib/library/metadataEditor";
import { mbLookupBest } from "@/lib/services/musicbrainzClient";
import { formatDuration } from "@/lib/formatDuration";
import { isMobileOs } from "@/lib/useIsMobile";
import type { Track } from "@/lib/types";
import "./LibraryTools.css";

type ToolId = "bitrate" | "duplicates" | "memory" | "converter" | "organizer" | "mood" | "batch" | "smart";
const DAY = 86_400_000;
const LOSSLESS = new Set(["Flac", "Wav", "Aiff", "Ape", "WavPack"]);
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function Window({ id, title, onClose, children, width = 640 }: { id: string; title: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <FloatingWindow id={`lib-${id}`} title={title} onClose={onClose} width={width} minimizable defaultPosition={{ x: 180, y: 90 }}>
      <div className="lib-tool">{children}</div>
    </FloatingWindow>
  );
}

// ======================================================================================== card 
{/*
export function LibraryCards() {
  const t = useT();
  const [open, setOpen] = useState<ToolId | null>(null);
  const mobile = isMobileOs();
  const cards: { id: ToolId; label: string; hint: string; icon: string; desktopOnly?: boolean }[] = [
    { id: "bitrate", label: t("library.card.bitrate"), hint: "Find low-quality files", icon: "📶" },
    { id: "duplicates", label: t("library.card.duplicates"), hint: "Same song, several files", icon: "🧬" },
    { id: "memory", label: t("library.card.memory"), hint: "Songs from your past", icon: "🕰" },
    { id: "mood", label: t("library.card.mood"), hint: "A queue for your mood", icon: "🎚" },
    { id: "batch", label: "Batch Tag Editor", hint: "Fix many tags at once", icon: "🏷", desktopOnly: true },
    { id: "converter", label: t("library.card.converter"), hint: "MP3 · FLAC · WAV · AAC", icon: "🔁", desktopOnly: true },
    { id: "organizer", label: t("library.card.organizer"), hint: "Preview a tidy folder layout", icon: "🗂", desktopOnly: true },
  ];
  return (
    <>
      <div className="library-cards">
        {cards.filter((c) => !(c.desktopOnly && mobile)).map((c) => (
          <button key={c.id} type="button" className="library-cards__card" onClick={() => setOpen(c.id)}>
            <span className="library-cards__icon">{c.icon}</span>
            <strong>{c.label}</strong>
            <small>{c.hint}</small>
          </button>
        ))}
      </div>
      {open === "bitrate" && <BitrateAnalyzer onClose={() => setOpen(null)} />}
      {open === "duplicates" && <DuplicateFinder onClose={() => setOpen(null)} />}
      {open === "memory" && <MemoryLane onClose={() => setOpen(null)} />}
      {open === "mood" && <MoodTuner onClose={() => setOpen(null)} />}
      {open === "batch" && <BatchTagEditor onClose={() => setOpen(null)} />}
      {open === "converter" && <FormatConverter onClose={() => setOpen(null)} />}
      {open === "organizer" && <FileOrganizer onClose={() => setOpen(null)} />}
    </>
  );
}
*/}

export function LibraryCards() {
  const t = useT();
  const [open, setOpen] = useState<ToolId | null>(null);
  const mobile = isMobileOs();

  const cards: {
    id: ToolId;
    label: string;
    hint: string;
    icon: string;
    desktopOnly?: boolean;
  }[] = [
    {
      id: "bitrate",
      label: t("library.card.bitrate"),
      hint: "Find low-quality files",
      icon: "/assets/media/images/icons/general/navigations/bitrate.png",
    },
    {
      id: "duplicates",
      label: t("library.card.duplicates"),
      hint: "Same song, several files",
      icon: "/assets/media/images/icons/general/navigations/duplicates.png",
    },
    {
      id: "memory",
      label: t("library.card.memory"),
      hint: "Songs from your past",
      icon: "/assets/media/images/icons/general/navigations/memory.png",
    },
    {
      id: "mood",
      label: t("library.card.mood"),
      hint: "A queue for your mood",
      icon: "/assets/media/images/icons/general/navigations/moode.png",
    },
    {
      id: "batch",
      label: "Batch Tag Editor",
      hint: "Fix many tags at once",
      icon: "/assets/media/images/icons/general/navigations/batch.png",
      desktopOnly: true,
    },
    {
      id: "converter",
      label: t("library.card.converter"),
      hint: "MP3 · FLAC · WAV · AAC",
      icon: "/assets/media/images/icons/general/navigations/converter.png",
      desktopOnly: true,
    },
    {
      id: "organizer",
      label: t("library.card.organizer"),
      hint: "Preview a tidy folder layout",
      icon: "/assets/media/images/icons/general/navigations/organizer.png",
      desktopOnly: true,
    },
  ];

  return (
    <>
      <div className="library-cards">
        {cards
          .filter((c) => !(c.desktopOnly && mobile))
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className="library-cards__card"
              onClick={() => setOpen(c.id)}
            >
              <span className="library-cards__icon">
                <img style={{width:'30px', height:'30px'}} src={c.icon} alt="" aria-hidden="true" />
              </span>
              <strong>{c.label}</strong>
              <small>{c.hint}</small>
            </button>
          ))}
      </div>

      {open === "bitrate" && (
        <BitrateAnalyzer onClose={() => setOpen(null)} />
      )}
      {open === "duplicates" && (
        <DuplicateFinder onClose={() => setOpen(null)} />
      )}
      {open === "memory" && <MemoryLane onClose={() => setOpen(null)} />}
      {open === "mood" && <MoodTuner onClose={() => setOpen(null)} />}
      {open === "batch" && <BatchTagEditor onClose={() => setOpen(null)} />}
      {open === "converter" && (
        <FormatConverter onClose={() => setOpen(null)} />
      )}
      {open === "organizer" && (
        <FileOrganizer onClose={() => setOpen(null)} />
      )}
    </>
  );
}


// ================================================================================ Bitrate Analyzer
function BitrateAnalyzer({ onClose }: { onClose: () => void }) {
  const { tracks, rescan, scanning } = useLibrary();
  const { playTrack } = usePlayback();
  const analysed = tracks.filter((x) => x.format !== undefined && x.format !== "unknown");
  const buckets = useMemo(() => {
    const b = [
      { label: "Lossless", test: (x: Track) => LOSSLESS.has(x.format ?? ""), n: 0, color: "#3ddc97" },
      { label: "256–320 kbps", test: (x: Track) => (x.bitrate ?? 0) >= 256, n: 0, color: "#7bd88f" },
      { label: "192–255 kbps", test: (x: Track) => (x.bitrate ?? 0) >= 192, n: 0, color: "#ffd24a" },
      { label: "128–191 kbps", test: (x: Track) => (x.bitrate ?? 0) >= 128, n: 0, color: "#ff9f43" },
      { label: "Under 128 kbps", test: () => true, n: 0, color: "#ff4d6d" },
    ];
    for (const x of analysed) (b.find((k) => k.test(x)) ?? b[4]).n++;
    return b;
  }, [analysed]);
  const low = analysed.filter((x) => !LOSSLESS.has(x.format ?? "") && (x.bitrate ?? 999) < 128).slice(0, 100);
  const max = Math.max(1, ...buckets.map((x) => x.n));
  return (
    <Window id="bitrate" title="Bitrate Analyzer" onClose={onClose}>
      {analysed.length < tracks.length * 0.5 && (
        <p className="lib-tool__note">Only {analysed.length} of {tracks.length} tracks have been analysed. A rescan reads their audio headers once.
          <button type="button" disabled={scanning} onClick={() => void rescan()}>{scanning ? "Scanning…" : "Rescan library"}</button></p>
      )}
      <div className="lib-tool__bars">
        {buckets.map((k) => (
          <div key={k.label}><span>{k.label}</span><span className="lib-tool__bar"><span style={{ width: `${(k.n / max) * 100}%`, background: k.color }} /></span><b>{k.n}</b></div>
        ))}
      </div>
      <h4>Worth replacing ({low.length}{low.length === 100 ? "+" : ""})</h4>
      <div className="lib-tool__list">
        {low.length === 0 && <p className="lib-tool__note">No low-bitrate files found 🎉</p>}
        {low.map((x) => <button key={x.id} type="button" onClick={() => playTrack(x, low)}><span>{x.title} — {x.artist}</span><small>{x.bitrate} kbps · {x.format}</small></button>)}
      </div>
    </Window>
  );
}

// ============================================================================= Duplicate Song Finder
function DuplicateFinder({ onClose }: { onClose: () => void }) {
  const { tracks, hideTrack, removeFromLibrary } = useLibrary();
  const { push } = useNotifications();
  const groups = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (const x of tracks) {
      const k = `${norm(x.title)}|${norm(x.artist)}`;
      if (!norm(x.title)) continue;
      map.set(k, [...(map.get(k) ?? []), x]);
    }
    return [...map.values()].filter((g) => g.length > 1 && g.some((a) => g.some((b) => a !== b && Math.abs(a.duration - b.duration) < 3))).sort((a, b) => b.length - a.length);
  }, [tracks]);
  const best = (g: Track[]) => [...g].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0) || (b.size ?? 0) - (a.size ?? 0))[0];
  return (
    <Window id="duplicates" title="Duplicate Song Finder" onClose={onClose}>
      <p className="lib-tool__note">Same title + artist and nearly the same length. Hiding or removing only affects your library — files on disk are never deleted.</p>
      {groups.length === 0 && <p className="lib-tool__note">No duplicates found 🎉</p>}
      {groups.slice(0, 60).map((g) => {
        const keep = best(g);
        return (
          <div key={g[0].id} className="lib-tool__group">
            <strong>{g[0].title} — {g[0].artist}</strong>
            {g.map((x) => (
              <div key={x.id} className="lib-tool__file" data-keep={x === keep}>
                <span title={x.path}>{x.path}</span>
                <small>{x.bitrate ? `${x.bitrate} kbps · ` : ""}{x.size ? `${(x.size / 1048576).toFixed(1)} MB` : ""}{x === keep ? " · best" : ""}</small>
                {x !== keep && <button type="button" onClick={() => { hideTrack(x.id); push("Hidden", `Hid a duplicate of “${x.title}”.`); }}>Hide</button>}
                {x !== keep && <button type="button" onClick={() => removeFromLibrary(x.id)}>Remove</button>}
              </div>
            ))}
          </div>
        );
      })}
    </Window>
  );
}

// ======================================================================================== Memory Lane
function MemoryLane({ onClose }: { onClose: () => void }) {
  const { tracks } = useLibrary();
  const { events } = usePlaybackHistory();
  const { playTrack } = usePlayback();
  const decades = useMemo(() => {
    const m = new Map<number, Track[]>();
    for (const x of tracks) if (x.year && x.year > 1900) m.set(Math.floor(x.year / 10) * 10, [...(m.get(Math.floor(x.year / 10) * 10) ?? []), x]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [tracks]);
  const forgotten = useMemo(() => {
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const total = new Map<string, number>();
    const last = new Map<string, number>();
    for (const e of events) { total.set(e.trackId, (total.get(e.trackId) ?? 0) + 1); last.set(e.trackId, Math.max(last.get(e.trackId) ?? 0, e.playedAt)); }
    return [...total.entries()].filter(([id, n]) => n >= 3 && Date.now() - (last.get(id) ?? 0) > 60 * DAY).sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)).filter((x): x is Track => Boolean(x));
  }, [events, tracks]);
  const old = useMemo(() => [...tracks].sort((a, b) => a.addedAt - b.addedAt).slice(0, 50), [tracks]);
  const Row = ({ title, list }: { title: string; list: Track[] }) => list.length === 0 ? null : (
    <button type="button" className="lib-tool__row" onClick={() => playTrack(list[0], list)}><strong>{title}</strong><small>{list.length} tracks ▶</small></button>
  );
  return (
    <Window id="memory" title="Memory Lane" onClose={onClose} width={480}>
      <Row title="Forgotten favourites (played a lot, not lately)" list={forgotten} />
      <Row title="The oldest songs in your library" list={old} />
      {decades.map(([d, list]) => <Row key={d} title={`The ${d}s`} list={list} />)}
      {decades.length === 0 && forgotten.length === 0 && <p className="lib-tool__note">Release years appear after a library rescan (they're read from your files' tags).</p>}
    </Window>
  );
}

// ======================================================================================== Mood Tuner
const MOODS: Record<string, { words: RegExp; label: string }> = {
  energetic: { label: "Energetic", words: /rock|metal|dance|edm|electro|house|techno|punk|hip.?hop|rap|drum|trap|pop punk/i },
  chill: { label: "Chill", words: /chill|ambient|lofi|lo-fi|acoustic|jazz|soul|folk|bossa|downtempo|lounge/i },
  focus: { label: "Focus", words: /classical|instrumental|piano|ambient|score|soundtrack|post.?rock|minimal/i },
  melancholy: { label: "Melancholy", words: /blues|sad|slow|ballad|indie|alternative|singer/i },
  party: { label: "Party", words: /dance|pop|disco|funk|reggaeton|latin|afro|club|remix/i },
};
function MoodTuner({ onClose }: { onClose: () => void }) {
  const { tracks } = useLibrary();
  const { playTrack } = usePlayback();
  const { createPlaylist, addTracks } = usePlaylists();
  const { push } = useNotifications();
  const [mood, setMood] = useState("chill");
  const [length, setLength] = useState(25);
  const queue = useMemo(() => {
    const rx = MOODS[mood].words;
    const scored = tracks.map((x) => ({ x, s: (rx.test(x.genre ?? "") ? 3 : 0) + (rx.test(`${x.title} ${x.album}`) ? 1 : 0) + Math.random() * 0.5 })).filter((e) => e.s >= 1);
    return scored.sort((a, b) => b.s - a.s).slice(0, length).map((e) => e.x);
  }, [tracks, mood, length]);
  return (
    <Window id="mood" title="Mood Tuner" onClose={onClose} width={480}>
      <p className="lib-tool__note">Builds a queue from your library using genre tags and title/album keywords — a heuristic, not audio analysis.</p>
      <div className="lib-tool__chips">{Object.entries(MOODS).map(([k, v]) => <button key={k} type="button" data-active={mood === k} onClick={() => setMood(k)}>{v.label}</button>)}</div>
      <label className="lib-tool__field">Queue length: {length}<input type="range" min={5} max={60} value={length} onChange={(e) => setLength(Number(e.target.value))} /></label>
      <p className="lib-tool__note">{queue.length} matching tracks{queue.length === 0 ? " — tag some genres with Edit metadata, then rescan." : ""}</p>
      <div className="lib-tool__chips">
        <button type="button" disabled={queue.length === 0} onClick={() => playTrack(queue[0], queue)}>▶ Play</button>
        <button type="button" disabled={queue.length === 0} onClick={() => { const p = createPlaylist(`${MOODS[mood].label} mix`, "Made with Mood Tuner", null); addTracks(p.id, queue.map((x) => x.id)); push("Playlist created", `“${p.name}” with ${queue.length} tracks.`); }}>Save as playlist</button>
      </div>
    </Window>
  );
}

// ============================================================================= Batch Tag Editor
function BatchTagEditor({ onClose }: { onClose: () => void }) {
  const { tracks, updateTrack } = useLibrary();
  const { push } = useNotifications();
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pattern, setPattern] = useState(FILENAME_PATTERNS[0].pattern);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(() => {
    const n = filter.trim().toLowerCase();
    return (n ? tracks.filter((x) => `${x.title} ${x.artist} ${x.album} ${x.path}`.toLowerCase().includes(n)) : tracks).slice(0, 300);
  }, [tracks, filter]);
  const chosen = tracks.filter((x) => picked.has(x.id));
  const various = (key: "artist" | "album" | "albumArtist" | "genre" | "year") => {
    const vals = new Set(chosen.map((x) => String(x[key] ?? "")));
    return vals.size > 1 ? "<various>" : [...vals][0] ?? "";
  };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setF = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const apply = async (perTrack?: (x: Track) => Promise<MetadataPatch | null>) => {
    if (chosen.length === 0) return;
    let done = 0, failed = 0;
    for (const x of chosen) {
      setBusy(`Writing ${++done}/${chosen.length}…`);
      try {
        const patch: MetadataPatch = perTrack ? (await perTrack(x)) ?? {} : {
          ...(fields.artist ? { artist: fields.artist } : {}), ...(fields.album ? { album: fields.album } : {}), ...(fields.albumArtist ? { albumArtist: fields.albumArtist } : {}),
          ...(fields.genre ? { genre: fields.genre } : {}), ...(fields.year ? { year: Number(fields.year) } : {}),
        };
        if (Object.keys(patch).length === 0) continue;
        await writeMetadata(x.path, patch);
        updateTrack(x.id, { title: patch.title, artist: patch.artist, album: patch.album, albumArtist: patch.albumArtist, genre: patch.genre, year: patch.year } as Partial<Track>);
      } catch (e) { failed++; console.error("[batch tags]", x.path, e); }
    }
    setBusy(null);
    push("Batch edit finished", `${chosen.length - failed} updated${failed ? `, ${failed} failed (file in use or read-only)` : ""}.`);
  };

  const guess = () => void apply(async (x) => {
    const g = guessTagsFromFilename(x.path, pattern);
    return { ...(g.title ? { title: g.title } : {}), ...(g.artist ? { artist: g.artist } : {}), ...(g.album ? { album: g.album } : {}), ...(g.year ? { year: Number(g.year) } : {}) };
  });
  const lookup = () => void apply(async (x) => {
    const m = await mbLookupBest(x.artist === "Unknown artist" ? "" : x.artist, x.title);
    return m ? { ...(m.album && x.album === "Unknown album" ? { album: m.album } : {}), ...(m.year && !x.year ? { year: m.year } : {}), ...(m.genre && !x.genre ? { genre: m.genre } : {}) } : null;
  });

  return (
    <Window id="batch" title="Batch Tag Editor" onClose={onClose} width={720}>
      <div className="lib-tool__split">
        <div>
          <input className="lib-tool__search" placeholder="Filter tracks…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="lib-tool__chips"><button type="button" onClick={() => setPicked(new Set(visible.map((x) => x.id)))}>Select shown</button><button type="button" onClick={() => setPicked(new Set())}>Clear</button><small>{picked.size} selected</small></div>
          <div className="lib-tool__list lib-tool__list--tall">
            {visible.map((x) => <label key={x.id} className="lib-tool__pick"><input type="checkbox" checked={picked.has(x.id)} onChange={() => toggle(x.id)} /><span>{x.title} <small>{x.artist} · {x.album}</small></span></label>)}
          </div>
        </div>
        <div className="lib-tool__form">
          <p className="lib-tool__note">Only the fields you fill in are changed. Titles stay untouched unless you use the filename guesser.</p>
          {([["artist", "Artist"], ["album", "Album"], ["albumArtist", "Album artist"], ["genre", "Genre"], ["year", "Year"]] as const).map(([k, label]) => (
            <label key={k} className="lib-tool__field">{label}<input placeholder={chosen.length ? various(k) : ""} value={fields[k] ?? ""} onChange={(e) => setF(k, e.target.value)} /></label>
          ))}
          <button type="button" className="lib-tool__primary" disabled={chosen.length === 0 || Boolean(busy)} onClick={() => void apply()}>{busy ?? `Apply to ${chosen.length} track(s)`}</button>
          <hr />
          <label className="lib-tool__field">Guess from file name
            <select value={pattern} onChange={(e) => setPattern(e.target.value)}>{FILENAME_PATTERNS.map((p) => <option key={p.id} value={p.pattern}>{p.label}</option>)}</select>
          </label>
          <button type="button" disabled={chosen.length === 0 || Boolean(busy)} onClick={guess}>Guess tags from names</button>
          <button type="button" disabled={chosen.length === 0 || Boolean(busy)} onClick={lookup}>Fill gaps from MusicBrainz (1 per second)</button>
        </div>
      </div>
    </Window>
  );
}

// ============================================================================== Format Converter
const FORMATS = [
  { id: "mp3", label: "MP3", args: (kb: number) => ["-codec:a", "libmp3lame", "-b:a", `${kb}k`] },
  { id: "flac", label: "FLAC (lossless)", args: () => ["-codec:a", "flac"] },
  { id: "wav", label: "WAV", args: () => ["-codec:a", "pcm_s16le"] },
  { id: "m4a", label: "AAC (.m4a)", args: (kb: number) => ["-codec:a", "aac", "-b:a", `${kb}k`] },
  { id: "ogg", label: "Ogg Vorbis", args: (kb: number) => ["-codec:a", "libvorbis", "-b:a", `${kb}k`] },
] as const;
function FormatConverter({ onClose }: { onClose: () => void }) {
  const { tracks } = useLibrary();
  const { push } = useNotifications();
  const [filter, setFilter] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fmt, setFmt] = useState<(typeof FORMATS)[number]["id"]>("mp3");
  const [kb, setKb] = useState(256);
  const [status, setStatus] = useState<string | null>(null);
  const local = tracks.filter((x) => x.path);
  const visible = (filter ? local.filter((x) => `${x.title} ${x.artist}`.toLowerCase().includes(filter.toLowerCase())) : local).slice(0, 200);

  const convert = async () => {
    const chosen = local.filter((x) => picked.has(x.id));
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true, title: "Choose an output folder" });
    if (typeof dir !== "string") return;
    const { invoke } = await import("@tauri-apps/api/core");
    const { join } = await import("@tauri-apps/api/path");
    const spec = FORMATS.find((f) => f.id === fmt)!;
    let ok = 0;
    for (const [i, x] of chosen.entries()) {
      setStatus(`Converting ${i + 1}/${chosen.length}: ${x.title}`);
      const out = await join(dir, `${x.artist} - ${x.title}`.replace(/[\\/:*?"<>|]/g, "_") + `.${fmt}`);
      try {
        const r = await invoke<{ code: number; stderr: string }>("ffmpeg_run", { args: ["-y", "-i", x.path, "-vn", ...spec.args(kb), out] });
        if (r.code === 0) ok++; else console.error("[ffmpeg]", r.stderr.split("\n").slice(-3).join(" "));
      } catch (e) { push("Converter", e instanceof Error ? e.message : String(e)); setStatus(null); return; }
    }
    setStatus(null);
    push("Conversion finished", `${ok} of ${chosen.length} file(s) converted. Originals are untouched.`);
  };
  return (
    <Window id="converter" title="Format Converter" onClose={onClose} width={560}>
      <p className="lib-tool__note">Converts copies into a folder you choose — originals are never changed. Needs ffmpeg (Settings → Plugins & Tools).</p>
      <div className="lib-tool__chips">{FORMATS.map((f) => <button key={f.id} type="button" data-active={fmt === f.id} onClick={() => setFmt(f.id)}>{f.label}</button>)}</div>
      {(fmt === "mp3" || fmt === "m4a" || fmt === "ogg") && <label className="lib-tool__field">Bitrate: {kb} kbps<input type="range" min={96} max={320} step={32} value={kb} onChange={(e) => setKb(Number(e.target.value))} /></label>}
      <input className="lib-tool__search" placeholder="Filter tracks…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <div className="lib-tool__list lib-tool__list--tall">
        {visible.map((x) => <label key={x.id} className="lib-tool__pick"><input type="checkbox" checked={picked.has(x.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} /><span>{x.title} <small>{x.artist} · {x.format ?? ""}</small></span></label>)}
      </div>
      <button type="button" className="lib-tool__primary" disabled={picked.size === 0 || Boolean(status)} onClick={() => void convert()}>{status ?? `Convert ${picked.size} track(s)`}</button>
    </Window>
  );
}

// ============================================================================= File Organizer (preview)
function FileOrganizer({ onClose }: { onClose: () => void }) {
  const { tracks } = useLibrary();
  const [pattern, setPattern] = useState("{artist}/{album}/{title}");
  const plan = useMemo(() => tracks.filter((x) => x.path).slice(0, 40).map((x) => {
    const ext = x.path.split(".").pop() ?? "";
    const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_");
    const target = pattern.replace("{artist}", clean(x.albumArtist || x.artist)).replace("{album}", clean(x.album)).replace("{title}", clean(x.title)).replace("{year}", String(x.year ?? "")).replace("{genre}", clean(x.genre ?? "")) + "." + ext;
    return { from: x.path, to: target };
  }), [tracks, pattern]);
  return (
    <Window id="organizer" title="File Organizer — preview" onClose={onClose} width={640}>
      <p className="lib-tool__note"><b>Preview only in 2.2.0.</b> Moving files changes where your music lives, so this version only shows the folder layout it would create — nothing is moved or renamed.</p>
      <label className="lib-tool__field">Layout<input value={pattern} onChange={(e) => setPattern(e.target.value)} /><small>Tokens: {"{artist} {album} {title} {year} {genre}"}</small></label>
      <div className="lib-tool__list lib-tool__list--tall">{plan.map((p) => <div key={p.from} className="lib-tool__file"><span title={p.from}>{p.from}</span><small>→ {p.to}</small></div>)}</div>
      <button type="button" className="lib-tool__primary" disabled>Apply (coming in a later release)</button>
    </Window>
  );
}

// ================================================================================== Smart Playlists
type SmartRule =
  | { kind: "longer"; minutes: number }
  | { kind: "mostPlayedMonth"; count: number }
  | { kind: "mostSkipped"; count: number }
  | { kind: "neverPlayed" }
  | { kind: "recentlyAdded"; days: number }
  | { kind: "genre"; text: string }
  | { kind: "decade"; from: number; to: number }
  | { kind: "lowBitrate" };
interface SmartPlaylist { id: string; name: string; rule: SmartRule }

const TEMPLATES: { label: string; make: () => { name: string; rule: SmartRule } }[] = [
  { label: "Songs longer than 6 minutes", make: () => ({ name: "Long songs", rule: { kind: "longer", minutes: 6 } }) },
  { label: "Most played this month", make: () => ({ name: "This month's top 25", rule: { kind: "mostPlayedMonth", count: 25 } }) },
  { label: "Most skipped", make: () => ({ name: "Skip list", rule: { kind: "mostSkipped", count: 25 } }) },
  { label: "Never played", make: () => ({ name: "Never played", rule: { kind: "neverPlayed" } }) },
  { label: "Added in the last 30 days", make: () => ({ name: "New in library", rule: { kind: "recentlyAdded", days: 30 } }) },
  { label: "From the 90s", make: () => ({ name: "The 90s", rule: { kind: "decade", from: 1990, to: 1999 } }) },
  { label: "Low bitrate (under 128 kbps)", make: () => ({ name: "Needs an upgrade", rule: { kind: "lowBitrate" } }) },
];

export function useSmartPlaylistEval() {
  const { tracks } = useLibrary();
  const { events, skips } = usePlaybackHistory();
  return (rule: SmartRule): Track[] => {
    const count = (list: { trackId: string; playedAt: number }[], since: number) => { const m = new Map<string, number>(); for (const e of list) if (e.playedAt >= since) m.set(e.trackId, (m.get(e.trackId) ?? 0) + 1); return m; };
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => byId.get(id)).filter((x): x is Track => Boolean(x));
    switch (rule.kind) {
      case "longer": return tracks.filter((x) => x.duration >= rule.minutes * 60);
      case "mostPlayedMonth": return top(count(events, Date.now() - 30 * DAY), rule.count);
      case "mostSkipped": return top(count(skips, 0), rule.count);
      case "neverPlayed": { const played = new Set(events.map((e) => e.trackId)); return tracks.filter((x) => !played.has(x.id)); }
      case "recentlyAdded": return tracks.filter((x) => x.addedAt >= Date.now() - rule.days * DAY).sort((a, b) => b.addedAt - a.addedAt);
      case "genre": return tracks.filter((x) => (x.genre ?? "").toLowerCase().includes(rule.text.toLowerCase()));
      case "decade": return tracks.filter((x) => x.year !== undefined && x.year >= rule.from && x.year <= rule.to);
      case "lowBitrate": return tracks.filter((x) => (x.bitrate ?? 999) < 128 && !LOSSLESS.has(x.format ?? ""));
    }
  };
}

export function SmartPlaylists() {
  const t = useT();
  const [lists, setLists] = useSharedSetting<SmartPlaylist[]>("smartPlaylists", []);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [genre, setGenre] = useState("");
  const evaluate = useSmartPlaylistEval();
  const { playTrack } = usePlayback();
  const active = lists.find((l) => l.id === openId);
  const activeTracks = active ? evaluate(active.rule) : [];

  return (
    <section className="smart-playlists">
      <div className="smart-playlists__head">
        <h3>Smart playlists</h3>
        <button type="button" onClick={() => setCreating(true)}>{t("library.smart.create")}</button>
      </div>
      <div className="smart-playlists__grid">
        {lists.map((l) => (
          <button key={l.id} type="button" className="smart-playlists__tile" onClick={() => setOpenId(l.id)}>
            <span>⚡</span><strong>{l.name}</strong><small>{evaluate(l.rule).length} tracks · updates itself</small>
          </button>
        ))}
        {lists.length === 0 && <p className="lib-tool__note">Smart playlists fill themselves from rules — “most skipped”, “never played”, “longer than 6 minutes”…</p>}
      </div>
      {creating && (
        <Window id="smart-new" title={t("library.smart.create")} onClose={() => setCreating(false)} width={420}>
          <div className="lib-tool__list">
            {TEMPLATES.map((tpl) => <button key={tpl.label} type="button" onClick={() => { const m = tpl.make(); setLists((a) => [...a, { id: `sp${Date.now()}`, ...m }]); setCreating(false); }}><span>{tpl.label}</span></button>)}
            <div className="lib-tool__file"><input placeholder="Genre contains… (e.g. jazz)" value={genre} onChange={(e) => setGenre(e.target.value)} /><button type="button" disabled={!genre.trim()} onClick={() => { setLists((a) => [...a, { id: `sp${Date.now()}`, name: `${genre.trim()} (genre)`, rule: { kind: "genre", text: genre.trim() } }]); setGenre(""); setCreating(false); }}>Add</button></div>
          </div>
        </Window>
      )}
      {active && (
        <Window id="smart-open" title={`⚡ ${active.name}`} onClose={() => setOpenId(null)} width={520}>
          <div className="lib-tool__chips">
            <button type="button" disabled={activeTracks.length === 0} onClick={() => playTrack(activeTracks[0], activeTracks)}>▶ Play all</button>
            <button type="button" onClick={() => { setLists((a) => a.filter((l) => l.id !== active.id)); setOpenId(null); }}>Delete</button>
          </div>
          <div className="lib-tool__list lib-tool__list--tall">
            {activeTracks.slice(0, 300).map((x) => <button key={x.id} type="button" onClick={() => playTrack(x, activeTracks)}><span>{x.title} — {x.artist}</span><small>{formatDuration(x.duration)}</small></button>)}
          </div>
        </Window>
      )}
    </section>
  );
}
