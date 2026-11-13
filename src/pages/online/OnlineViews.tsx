import { useEffect, useMemo, useState } from "react";
import type { Track } from "@/lib/types";
import type { Shelf } from "./shelves";
import { cachedArtistCountry, flagEmoji, regionName, resolveArtistCountry } from "@/lib/library/artistCountry";
import { formatDuration } from "@/lib/formatDuration";
import "./OnlineViews.css";

interface ViewProps {
  tracks: Track[];
  onPlay: (t: Track) => void;
}

/** [lat, lon] centre points — enough countries to make the map meaningful; unknown ones are listed under the map. */
const CENTROIDS: Record<string, [number, number]> = {
  US: [39, -98], CA: [56, -106], MX: [23, -102], BR: [-10, -52], AR: [-34, -64], CL: [-33, -71], CO: [4, -74], PE: [-10, -76], VE: [7, -66], JM: [18, -77], CU: [21, -78], PR: [18, -66], DO: [19, -70],
  GB: [54, -2], IE: [53, -8], FR: [46, 2], DE: [51, 10], ES: [40, -4], PT: [39, -8], IT: [42, 12], NL: [52, 5], BE: [51, 4], CH: [47, 8], AT: [47, 14], SE: [62, 15], NO: [61, 9], DK: [56, 10], FI: [64, 26], IS: [65, -18], PL: [52, 19], CZ: [49, 15], HU: [47, 20], RO: [46, 25], GR: [39, 22], UA: [49, 32], RU: [60, 90], TR: [39, 35], RS: [44, 21], HR: [45, 16], BA: [44, 18],
  NG: [9, 8], GH: [8, -1], ZA: [-29, 24], KE: [0, 38], ET: [9, 40], EG: [26, 30], MA: [32, -6], DZ: [28, 3], SN: [14, -14], CD: [-3, 23], TZ: [-6, 35], UG: [1, 32], CM: [6, 12], CI: [7, -5],
  IN: [21, 78], PK: [30, 70], BD: [24, 90], LK: [8, 81], CN: [35, 103], JP: [36, 138], KR: [36, 128], TW: [24, 121], HK: [22, 114], PH: [13, 122], ID: [-2, 118], MY: [4, 102], SG: [1, 104], TH: [15, 101], VN: [16, 107], IL: [31, 35], SA: [24, 45], AE: [24, 54], IR: [32, 53], IQ: [33, 44], LB: [34, 36], KZ: [48, 67],
  AU: [-25, 134], NZ: [-41, 174],
};

/** Resolve artist countries gradually (cached; ~1 lookup/second) and report them as they arrive. */
function useArtistCountries(tracks: Track[], max = 40) {
  const [codes, setCodes] = useState<Map<string, string | null>>(new Map());
  const [busy, setBusy] = useState(false);
  const artists = useMemo(() => {
    const freq = new Map<string, number>();
    tracks.forEach((t) => t.artist && t.artist !== "Unknown artist" && freq.set(t.artist, (freq.get(t.artist) ?? 0) + 1));
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  }, [tracks]);
  useEffect(() => {
    let alive = true;
    (async () => {
      setBusy(true);
      let lookups = 0;
      for (const a of artists) {
        if (!alive) return;
        let code = await cachedArtistCountry(a);
        if (code === undefined) {
          if (lookups >= max) continue;
          lookups++;
          code = await resolveArtistCountry(a);
        }
        if (alive) setCodes((p) => new Map(p).set(a.toLowerCase(), code ?? null));
      }
      if (alive) setBusy(false);
    })();
    return () => {
      alive = false;
    };
  }, [artists, max]);
  return { codes, busy };
}

/** FEAT-06 Map — songs placed on a world map by the artist's country of origin. */
export function MapView({ tracks, onPlay }: ViewProps) {
  const { codes, busy } = useArtistCountries(tracks);
  const [picked, setPicked] = useState<string | null>(null);
  const byCountry = useMemo(() => {
    const m = new Map<string, Track[]>();
    tracks.forEach((t) => {
      const c = codes.get(t.artist.toLowerCase());
      if (c) (m.get(c) ?? m.set(c, []).get(c)!).push(t);
    });
    return m;
  }, [tracks, codes]);
  const max = Math.max(1, ...[...byCountry.values()].map((v) => v.length));
  const plotted = [...byCountry.entries()].filter(([c]) => CENTROIDS[c]);
  const list = picked ? byCountry.get(picked) ?? [] : [];

  return (
    <div className="ov-map">
      <svg viewBox="0 0 360 180" role="img" aria-label="World map of where these songs come from" className="ov-map__svg">
        <rect width="360" height="180" rx="8" className="ov-map__sea" />
        {[...Array(11)].map((_, i) => <line key={`h${i}`} x1="0" x2="360" y1={(i + 1) * 15} y2={(i + 1) * 15} className="ov-map__grid" />)}
        {[...Array(23)].map((_, i) => <line key={`v${i}`} y1="0" y2="180" x1={(i + 1) * 15} x2={(i + 1) * 15} className="ov-map__grid" />)}
        {plotted.map(([code, list2]) => {
          const [lat, lon] = CENTROIDS[code];
          const r = 3 + (list2.length / max) * 7;
          return (
            <g key={code} className="ov-map__pin" data-active={picked === code} onClick={() => setPicked(picked === code ? null : code)} tabIndex={0} role="button" aria-label={`${regionName(code)}: ${list2.length} songs`} onKeyDown={(e) => e.key === "Enter" && setPicked(picked === code ? null : code)}>
              <circle cx={lon + 180} cy={90 - lat} r={r} />
              <title>{regionName(code)} — {list2.length}</title>
            </g>
          );
        })}
      </svg>
      <p className="ov-note">{busy ? "Finding where artists come from… " : ""}{byCountry.size === 0 && !busy ? "No origin data found for these artists yet." : `${byCountry.size} countries · tap a dot`}</p>
      {picked && (
        <div className="ov-map__list">
          <h3>{flagEmoji(picked)} {regionName(picked)}</h3>
          {list.map((t) => <button key={t.id} type="button" onClick={() => onPlay(t)}><strong>{t.title}</strong><small>{t.artist}</small></button>)}
        </div>
      )}
    </div>
  );
}

/** FEAT-06 Milestones — a timeline: by release year when the service gives one, otherwise by chart position. */
export function MilestonesView({ tracks, onPlay }: ViewProps) {
  const groups = useMemo(() => {
    const withYear = tracks.filter((t) => t.year);
    if (withYear.length >= Math.ceil(tracks.length / 2)) {
      const m = new Map<number, Track[]>();
      withYear.forEach((t) => (m.get(t.year!) ?? m.set(t.year!, []).get(t.year!)!).push(t));
      return { label: "Release year", rows: [...m.entries()].sort((a, b) => b[0] - a[0]).map(([k, v]) => ({ key: String(k), tracks: v })) };
    }
    const bands: [string, number, number][] = [["Top 10", 0, 10], ["11 – 25", 10, 25], ["26 – 50", 25, 50]];
    return { label: "Chart position", rows: bands.map(([key, a, b]) => ({ key, tracks: tracks.slice(a, b) })).filter((r) => r.tracks.length) };
  }, [tracks]);
  return (
    <ol className="ov-timeline" aria-label={`Milestones by ${groups.label}`}>
      {groups.rows.map((r) => (
        <li key={r.key}>
          <span className="ov-timeline__dot" aria-hidden />
          <h3>{r.key} <small>{r.tracks.length} songs</small></h3>
          <div className="ov-timeline__items">
            {r.tracks.slice(0, 8).map((t) => <button key={t.id} type="button" onClick={() => onPlay(t)} title={`${t.title} — ${t.artist}`}>{t.title}</button>)}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** FEAT-06 Graph — top artists and the length of songs, as plain bars (no chart library needed). */
export function GraphView({ tracks }: Omit<ViewProps, "onPlay">) {
  const artists = useMemo(() => {
    const m = new Map<string, number>();
    tracks.forEach((t) => m.set(t.artist, (m.get(t.artist) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [tracks]);
  const buckets = useMemo(() => {
    const defs: [string, (s: number) => boolean][] = [["< 2 min", (s) => s < 120], ["2–3 min", (s) => s >= 120 && s < 180], ["3–4 min", (s) => s >= 180 && s < 240], ["4–5 min", (s) => s >= 240 && s < 300], ["5+ min", (s) => s >= 300]];
    return defs.map(([label, f]) => [label, tracks.filter((t) => t.duration > 0 && f(t.duration)).length] as const);
  }, [tracks]);
  const total = tracks.reduce((s, t) => s + (t.duration || 0), 0);
  const bar = (label: string, n: number, max: number) => (
    <div className="ov-bar" key={label}><span>{label}</span><i><b style={{ width: `${(n / Math.max(1, max)) * 100}%` }} /></i><em>{n}</em></div>
  );
  return (
    <div className="ov-graph">
      <p className="ov-note">{tracks.length} songs · {formatDuration(total)} in total</p>
      <h3>Top artists</h3>
      {artists.map(([a, n]) => bar(a, n, artists[0]?.[1] ?? 1))}
      <h3>Song length</h3>
      {buckets.map(([l, n]) => bar(l, n, Math.max(...buckets.map((b) => b[1]))))}
    </div>
  );
}

/** FEAT-06 Discover — songs from this service you don't own yet, led by artists you already play. */
export function buildDiscoverShelf(remote: Track[], local: Track[], recentArtists: string[]): Shelf | null {
  const owned = new Set(local.map((t) => `${t.title}|${t.artist}`.toLowerCase()));
  const fresh = remote.filter((t) => !owned.has(`${t.title}|${t.artist}`.toLowerCase()));
  if (fresh.length === 0) return null;
  const liked = new Set(recentArtists.map((a) => a.toLowerCase()));
  const ranked = [...fresh].sort((a, b) => Number(liked.has(b.artist.toLowerCase())) - Number(liked.has(a.artist.toLowerCase())));
  return {
    id: "discover",
    title: "Discover",
    caption: "Songs you don't have yet — artists you already play come first.",
    items: ranked.slice(0, 18).map((t) => ({ id: `d-${t.id}`, title: t.title, subtitle: liked.has(t.artist.toLowerCase()) ? `${t.artist} · you play this artist` : t.artist, image: t.artworkUrl, track: t })),
  };
}
