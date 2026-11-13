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
import { useTracksWithExtras } from "@/lib/library/trackExtras";
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
interface Highlight { id: string; at: number; title: string; detail: string; queue: Track[] }

const uniqueTracks = (events: { trackId: string; playedAt: number }[], byId: Map<string, Track>, filter: (e: { trackId: string; playedAt: number }) => boolean): Track[] => {
  const counts = new Map<string, number>();
  for (const e of events) if (filter(e)) counts.set(e.trackId, (counts.get(e.trackId) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)).filter((x): x is Track => Boolean(x));
};

/** Every highlight is a touch target: tap to open it, play one song, or play them all. (IMP-03) */
export function MemoryHighlights() {
  const t = useT();
  const locale = useLocaleTag();
  const { events } = usePlaybackHistory();
  const { tracks } = useLibrary();
  const { playTrack } = usePlayback();
  const fx = useAudioFx();
  const [open, setOpen] = useState<string | null>(null);

  const highlights = useMemo<Highlight[]>(() => {
    if (events.length < 5) return [];
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const out: Highlight[] = [];
    const perDay = new Map<string, number>();
    const artistFirst = new Map<string, number>();
    for (const e of events) {
      perDay.set(dayKey(e.playedAt), (perDay.get(dayKey(e.playedAt)) ?? 0) + 1);
      const tr = byId.get(e.trackId);
      if (tr && !artistFirst.has(tr.artist)) artistFirst.set(tr.artist, e.playedAt);
    }
    const [bestDay, bestCount] = [...perDay.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({ id: "best-day", at: new Date(bestDay).getTime(), title: "Biggest listening day", detail: `${bestCount} plays in a single day`, queue: uniqueTracks(events, byId, (e) => dayKey(e.playedAt) === bestDay) });

    // longest streak of consecutive listening days
    const days = [...perDay.keys()].sort();
    let best = 1, run = 1, bestEnd = days[0], bestStartIdx = 0;
    for (let i = 1; i < days.length; i++) {
      run = (new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / DAY === 1 ? run + 1 : 1;
      if (run > best) { best = run; bestEnd = days[i]; bestStartIdx = i - run + 1; }
    }
    if (best >= 3) {
      const span = new Set(days.slice(bestStartIdx, bestStartIdx + best));
      out.push({ id: "streak", at: new Date(bestEnd).getTime(), title: `${best}-day listening streak`, detail: "Music every single day", queue: uniqueTracks(events, byId, (e) => span.has(dayKey(e.playedAt))) });
    }

    // new artists discovered in the last 30 days
    const recentArtists = [...artistFirst.entries()].filter(([, at]) => at > Date.now() - 30 * DAY && events.length > 30).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [artist, at] of recentArtists) out.push({ id: `artist-${artist}`, at, title: `Discovered ${artist}`, detail: "First time you played them", queue: tracks.filter((x) => x.artist === artist) });

    // most replayed track
    const counts = new Map<string, number>();
    const firstPlay = new Map<string, number>();
    for (const e of events) { counts.set(e.trackId, (counts.get(e.trackId) ?? 0) + 1); if (!firstPlay.has(e.trackId)) firstPlay.set(e.trackId, e.playedAt); }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topTrack = byId.get(top[0]);
    if (topTrack && top[1] >= 3) out.push({ id: "top", at: firstPlay.get(top[0]) ?? Date.now(), title: `“${topTrack.title}” became a favourite`, detail: `${top[1]} plays since you first heard it`, queue: [topTrack] });

    // "On this day": what you were playing on this date in earlier years (or the same day-of-month in earlier months)
    const now = new Date();
    const sameDay = (at: number) => { const d = new Date(at); return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear(); };
    const past = uniqueTracks(events, byId, (e) => sameDay(e.playedAt));
    if (past.length) out.push({ id: "on-this-day", at: Date.now() - 1, title: "On this day", detail: `You played ${past.length} song${past.length === 1 ? "" : "s"} on this date in a past year`, queue: past });

    // most-played artist in the last 30 days
    const recent = uniqueTracks(events, byId, (e) => e.playedAt > Date.now() - 30 * DAY);
    if (recent.length >= 3) {
      const byArtist = new Map<string, Track[]>();
      recent.forEach((x) => (byArtist.get(x.artist) ?? byArtist.set(x.artist, []).get(x.artist)!).push(x));
      const [artist, list] = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      if (list.length >= 2) out.push({ id: "artist-month", at: Date.now() - 2, title: `${artist} was your artist this month`, detail: `${list.length} of their songs on repeat`, queue: list });
    }
    return out.filter((h) => h.queue.length > 0).sort((a, b) => b.at - a.at);
  }, [events, tracks]);

  const fmt = (at: number) => new Date(at).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  if (highlights.length === 0 && fx.markers.length === 0) return null;
  return (
    <section className="home-page__rail">
      <h2>{t("home.highlights")}</h2>
      <ol className="home-timeline">
        {highlights.map((h) => (
          <li key={h.id} data-open={open === h.id}>
            <time>{fmt(h.at)}</time>
            <div className="home-timeline__card">
              <button type="button" className="home-timeline__head" aria-expanded={open === h.id} onClick={() => setOpen(open === h.id ? null : h.id)}>
                <span><strong>{h.title}</strong><small>{h.detail}</small></span>
                <span className="home-timeline__chev" aria-hidden>{open === h.id ? "▾" : "▸"}</span>
              </button>
              {open === h.id && (
                <div className="home-timeline__body">
                  <button type="button" className="home-timeline__playall" onClick={() => playTrack(h.queue[0], h.queue)}>▶ Play {h.queue.length > 1 ? `all ${h.queue.length}` : "it"}</button>
                  {h.queue.length > 1 && (
                    <ul>
                      {h.queue.slice(0, 8).map((x) => (
                        <li key={x.id}><button type="button" onClick={() => playTrack(x, h.queue)}><span>{x.title}</span><small>{x.artist}</small></button></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// -------------------------------------------------------------------------------------------- Listening Diary

const MOODS = [
  { id: "happy", src: "/assets/media/images/icons/general/diary/happy.svg", label: "Happy" },
  { id: "calm", src: "/assets/media/images/icons/general/diary/calm.svg", label: "Calm" },
  { id: "fire", src: "/assets/media/images/icons/general/diary/fire.svg", label: "Energetic" },
  { id: "sad", src: "/assets/media/images/icons/general/diary/sad.svg", label: "Sad" },
  { id: "celebration", src: "/assets/media/images/icons/general/diary/celebration.svg", label: "Celebration" },
  { id: "night", src: "/assets/media/images/icons/general/diary/night.svg", label: "Night" },
] as const;

const DEFAULT_MOOD = "diary";
const DEFAULT_MOOD_SRC = "/assets/media/images/icons/general/diary/diary.svg";
/** Diary mood → words a song's own Mood tag might use (Edit metadata → Mood). */
const MOOD_WORDS: Record<string, string[]> = { happy: ["happy", "party", "energetic"], calm: ["chill", "calm", "focus", "sleep"], fire: ["energetic", "workout", "party"], sad: ["sad", "romantic"], celebration: ["party", "happy", "worship"], night: ["chill", "sleep", "romantic"] };

interface DiaryEntry { note: string; mood: string }

/**
 * The diary now does more than record: every day lists what you heard (tap to play), a "play this day" button, and picks of songs
 * you'd probably love — from artists, albums and genres you played that day, plus songs whose Mood matches the mood you noted.
 * "Music you may love" at the top draws on your last 30 days. All of it is computed on this device from your own library.
 */
export function ListeningDiary() {
  const t = useT();
  const locale = useLocaleTag();
  const { events } = usePlaybackHistory();
  const { tracks: libraryTracks } = useLibrary();
  const tracks = useTracksWithExtras(libraryTracks);
  const { playTrack } = usePlayback();
  const [entries, setEntries] = useSharedSetting<Record<string, DiaryEntry>>("diary", {});
  const [openDay, setOpenDay] = useState<string | null>(null);

  const model = useMemo(() => {
    const byId = new Map(tracks.map((x) => [x.id, x]));
    const playCount = new Map<string, number>();
    const lastPlayed = new Map<string, number>();
    for (const e of events) { playCount.set(e.trackId, (playCount.get(e.trackId) ?? 0) + 1); lastPlayed.set(e.trackId, Math.max(lastPlayed.get(e.trackId) ?? 0, e.playedAt)); }
    const stale = (x: Track) => Date.now() - (lastPlayed.get(x.id) ?? 0) > 14 * DAY; // not played in two weeks (or never)

    const map = new Map<string, { plays: number; seconds: number; tracks: Map<string, number>; artists: Map<string, number> }>();
    for (const e of events) {
      const k = dayKey(e.playedAt);
      const d = map.get(k) ?? { plays: 0, seconds: 0, tracks: new Map(), artists: new Map() };
      d.plays++;
      d.tracks.set(e.trackId, (d.tracks.get(e.trackId) ?? 0) + 1);
      const tr = byId.get(e.trackId);
      if (tr) { d.seconds += tr.duration || 0; d.artists.set(tr.artist, (d.artists.get(tr.artist) ?? 0) + 1); }
      map.set(k, d);
    }

    /** Songs you haven't played lately that share an artist / album / genre with `seeds`. */
    const suggest = (seeds: Track[], exclude: Set<string>, limit: number, moods?: string[]): Track[] => {
      const artists = new Set(seeds.map((x) => x.artist)), albums = new Set(seeds.map((x) => x.album)), genres = new Set(seeds.map((x) => x.genre).filter(Boolean));
      const scored = tracks.filter((x) => !exclude.has(x.id) && stale(x)).map((x) => {
        let score = 0;
        if (artists.has(x.artist)) score += 3;
        if (albums.has(x.album) && x.album !== "Unknown album") score += 2;
        if (x.genre && genres.has(x.genre)) score += 1;
        if (moods && x.mood && moods.includes(x.mood.toLowerCase())) score += 3;
        return { x, score: score + (playCount.get(x.id) ? 0.5 : 0) };
      }).filter((r) => r.score >= 1);
      return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.x);
    };

    const rows = [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14).map(([key, d]) => {
      const heard = [...d.tracks.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id)).filter((x): x is Track => Boolean(x));
      const topA = [...d.artists.entries()].sort((a, b) => b[1] - a[1])[0];
      return { key, plays: d.plays, minutes: Math.round(d.seconds / 60), heard, top: heard[0], artist: topA?.[0] };
    });

    // "Music you may love": seeded by the last 30 days
    const recentSeeds = uniqueTracks(events, byId, (e) => e.playedAt > Date.now() - 30 * DAY).slice(0, 25);
    const forYou = suggest(recentSeeds, new Set(recentSeeds.slice(0, 8).map((x) => x.id)), 8);
    return { rows, suggest, forYou };
  }, [events, tracks]);

  if (model.rows.length === 0) return null;
  const mini = (x: Track, queue: Track[]) => (
    <li key={x.id}><button type="button" onClick={() => playTrack(x, queue)} title={`Play ${x.title}`}><span>{x.title}</span><small>{x.artist}</small></button></li>
  );
  return (
    <section className="home-page__rail">
      <h2>{t("home.diary")}</h2>

      {model.forYou.length > 0 && (
        <div className="home-diary__loved">
          <div className="home-diary__loved-head">
            <strong>Music you may love</strong>
            <small>From artists and genres you've been playing — not heard in a while</small>
            <button type="button" onClick={() => playTrack(model.forYou[0], model.forYou)}>▶ Play all</button>
          </div>
          <ul className="home-diary__list">{model.forYou.map((x) => mini(x, model.forYou))}</ul>
        </div>
      )}

      <div className="home-diary">
        {model.rows.map((d) => {
          const entry = entries[d.key];
          const date = new Date(d.key + "T12:00:00").toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
          const isOpen = openDay === d.key;
          const picks = isOpen ? model.suggest(d.heard.slice(0, 6), new Set(d.heard.map((x) => x.id)), 6, entry?.mood ? MOOD_WORDS[entry.mood] : undefined) : [];
          return (
            <article key={d.key} className="home-diary__entry" data-open={isOpen}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpenDay(isOpen ? null : d.key)}>
                <img className="home-diary__mood" src={MOODS.find((m) => m.id === entry?.mood)?.src ?? DEFAULT_MOOD_SRC} alt={MOODS.find((m) => m.id === entry?.mood)?.label ?? "Listening diary"} width={24} height={24} />
                <span className="home-diary__date">{date}</span>
                <span className="home-diary__summary">{d.plays} plays{d.minutes ? ` · ${d.minutes} min` : ""}{d.artist ? ` · mostly ${d.artist}` : ""}{d.top ? ` · “${d.top.title}” on repeat` : ""}</span>
              </button>
              {isOpen && (
                <div className="home-diary__edit">
                  <div className="home-diary__mood-picker">
                    {MOODS.map((m) => (
                      <button key={m.id} type="button" aria-label={m.label} title={m.label} data-active={entry?.mood === m.id}
                        onClick={() => setEntries((all) => ({ ...all, [d.key]: { note: all[d.key]?.note ?? "", mood: m.id } }))}>
                        <img src={m.src} alt="" width={24} height={24} />
                      </button>
                    ))}
                  </div>
                  <textarea rows={2} placeholder="How did the music feel today?" value={entry?.note ?? ""} onChange={(e) => setEntries((all) => ({ ...all, [d.key]: { mood: all[d.key]?.mood ?? DEFAULT_MOOD, note: e.target.value } }))} />
                  {d.heard.length > 0 && (
                    <>
                      <div className="home-diary__sub"><strong>You listened to</strong><button className="home_play__this" type="button" onClick={() => playTrack(d.heard[0], d.heard)}>▶ Play this day</button></div>
                      <ul className="home-diary__list">{d.heard.slice(0, 6).map((x) => mini(x, d.heard))}</ul>
                    </>
                  )}
                  {picks.length > 0 && (
                    <>
                      <div className="home-diary__sub"><strong>{entry?.mood ? "More for this mood" : "You might also love"}</strong><button className="home_this__dairy" type="button" onClick={() => playTrack(picks[0], picks)}>▶ Play</button></div>
                      <ul className="home-diary__list">{picks.map((x) => mini(x, picks))}</ul>
                    </>
                  )}
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
