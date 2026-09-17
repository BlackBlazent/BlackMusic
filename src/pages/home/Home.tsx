import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { formatDuration } from "@/lib/formatDuration";
import { SkeletonRows } from "@/app/components/Skeleton";
import { mostPlayed, neverPlayed, playedInLastNDays, recentlyPlayed } from "./homeStats";
import type { Track } from "@/lib/types";
import "./Home.css";

export function Home() {
  const { tracks, scanning, ready } = useLibrary();
  const { events } = usePlaybackHistory();
  const { playTrack } = usePlayback();

  const stats = useMemo(
    () => ({
      recent: recentlyPlayed(events, tracks, 6),
      top: mostPlayed(events, tracks, 6),
      last7: playedInLastNDays(events, 7),
      last30: playedInLastNDays(events, 30),
      unplayed: neverPlayed(events, tracks).slice(0, 6),
    }),
    [events, tracks],
  );

  if (!ready || (tracks.length === 0 && scanning)) {
    return (
      <div className="home-page">
        <h1>Home</h1>
        <SkeletonRows count={5} />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="home-page">
        <h1>Home</h1>
        <p className="home-page__empty">
          Nothing to show yet — add a watched folder in{" "}
          <Link to="/folder">Folders</Link> and it'll show up here once you start listening.
        </p>
      </div>
    );
  }

  return (
    <div className="home-page">
      <h1>Home</h1>

      <div className="home-page__stat-row">
        <div className="home-page__stat">
          <span className="home-page__stat-value">{stats.last7}</span>
          <span className="home-page__stat-label">Plays this week</span>
        </div>
        <div className="home-page__stat">
          <span className="home-page__stat-value">{stats.last30}</span>
          <span className="home-page__stat-label">Plays last 30 days</span>
        </div>
        <div className="home-page__stat">
          <span className="home-page__stat-value">{tracks.length}</span>
          <span className="home-page__stat-label">Tracks in library</span>
        </div>
      </div>

      <TrackRail title="Last played" tracks={stats.recent} onPlay={(t) => playTrack(t, tracks)} />
      <TrackRail
        title="Most played"
        tracks={stats.top.map((e) => e.track)}
        subtitles={stats.top.map((e) => `${e.count} plays`)}
        onPlay={(t) => playTrack(t, tracks)}
      />
      <TrackRail
        title="Haven't played yet"
        tracks={stats.unplayed}
        onPlay={(t) => playTrack(t, tracks)}
      />
    </div>
  );
}

function TrackRail({
  title,
  tracks,
  subtitles,
  onPlay,
}: {
  title: string;
  tracks: Track[];
  subtitles?: string[];
  onPlay: (track: Track) => void;
}) {
  if (tracks.length === 0) return null;
  return (
    <section className="home-page__rail">
      <h2>{title}</h2>
      <div className="home-page__rail-items">
        {tracks.map((track, i) => (
          <button type="button" key={track.id} className="rail-item" onClick={() => onPlay(track)}>
            <span className="rail-item__art">
              {track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : null}
            </span>
            <span className="rail-item__title">{track.title}</span>
            <span className="rail-item__subtitle">{subtitles?.[i] ?? formatDuration(track.duration)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
