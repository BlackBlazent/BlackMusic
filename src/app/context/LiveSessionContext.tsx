import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePlayback } from "./PlaybackContext";
import { useLibrary } from "./LibraryContext";
import { useNotifications } from "./NotificationsContext";
import { joinChannel, joinLanChannel, makeCode, normalizeCode, type LiveHandle, type LiveMessage, type LiveSong } from "@/lib/live/liveChannel";
import { fingerprintAll, trackFingerprint } from "@/lib/sync/fingerprint";
import type { Track } from "@/lib/types";

/**
 * FEAT-03c Music Meet Room (shared party queue) + FEAT-03d Session Share (mirror play/pause with a friend).
 * Every device plays ITS OWN copy of a song, matched by fingerprint (title/artist/album/length). A song a device doesn't have is
 * listed as "not on this device" and skipped — nothing is uploaded or streamed between devices by this feature.
 */
export type SessionKind = "room" | "share";
export interface Member { id: string; name: string }
export interface LiveSessionValue {
  active: { kind: SessionKind; code: string; lan?: { address: string; hosting: boolean } } | null;
  members: Member[];
  roomQueue: (LiveSong & { available: boolean })[];
  busy: boolean;
  error: string | null;
  start: (kind: SessionKind, displayName: string) => Promise<void>;
  join: (kind: SessionKind, code: string, displayName: string) => Promise<void>;
  /** Same-Wi-Fi room (no internet). `host` starts the room on this computer; otherwise join the host's address. */
  startLan: (displayName: string) => Promise<void>;
  joinLan: (address: string, code: string, displayName: string) => Promise<void>;
  leave: () => Promise<void>;
  addToRoom: (track: Track) => void;
}

const Ctx = createContext<LiveSessionValue | null>(null);
const toSong = async (t: Track): Promise<LiveSong> => ({ fp: await trackFingerprint(t), title: t.title, artist: t.artist, album: t.album, duration: t.duration });

export function LiveSessionProvider({ children }: { children: ReactNode }) {
  const { tracks } = useLibrary();
  const { currentTrack, isPlaying, position, playTrack, togglePlay, seek } = usePlayback();
  const { push } = useNotifications();
  const [active, setActive] = useState<LiveSessionValue["active"]>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [queue, setQueue] = useState<LiveSong[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = useRef(crypto.randomUUID());
  const myName = useRef("Me");
  const handle = useRef<LiveHandle | null>(null);
  const hosting = useRef(false);
  const fpIndex = useRef<Map<string, Track>>(new Map());
  const quiet = useRef(0); // until this time, local changes were caused by a remote message — don't echo them back
  const warned = useRef(new Set<string>());
  const latest = useRef({ currentTrack, isPlaying, position, tracks, queue });
  latest.current = { currentTrack, isPlaying, position, tracks, queue };

  // fingerprint → local track (rebuilt when the library changes and a session is open)
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void fingerprintAll(tracks).then((m) => {
      if (!alive) return;
      const idx = new Map<string, Track>();
      for (const t of tracks) { const fp = m.get(t.id); if (fp && !idx.has(fp)) idx.set(fp, t); }
      fpIndex.current = idx;
    });
    return () => { alive = false; };
  }, [active, tracks]);

  const playlistFromQueue = (q: LiveSong[]) => q.map((s) => fpIndex.current.get(s.fp)).filter((t): t is Track => Boolean(t));

  const onMessage = useCallback((m: LiveMessage) => {
    const markRemote = () => { quiet.current = Date.now() + 2500; };
    switch (m.t) {
      case "hello":
        setMembers((p) => (p.some((x) => x.id === m.id) ? p : [...p, { id: m.id, name: m.name }]));
        // answer so the newcomer learns who is here and what the queue is
        handle.current?.send({ t: "hello", id: me.current, name: myName.current });
        handle.current?.send({ t: "queue-sync", id: me.current, queue: latest.current.queue });
        break;
      case "bye":
        setMembers((p) => p.filter((x) => x.id !== m.id));
        break;
      case "queue-add":
        setQueue((q) => (q.some((s) => s.fp === m.song.fp) ? q : [...q, m.song]));
        push("Added to the room", `${m.by} added “${m.song.title}”.`);
        break;
      case "queue-sync":
        setQueue((q) => (m.queue.length >= q.length ? m.queue : q));
        break;
      case "seek": {
        markRemote();
        seek(m.position + (latest.current.isPlaying ? (Date.now() - m.sentAt) / 1000 : 0));
        break;
      }
      case "state": {
        markRemote();
        const want = m.song ? fpIndex.current.get(m.song.fp) : undefined;
        if (m.song && !want) {
          if (!warned.current.has(m.song.fp)) { warned.current.add(m.song.fp); push("Not on this device", `“${m.song.title}” by ${m.song.artist} isn't in your library, so it can't play here.`); }
          return;
        }
        const cur = latest.current;
        if (want && cur.currentTrack?.id !== want.id) {
          playTrack(want, playlistFromQueue(cur.queue).length ? playlistFromQueue(cur.queue) : [want]);
        }
        if (cur.isPlaying !== m.playing) togglePlay();
        const target = m.position + (m.playing ? (Date.now() - m.sentAt) / 1000 : 0);
        if (Math.abs(cur.position - target) > 2.5) seek(target);
        break;
      }
    }
  }, [playTrack, togglePlay, seek, push]); // eslint-disable-line react-hooks/exhaustive-deps

  // outgoing: what THIS device did (song change, play/pause)
  const lastSent = useRef("");
  useEffect(() => {
    if (!active || !handle.current || Date.now() < quiet.current) return;
    let alive = true;
    void (async () => {
      const song = currentTrack ? await toSong(currentTrack) : null;
      if (!alive || Date.now() < quiet.current) return;
      const key = `${song?.fp}|${isPlaying}`;
      if (key === lastSent.current) return;
      lastSent.current = key;
      handle.current?.send({ t: "state", id: me.current, song, playing: isPlaying, position: latest.current.position, sentAt: Date.now() });
    })();
    return () => { alive = false; };
  }, [active, currentTrack?.id, isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // outgoing: a user seek shows up as a jump in position bigger than what normal playback explains
  const prevPos = useRef({ p: 0, at: Date.now() });
  useEffect(() => {
    const now = Date.now();
    const expected = prevPos.current.p + (isPlaying ? (now - prevPos.current.at) / 1000 : 0);
    if (active && handle.current && Date.now() >= quiet.current && Math.abs(position - expected) > 3 && prevPos.current.at !== 0) {
      handle.current.send({ t: "seek", id: me.current, position, sentAt: now });
    }
    prevPos.current = { p: position, at: now };
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = useCallback(async () => {
    const h = handle.current;
    handle.current = null;
    h?.send({ t: "bye", id: me.current });
    await h?.leave().catch(() => undefined);
    if (hosting.current) { hosting.current = false; try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("lan_room_stop"); } catch { /* already stopped */ } }
    setActive(null); setMembers([]); setQueue([]); setError(null); lastSent.current = "";
  }, []);

  const connect = useCallback(async (kind: SessionKind, code: string, name: string) => {
    setBusy(true); setError(null);
    try {
      await leave();
      myName.current = name.trim().slice(0, 30) || "Guest";
      handle.current = await joinChannel(kind, code, onMessage);
      setActive({ kind, code });
      setMembers([{ id: me.current, name: myName.current }]);
      handle.current.send({ t: "hello", id: me.current, name: myName.current });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [leave, onMessage]);

  const connectLan = useCallback(async (address: string, code: string, name: string, host: boolean) => {
    setBusy(true); setError(null);
    try {
      await leave();
      myName.current = name.trim().slice(0, 30) || "Guest";
      let target = address;
      if (host) {
        const { invoke } = await import("@tauri-apps/api/core");
        const info = await invoke<{ ip: string; port: number }>("lan_room_start", { code });
        hosting.current = true;
        target = `${info.ip}:${info.port}`;
      }
      // the host connects to its own relay through the loopback address, everyone else through the host's Wi-Fi address
      handle.current = await joinLanChannel(host ? `127.0.0.1:${target.split(":")[1]}` : target, code, onMessage);
      setActive({ kind: "room", code, lan: { address: target, hosting: host } });
      setMembers([{ id: me.current, name: myName.current }]);
      handle.current.send({ t: "hello", id: me.current, name: myName.current });
    } catch (e) {
      if (hosting.current) { hosting.current = false; try { const { invoke } = await import("@tauri-apps/api/core"); await invoke("lan_room_stop"); } catch { /* ignore */ } }
      setError(e instanceof Error ? e.message : typeof e === "string" ? e : String(e));
    } finally {
      setBusy(false);
    }
  }, [leave, onMessage]);

  useEffect(() => () => void leave(), [leave]);

  const value = useMemo<LiveSessionValue>(() => ({
    active, members, busy, error,
    roomQueue: queue.map((s) => ({ ...s, available: fpIndex.current.has(s.fp) })),
    start: (kind, name) => connect(kind, makeCode(kind === "room" ? 6 : 10), name),
    join: (kind, code, name) => connect(kind, normalizeCode(code), name),
    startLan: (name) => connectLan("", makeCode(6), name, true),
    joinLan: (address, code, name) => connectLan(address, normalizeCode(code), name, false),
    leave,
    addToRoom: (track) => void toSong(track).then((song) => {
      setQueue((q) => (q.some((s) => s.fp === song.fp) ? q : [...q, song]));
      handle.current?.send({ t: "queue-add", id: me.current, by: myName.current, song });
    }),
  }), [active, members, busy, error, queue, connect, connectLan, leave]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveSession(): LiveSessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLiveSession must be used within a LiveSessionProvider");
  return v;
}
