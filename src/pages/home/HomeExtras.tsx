import { useMemo, useState } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { useAudioFx } from "@/app/context/AudioFxContext";
import { useSharedSetting } from "@/lib/sharedSetting";
import { useLocaleTag, useT } from "@/lib/i18n";
import { mbCoverCandidates } from "@/lib/services/musicbrainzClient";
import { downloadToTemp, previewSrc } from "@/lib/library/coverArt";
import { writeMetadata } from "@/lib/library/metadataEditor";
import type { Track } from "@/lib/types";

const DAY = 86_400_000;
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Play this week" / "Play last 30 days": queue every track played in that window, most-played first. */
export function useWindowQueue(days: number): Track[] {
  const { events } = usePlaybackHistory();
  const { tracks } = useLibrary();
  return useMemo(() => {
    const since = Date.now() - days * DAY;
    const counts = new Map<string, number>();
    for (const e of events) if (e.playedAt >= since) counts.set(e.trackId, (counts.get(e.trackId) ?? 0) + 1);
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)).filter((t): t is Track => Boolean(t));
  }, [events, tracks, days]);
}

export function PlayWindowCard({ days, count, label }: { days: number; count: number; label: string }) {
  const queue = useWindowQueue(days);
  const { playTrack } = usePlayback();
  return (
    <button type="button" className="home-page__stat home-page__stat--action" disabled={queue.length === 0} onClick={() => playTrack(queue[0], queue)} title={`${queue.length} different tracks`}>
      <span className="home-page__stat-value">{count}</span>
      <span className="home-page__stat-label">{label} ▶</span>
    </button>
  );
}

// ------------------------------------------------------------------------------------------ Memory Highlights
interface Highlight { id: string; at: number; title: string; detail: string; track?: Track }

export function MemoryHighlights() {
  const t = useT();
  const locale = useLocaleTag();
  const { events } = usePlaybackHistory();
  const { tracks } = useLibrary();
  const { playTrack } = usePlayback();
  const fx = useAudioFx();

  const highlights = useMemo<Highlight[]>(() => {
    if (events.length < 5) return [];
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const out: Highlight[] = [];
    const perDay = new Map<string, number>();
    const firstPlay = new Map<string, number>();
    const artistFirst = new Map<string, number>();
    for (const e of events) {
      perDay.set(dayKey(e.playedAt), (perDay.get(dayKey(e.playedAt)) ?? 0) + 1);
      if (!firstPlay.has(e.trackId)) firstPlay.set(e.trackId, e.playedAt);
      const tr = byId.get(e.trackId);
      if (tr && !artistFirst.has(tr.artist)) artistFirst.set(tr.artist, e.playedAt);
    }
    const [bestDay, bestCount] = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ id: "best-day", at: new Date(bestDay).getTime(), title: "Biggest listening day", detail: `${bestCount} plays in a single day` });

    // longest streak of consecutive listening days
    const days = [...perDay.keys()].sort();
    let best = 1, run = 1, bestEnd = days[0];
    for (let i = 1; i < days.length; i++) {
      run = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / DAY === 1 ? run + 1 : 1;
      if (run > best) { best = run; bestEnd = days[i]; }
    }
    if (best >= 3) out.push({ id: "streak", at: new Date(bestEnd).getTime(), title: `${best}-day listening streak`, detail: "Music every single day" });

    // new artists discovered in the last 30 days
    const recentArtists = [...artistFirst.entries()].filter(([, at]) => at > Date.now() - 30 * DAY && events.length > 30).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [artist, at] of recentArtists) out.push({ id: `artist-${artist}`, at, title: `Discovered ${artist}`, detail: "First time you played them" });

    // most replayed track and its first play
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.trackId, (counts.get(e.trackId) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topTrack = byId.get(top[0]);
    if (topTrack && top[1] >= 3) out.push({ id: "top", at: firstPlay.get(top[0]) ?? Date.now(), title: `“${topTrack.title}” became a favourite`, detail: `${top[1]} plays since you first heard it`, track: topTrack });
    return out.sort((a, b) => b.at - a.at);
  }, [events, tracks]);

  const fmt = (at: number) => new Date(at).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  if (highlights.length === 0 && fx.markers.length === 0) return null;
  return (
    <section className="home-page__rail">
      <h2>{t("home.highlights")}</h2>
      <ol className="home-timeline">
        {highlights.map((h) => (
          <li key={h.id}>
            <time>{fmt(h.at)}</time>
            <div>
              <strong>{h.title}</strong>
              <small>{h.detail}</small>
              {h.track && <button type="button" onClick={() => playTrack(h.track!, tracks)}>▶ Play it again</button>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// -------------------------------------------------------------------------------------------- Listening Diary

// const MOODS = ["😊", "😌", "🔥", "😢", "🎉", "🌙"];
const MOODS = [
  { id: "happy", src: "/assets/media/images/icons/general/diary/happy.png", label: "Happy" },
  { id: "calm", src: "/assets/media/images/icons/general/diary/calm.png", label: "Calm" },
  { id: "fire", src: "/assets/media/images/icons/general/diary/fire.png", label: "Energetic" },
  { id: "sad", src: "/assets/media/images/icons/general/diary/sad.png", label: "Sad" },
  { id: "celebration", src: "/assets/media/images/icons/general/diary/celebration.png", label: "Celebration" },
  { id: "night", src: "/assets/media/images/icons/general/diary/night.png", label: "Night" },
] as const;

const DEFAULT_MOOD = "diary";
const DEFAULT_MOOD_SRC = "/assets/media/images/icons/general/diary/diary.png";

// interface DiaryEntry { note: string; mood: string }
interface DiaryEntry {
  note: string;
  mood: string;
}

export function ListeningDiary() {
  const t = useT();
  const locale = useLocaleTag();
  const { events } = usePlaybackHistory();
  const { tracks } = useLibrary();
  const [entries, setEntries] = useSharedSetting<Record<string, DiaryEntry>>("diary", {});
  const [openDay, setOpenDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const map = new Map<string, { plays: number; tracks: Map<string, number>; artists: Map<string, number> }>();
    for (const e of events) {
      const k = dayKey(e.playedAt);
      const d = map.get(k) ?? { plays: 0, tracks: new Map(), artists: new Map() };
      d.plays++;
      d.tracks.set(e.trackId, (d.tracks.get(e.trackId) ?? 0) + 1);
      const tr = byId.get(e.trackId);
      if (tr) d.artists.set(tr.artist, (d.artists.get(tr.artist) ?? 0) + 1);
      map.set(k, d);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14).map(([key, d]) => {
      const topT = [...d.tracks.entries()].sort((a, b) => b[1] - a[1])[0];
      const topA = [...d.artists.entries()].sort((a, b) => b[1] - a[1])[0];
      return { key, plays: d.plays, top: byId.get(topT[0]), artist: topA?.[0] };
    });
  }, [events, tracks]);

  if (days.length === 0) return null;
  return (
    <section className="home-page__rail">
      <h2>{t("home.diary")}</h2>
      <div className="home-diary">
        {days.map((d) => {
          const entry = entries[d.key];
          const date = new Date(d.key + "T12:00:00").toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
          return (
            <article key={d.key} className="home-diary__entry" data-open={openDay === d.key}>
              <button type="button" onClick={() => setOpenDay(openDay === d.key ? null : d.key)}>
                {/*<span className="home-diary__mood">{entry?.mood ?? "📖"}</span>*/}
                <img className="home-diary__mood"
                  src={
                    MOODS.find((m) => m.id === entry?.mood)?.src ??
                    DEFAULT_MOOD_SRC
                  }
                  alt={MOODS.find((m) => m.id === entry?.mood)?.label ?? "Listening diary"}
                  width={24}
                  height={24}
                /> 
                <span className="home-diary__date">{date}</span>
                <span className="home-diary__summary">{d.plays} plays{d.artist ? ` · mostly ${d.artist}` : ""}{d.top ? ` · “${d.top.title}” on repeat` : ""}</span>
              </button>
              {openDay === d.key && (
                <div className="home-diary__edit">
                  {/*<div>{MOODS.map((m) => <button key={m} type="button" data-active={entry?.mood === m} onClick={() => setEntries((all) => ({ ...all, [d.key]: { note: all[d.key]?.note ?? "", mood: m } }))}>{m}</button>)}</div>*/}
                  <div className="home-diary__mood-picker">
                    {MOODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-label={m.label}
                        title={m.label}
                        data-active={entry?.mood === m.id}
                        onClick={() =>
                          setEntries((all) => ({
                            ...all,
                            [d.key]: {
                              note: all[d.key]?.note ?? "",
                              mood: m.id,
                            },
                          }))
                        }
                      >
                        <img src={m.src} alt="" width={24} height={24} />
                      </button>
                    ))}
                  </div>
                  <textarea rows={2} placeholder="How did the music feel today?" value={entry?.note ?? ""} onChange={(e) => setEntries((all) => ({ ...all, [d.key]: { mood: all[d.key]?.mood ?? DEFAULT_MOOD, note: e.target.value } }))} /> {/*mood: all[d.key]?.mood ?? "📖",*/}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------- Cover Battle
export function CoverBattle() {
  const t = useT();
  const { tracks, updateTrack } = useLibrary();
  const { push } = useNotifications();
  const [album, setAlbum] = useState<{ name: string; artist: string; tracks: Track[] } | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);

  const albums = useMemo(() => {
    const map = new Map<string, { name: string; artist: string; tracks: Track[] }>();
    for (const tr of tracks) {
      if (!tr.path || !tr.album || tr.album === "Unknown album") continue;
      const k = `${tr.artist}|${tr.album}`;
      const a = map.get(k) ?? { name: tr.album, artist: tr.artist, tracks: [] };
      a.tracks.push(tr);
      map.set(k, a);
    }
    return [...map.values()];
  }, [tracks]);

  const start = async () => {
    if (albums.length === 0) return push("Cover Battle", "Needs local albums with album names and artists.");
    // Prefer albums that don't have artwork yet — that's where a better cover helps most.
    const pool = albums.filter((a) => !a.tracks.some((x) => x.artworkUrl));
    const pick = (pool.length ? pool : albums)[Math.floor(Math.random() * (pool.length ? pool.length : albums.length))];
    setBusy(true);
    try {
      const urls = await mbCoverCandidates(pick.artist, pick.name, 8);
      if (urls.length < 2) throw new Error("Not enough covers found online for this album — try again for another one.");
      setAlbum(pick);
      setCandidates(urls);
      setRound(0);
    } catch (e) {
      push("Cover Battle", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const left = candidates[round];
  const right = candidates[round + 1];
  const crown = async (winnerUrl: string) => {
    if (!album) return;
    const next = round + 2;
    const challenger = candidates[next];
    if (challenger) {
      // winner stays on the left; the next contender comes in
      setCandidates((c) => [winnerUrl, ...c.slice(next)]);
      setRound(0);
      return;
    }
    setBusy(true);
    try {
      const file = await downloadToTemp(winnerUrl, `battle-${Date.now()}`);
      for (const tr of album.tracks) await writeMetadata(tr.path, { coverPath: file });
      for (const tr of album.tracks) updateTrack(tr.id, { artworkUrl: previewSrc(file) });
      push("Cover chosen", `New artwork embedded in ${album.tracks.length} track(s) of “${album.name}”.`);
      setAlbum(null);
    } catch (e) {
      push("Couldn't save the cover", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="home-page__rail">
      <h2>{t("home.coverBattle")}</h2>
      {!album ? (
        <div className="cover-battle__intro">
          <p>Two covers enter, one wins. The champion is embedded in every track of the album.</p>
          <button type="button" className="settings__update-btn" disabled={busy || albums.length === 0} onClick={() => void start()}>{busy ? "Finding contenders…" : "Start a battle"}</button>
        </div>
      ) : (
        <div className="cover-battle">
          <p><strong>{album.name}</strong> — {album.artist} · round {Math.floor(round / 2) + 1}</p>
          <div className="cover-battle__arena">
            {[left, right].filter(Boolean).map((u) => (
              <button key={u} type="button" disabled={busy} onClick={() => void crown(u!)}><img src={u} alt="Cover candidate" onError={(e) => (e.currentTarget.style.opacity = "0.2")} /></button>
            ))}
          </div>
          <button type="button" className="pers__chip" onClick={() => setAlbum(null)}>Leave battle</button>
        </div>
      )}
    </section>
  );
}
