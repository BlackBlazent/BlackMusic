import { useEffect, useMemo, useRef, useState } from "react";
import { FloatingWindow } from "@/app/components/FloatingWindow";
import { formatDuration } from "@/lib/formatDuration";
import type { Track } from "@/lib/types";
import "./QueueWindow.css";

type SortKey = "queue" | "az" | "genre" | "artist" | "album" | "folder";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "queue", label: "Queue" },
  { id: "az", label: "A–Z" },
  { id: "genre", label: "Genre" },
  { id: "artist", label: "Artist" },
  { id: "album", label: "Album" },
  { id: "folder", label: "Folder" },
];
const ROW = 48;
const OVERSCAN = 8;

const folderOf = (t: Track) => (t.path ? t.path.replace(/[\\/][^\\/]*$/, "").split(/[\\/]/).pop() ?? "" : "");
const keyFor = (t: Track, sort: SortKey): string => {
  switch (sort) {
    case "genre": return t.genre ?? "";
    case "artist": return t.artist;
    case "album": return t.album;
    case "folder": return folderOf(t);
    default: return t.title;
  }
};

/**
 * IMP-04 — the whole queue in one floating window: search by name, sort tabs, jump-to-playing. The list is VIRTUALIZED (only
 * the rows on screen exist in the DOM), so a 100,000-song queue costs the same as a 20-song one and can't freeze the app.
 */
export function QueueWindow({ tracks, currentTrackId, onPlay, onClose }: { tracks: Track[]; currentTrackId?: string; onPlay: (t: Track) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("queue");
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(360);
  const box = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = needle ? tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(needle)) : tracks;
    if (sort !== "queue") list = [...list].sort((a, b) => keyFor(a, sort).localeCompare(keyFor(b, sort), undefined, { sensitivity: "base", numeric: true }) || a.title.localeCompare(b.title));
    return list;
  }, [tracks, q, sort]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const jumpToPlaying = () => {
    const i = rows.findIndex((t) => t.id === currentTrackId);
    if (i >= 0 && box.current) box.current.scrollTop = Math.max(0, i * ROW - viewH / 2 + ROW / 2);
  };
  useEffect(jumpToPlaying, []); // eslint-disable-line react-hooks/exhaustive-deps -- open centered on what's playing

  const start = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW) + OVERSCAN);

  return (
    <FloatingWindow title={`Queue · ${rows.length.toLocaleString()}`} onClose={onClose} width={440} height={560}>
      <div className="qwin__tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, artist or album…" aria-label="Search the queue" />
        <button type="button" onClick={jumpToPlaying} title="Scroll to the playing song">◎</button>
      </div>
      <div className="qwin__sorts" role="tablist" aria-label="Sort queue">
        {SORTS.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={sort === s.id} data-active={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="qwin__list" ref={box} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        {rows.length === 0 ? (
          <p className="qwin__empty">{q ? "No songs match your search." : "The queue is empty."}</p>
        ) : (
          <div style={{ height: rows.length * ROW, position: "relative" }}>
            {rows.slice(start, end).map((t, i) => (
              <button
                key={t.id}
                type="button"
                className="qwin__row"
                data-active={t.id === currentTrackId}
                style={{ top: (start + i) * ROW, height: ROW }}
                onClick={() => onPlay(t)}
                title={`${t.title} — ${t.artist}`}
              >
                <span className="qwin__thumb">{t.artworkUrl ? <img src={t.artworkUrl} alt="" loading="lazy" /> : "♪"}</span>
                <span className="qwin__text"><strong>{t.title}</strong><small>{sort === "folder" ? folderOf(t) : sort === "genre" && t.genre ? `${t.genre} · ${t.artist}` : t.artist}</small></span>
                <span className="qwin__dur">{formatDuration(t.duration)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
