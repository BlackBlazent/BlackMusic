import { useEffect, useState } from "react";
import { useServices } from "@/app/context/ServicesContext";
import { SERVICE_DIRECTORY } from "@/lib/services/serviceDirectory";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { fetchSpotify } from "@/lib/services/spotifyClient";
import { isSpotifyTrackId } from "@/lib/services/spotifyPlayerBridge";
import { fetchAudiusTrending, audiusStreamUrl, type AudiusTrack } from "@/lib/services/audiusClient";
import { formatDuration } from "@/lib/formatDuration";
import { SkeletonRows } from "@/app/components/Skeleton";
import { PlayIcon } from "@/app/layout/icons";
import type { Track } from "@/lib/types";
import "./Online.css";

interface SpotifySavedTracksResponse {
  items: { track: { id: string; name: string; artists: { name: string }[]; album: { name: string }; duration_ms: number } }[];
}

export function Online() {
  const { activeServiceId, connectedIds } = useServices();
  const service = SERVICE_DIRECTORY.find((s) => s.id === activeServiceId);
  const isConnected = connectedIds.has(activeServiceId);

  const { tracks: localTracks } = useLibrary();
  const { playTrack } = usePlayback();

  const [remoteTracks, setRemoteTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) return;
    if (activeServiceId === "bmusic") return; // uses localTracks directly, no fetch needed

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (activeServiceId === "spotify") {
          const data = await fetchSpotify<SpotifySavedTracksResponse>("/me/tracks?limit=30");
          if (cancelled) return;
          if (!data) {
            setError("Couldn't load your Spotify library — try reconnecting from the logo menu.");
            setRemoteTracks([]);
            return;
          }
          setRemoteTracks(
            data.items.map((item) => ({
              // A real `spotify:track:<id>` URI, not just a made-up prefix — this is
              // exactly what the Web Playback SDK needs to start playback with, so
              // playing one of these just works without any extra lookup.
              id: `spotify:track:${item.track.id}`,
              path: "",
              title: item.track.name,
              artist: item.track.artists.map((a) => a.name).join(", "),
              album: item.track.album.name,
              duration: item.track.duration_ms / 1000,
              sourceUrl: "", // Spotify plays through the Web Playback SDK bridge, not a plain <audio src>.
              addedAt: Date.now(),
            })),
          );
        } else if (activeServiceId === "audius") {
          const trending = await fetchAudiusTrending();
          if (cancelled) return;
          setRemoteTracks(
            trending.map((t: AudiusTrack) => ({
              id: `audius:${t.id}`,
              path: "",
              title: t.title,
              artist: t.user.name,
              album: t.genre ?? "",
              duration: t.duration,
              sourceUrl: audiusStreamUrl(t.id),
              artworkUrl: t.artwork?.["480x480"] ?? t.artwork?.["150x150"],
              addedAt: Date.now(),
            })),
          );
        }
      } catch {
        if (!cancelled) setError(`Couldn't reach ${service?.name ?? "this service"} — check your connection.`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeServiceId, isConnected, service?.name]);

  if (!isConnected) {
    return (
      <div className="online-page">
        <h1>Online</h1>
        <div className="online-page__disconnected">
          <p>
            {service?.name ?? "This service"} isn't connected. Use the logo menu in the top-left corner
            of the sidebar to connect it — the dashboard here reflects whichever service you pick there.
          </p>
        </div>
      </div>
    );
  }

  const tracks = activeServiceId === "bmusic" ? localTracks : remoteTracks;

  return (
    <div className="online-page">
      <h1>Online — {service?.name}</h1>

      {activeServiceId === "spotify" && tracks.length > 0 && (
        <p className="online-page__notice">
          Plays through Spotify's Web Playback SDK — requires a Spotify Premium account (their
          restriction, not ours) and the desktop or mobile Spotify app to be closed, or this device
          may not get picked as the active one.
        </p>
      )}

      {loading && <SkeletonRows count={6} />}
      {error && <p className="online-page__error">{error}</p>}

      {!loading && !error && (
        <div className="online-page__table">
          <div className="online-page__row online-page__row--head">
            <span />
            <span>Title</span>
            <span>Artist</span>
            <span>Album</span>
            <span>Duration</span>
          </div>
          {tracks.slice(0, 50).map((track) => {
            const playable = Boolean(track.sourceUrl) || isSpotifyTrackId(track.id);
            return (
              <div key={track.id} className="online-page__row" onDoubleClick={() => playable && playTrack(track, tracks)}>
                <button type="button" disabled={!playable} onClick={() => playable && playTrack(track, tracks)}>
                  <PlayIcon />
                </button>
                <span>{track.title}</span>
                <span>{track.artist}</span>
                <span>{track.album}</span>
                <span>{formatDuration(track.duration)}</span>
              </div>
            );
          })}
          {tracks.length === 0 && <p className="online-page__empty">Nothing to show from {service?.name} yet.</p>}
        </div>
      )}
    </div>
  );
}
