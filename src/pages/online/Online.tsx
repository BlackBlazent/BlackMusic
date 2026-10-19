import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useServices } from "@/app/context/ServicesContext";
import { useAuth } from "@/app/context/AuthContext";
import { SERVICE_DIRECTORY } from "@/lib/services/serviceDirectory";
import { useCustomApis } from "@/lib/services/useCustomApis";
import { CUSTOM_SERVICE_PREFIX } from "@/lib/services/customApis";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { isSpotifyTrackId } from "@/lib/services/spotifyPlayerBridge";
import { fetchServiceTracks, loadServiceKeys } from "@/lib/services/serviceRegistry";
import { useApiPromotions, useManualPromotions, promotionSlots } from "@/app/context/PromotionsContext";
import { PromotionRow, PromotionImage } from "@/app/components/Promotion";
import { formatDuration } from "@/lib/formatDuration";
import { SkeletonRows } from "@/app/components/Skeleton";
import { PlaygroundIcon } from "@/app/layout/icons";
import type { Track } from "@/lib/types";
import { buildSpotifyShelves, buildTrackShelves, isSpotifyAuthIssue, type Shelf, type ShelfItem } from "./shelves";
import { ShelfRow } from "./ShelfRow";
import "./Online.css";

type View = "shelves" | "list";

const SERVICE_NOTES: Record<string, string> = {
  spotify: "Plays through Spotify's Web Playback SDK — requires Spotify Premium and the desktop/mobile Spotify app to be closed so this device can become the active player.",
  lastfm: "Last.fm lists music but doesn't stream it — BlackMusic finds a playable stream for whatever you click.",
  youtube: "Plays the video's audio through the bundled yt-dlp; switch to Playground → Video to watch it.",
  tidal: "Tidal lists tracks; BlackMusic finds a playable stream for whatever you click.",
};

export function Online() {
  const { activeServiceId, connectedIds, connect, disconnect } = useServices();
  const { signInWithProvider } = useAuth();
  const { apis: customApis } = useCustomApis();
  const service =
    SERVICE_DIRECTORY.find((s) => s.id === activeServiceId) ??
    (activeServiceId.startsWith(CUSTOM_SERVICE_PREFIX)
      ? { id: activeServiceId, name: customApis.find((a) => `${CUSTOM_SERVICE_PREFIX}${a.id}` === activeServiceId)?.name ?? "Custom API", available: true }
      : undefined);
  const isConnected = connectedIds.has(activeServiceId);

  const { tracks: localTracks } = useLibrary();
  const { playTrack } = usePlayback();
  const { events } = usePlaybackHistory();
  const { push } = useNotifications();

  const [remoteTracks, setRemoteTracks] = useState<Track[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; reconnect: boolean } | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [view, setView] = useState<View>("shelves");
  const [busyId, setBusyId] = useState<string | null>(null);
  const promos = useApiPromotions("online");
  const hero = useManualPromotions("online-hero")[0];

  const recents = useMemo(() => {
    const byId = new Map(localTracks.map((t) => [t.id, t]));
    const seen = new Set<string>();
    const out: Track[] = [];
    for (let i = events.length - 1; i >= 0 && out.length < 16; i--) {
      const t = byId.get(events[i].trackId);
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
    return out;
  }, [events, localTracks]);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNeedsKey(false);
    setShelves([]);

    (async () => {
      try {
        if (activeServiceId === "bmusic") {
          const built = await buildTrackShelves([...localTracks].sort((a, b) => b.addedAt - a.addedAt), { serviceId: "bmusic", recents });
          if (!cancelled) {
            setRemoteTracks(localTracks);
            setShelves(built);
          }
        } else if (activeServiceId === "spotify") {
          const built = await buildSpotifyShelves();
          if (cancelled) return;
          setShelves(built);
          setRemoteTracks(built.flatMap((s) => s.items.map((i) => i.track).filter((t): t is Track => Boolean(t))));
        } else {
          const result = await fetchServiceTracks(activeServiceId, 50);
          if (cancelled) return;
          setNeedsKey(result.needsKey);
          setRemoteTracks(result.tracks);
          const keys = await loadServiceKeys();
          setShelves(await buildTrackShelves(result.tracks, { serviceId: activeServiceId, lastfmKey: keys.lastfm || (import.meta.env.VITE_LASTFM_API_KEY as string | undefined) }));
        }
      } catch (e) {
        console.error(`[online:${activeServiceId}]`, e);
        if (cancelled) return;
        setRemoteTracks([]);
        const detail = e instanceof Error ? e.message : String(e);
        if (activeServiceId === "spotify" && isSpotifyAuthIssue(e)) {
          setError({ message: `Couldn't load your Spotify library — ${detail}`, reconnect: true });
        } else {
          // 2.2.0: say what actually went wrong instead of always blaming the connection.
          setError({ message: `Couldn't load ${service?.name ?? "this service"}: ${detail}`, reconnect: false });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- localTracks/recents only matter for the BlackMusic catalog
  }, [activeServiceId, isConnected, service?.name, activeServiceId === "bmusic" ? localTracks.length : 0]);

  const playable = (t: Track) => Boolean(t.sourceUrl || t.path || t.resolve) || isSpotifyTrackId(t.id);

  const onActivate = useCallback(
    async (item: ShelfItem, shelf: Shelf) => {
      try {
        if (item.track) {
          const queue = shelf.items.map((i) => i.track).filter((t): t is Track => Boolean(t) && playable(t as Track));
          playTrack(item.track, queue.length ? queue : [item.track]);
        } else if (item.load) {
          setBusyId(item.id);
          const list = (await item.load()).filter(playable);
          if (!list.length) push("Nothing to play", `${item.title} has no playable tracks.`);
          else playTrack(list[0], list);
        } else if (item.href) {
          void openUrl(item.href);
        }
      } catch (e) {
        push("Couldn't open that", e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [playTrack, push], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const reconnectSpotify = async () => {
    disconnect("spotify");
    // forceConsent → Spotify shows its permission dialog again, so any newly-required scope is granted.
    await signInWithProvider("spotify", { forceConsent: true });
  };

  if (!isConnected) {
    return (
      <div className="online-page">
        <h1>Online</h1>
        <div className="online-page__disconnected">
          <p>
            {service?.name ?? "This service"} isn't connected. Use the logo menu in the top-left corner
            of the sidebar to connect it — the dashboard here reflects whichever service you pick there.
          </p>
          <button type="button" className="online-page__action" onClick={() => void connect(activeServiceId)}>Connect {service?.name}</button>
        </div>
      </div>
    );
  }

  const tracks = activeServiceId === "bmusic" ? localTracks : remoteTracks;

  return (
    <div className="online-page">
      <div className="online-page__titlebar">
        <h1>Online — {service?.name}</h1>
        <div className="online-page__views" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === "shelves"} data-active={view === "shelves"} onClick={() => setView("shelves")}>Browse</button>
          <button type="button" role="tab" aria-selected={view === "list"} data-active={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      {SERVICE_NOTES[activeServiceId] && tracks.length > 0 && <p className="online-page__notice">{SERVICE_NOTES[activeServiceId]}</p>}

      {needsKey && (
        <p className="online-page__notice">
          {service?.name} is ready to go — it just needs its API key. Add it to <code>environments</code> or paste it in{" "}
          Settings → Service API keys.
        </p>
      )}

      {loading && <SkeletonRows count={6} />}
      {error && (
        <div className="online-page__error">
          <p>{error.message}</p>
          {error.reconnect && (
            <button type="button" className="online-page__action" onClick={() => void reconnectSpotify()}>Reconnect Spotify</button>
          )}
        </div>
      )}

      {view === "shelves" && !loading && !error && (
        <>
          {/* "Getting started" banner — a placeholder for manually managed promotions (src/lib/promotions/manualPromotions.ts). */}
          <section className="online-hero">
            {hero ? (
              <button type="button" className="online-hero__card" onClick={() => { const u = hero.trackingUrl || hero.destinationUrl; if (u) void openUrl(u); }}>
                <span className="online-hero__text">
                  <small>Sponsored</small>
                  <strong>{hero.title}</strong>
                  {hero.description && <span>{hero.description}</span>}
                  <em>Learn more</em>
                </span>
                <span className="online-hero__art"><PromotionImage promotion={hero} /></span>
              </button>
            ) : (
              <div className="online-hero__card online-hero__card--placeholder" aria-label="Promotion placeholder">
                <span className="online-hero__text">
                  <small>Getting started</small>
                  <strong>Featured banner</strong>
                  <span>Reserved for a manually managed promotion. Enable the <code>online-hero</code> entry in manualPromotions.ts.</span>
                </span>
              </div>
            )}
          </section>

          {shelves.map((shelf) => (
            <ShelfRow key={shelf.id} shelf={shelf} onActivate={(i, s) => void onActivate(i, s)} busyId={busyId} />
          ))}
          {shelves.length === 0 && <p className="online-page__empty">Nothing to show from {service?.name} yet.</p>}
        </>
      )}

      {view === "list" && !loading && !error && (
        <div className="online-page__table">
          <div className="online-page__row online-page__row--head">
            <span />
            <span>Title</span>
            <span>Artist</span>
            <span>Album</span>
            <span>Duration</span>
          </div>
          {tracks.slice(0, 50).map((track, index) => {
            const playable = Boolean(track.sourceUrl) || isSpotifyTrackId(track.id);
            const slots = promotionSlots(Math.min(tracks.length, 50), promos.length, 4, 12);
            return (
              <Fragment key={track.id}>
                {slots.includes(index) && <PromotionRow promotion={promos[slots.indexOf(index)]} variant="online" />}
                <div className="online-page__row" onDoubleClick={() => playable && playTrack(track, tracks)}>
                  <button
                    type="button"
                    className="online-page__art"
                    disabled={!playable}
                    onClick={() => playable && playTrack(track, tracks)}
                    aria-label={`Play ${track.title}`}
                  >
                    {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" /> : <PlaygroundIcon />}
                  </button>
                  <span className="online-page__title">{track.title}</span>
                  <span>{track.artist}</span>
                  <span>{track.album}</span>
                  <span>{formatDuration(track.duration)}</span>
                </div>
              </Fragment>
            );
          })}
          {tracks.length === 0 && <p className="online-page__empty">Nothing to show from {service?.name} yet.</p>}
        </div>
      )}
    </div>
  );
}
