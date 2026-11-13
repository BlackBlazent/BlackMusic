import { getSupabaseClient } from "@/lib/supabaseClient";
import { readSharedSetting } from "@/lib/sharedSetting";
import { deviceId } from "./engine";
import type { Track } from "@/lib/types";

/**
 * FEAT-14 — device-to-device audio over WebRTC data channels.
 *   • Supabase Realtime (a PRIVATE channel, readable only by the signed-in owner) carries ONLY the connection set-up messages.
 *   • The audio bytes go straight from one of your devices to the other. They are never uploaded, stored, or relayed by a server,
 *     so the "no audio in Supabase" rule holds and nothing counts against Supabase limits.
 * Network note: two devices on the same Wi-Fi connect directly. Across the internet a public STUN server (default: Google's) helps
 * them find each other, and a strict NAT may need a TURN server — set one in Settings → Music Portable Sync → Connection.
 */
export interface IceConfig { urls: string; username?: string; credential?: string }
export const DEFAULT_ICE: IceConfig[] = [{ urls: "stun:stun.l.google.com:19302" }];
const iceServers = () => readSharedSetting<IceConfig[]>("sync.iceServers", DEFAULT_ICE);

const BLOCK = 256 * 1024; // read from disk this much at a time
const SLICE = 16 * 1024; // send this much per data-channel message (safe on every browser)
const HIGH_WATER = 1024 * 1024;
const OPEN_TIMEOUT_MS = 20_000;

type Signal =
  | { t: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { t: "ice"; from: string; to: string; cand: RTCIceCandidateInit };

export class P2PError extends Error {
  constructor(message: string, readonly kind: "offline" | "missing" | "network" | "unsupported" | "cancelled" | "other" = "other") {
    super(message);
    this.name = "P2PError";
  }
}

export const p2pSupported = () => typeof RTCPeerConnection !== "undefined";

// ---------------------------------------------------------------------------------------------------------------- signalling
interface Signaller { send: (s: Signal) => void; on: (fn: (s: Signal) => void) => () => void; close: () => Promise<void> }
let sharedSignaller: Promise<Signaller> | null = null;

async function openSignaller(): Promise<Signaller> {
  const client = await getSupabaseClient();
  if (!client) throw new P2PError("Device transfer needs the account service, which isn't configured in this build.", "unsupported");
  const { data } = await client.auth.getUser();
  if (!data.user) throw new P2PError("Sign in to transfer songs between your devices.", "other");
  try { await client.realtime.setAuth(); } catch { /* older client: it uses the session token itself */ }
  const listeners = new Set<(s: Signal) => void>();
  const channel = client.channel(`p2p:${data.user.id}`, { config: { private: true, broadcast: { self: false, ack: false } } });
  channel.on("broadcast", { event: "s" }, ({ payload }) => {
    const s = payload as Signal;
    if (s && s.to === deviceId()) listeners.forEach((l) => l(s));
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new P2PError("Couldn't reach the connection service. Check your internet.", "network")), 12_000);
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new P2PError(err?.message?.includes("policy") ? "The sync database migration hasn't been applied yet (private channel policy)." : "Couldn't reach the connection service. Check your internet.", "network")); }
    });
  });
  return {
    send: (s) => void channel.send({ type: "broadcast", event: "s", payload: s }),
    on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    close: async () => { await client.removeChannel(channel); sharedSignaller = null; },
  };
}
const signaller = () => (sharedSignaller ??= openSignaller().catch((e) => { sharedSignaller = null; throw e; }));

// ------------------------------------------------------------------------------------------------------------------- serving
const MIME: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", ogg: "audio/ogg", opus: "audio/ogg", wav: "audio/wav", wma: "audio/x-ms-wma" };
export const extOf = (path: string) => (path.split(".").pop() ?? "").toLowerCase();
export const mimeOf = (path: string) => MIME[extOf(path)] ?? "application/octet-stream";

async function readBlock(url: string, start: number, endInclusive: number): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${endInclusive}` } });
  if (!res.ok && res.status !== 206) throw new Error(`read failed (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // a server that ignores Range returns the whole file: cut out the part that was asked for
  return res.status === 206 ? buf : buf.subarray(start, endInclusive + 1);
}

async function serve(dc: RTCDataChannel, lookup: (fp: string) => Track | undefined) {
  let cancelled = false;
  dc.onmessage = async (ev) => {
    if (typeof ev.data !== "string") return;
    const msg = JSON.parse(ev.data) as { op: string; fp?: string };
    if (msg.op === "cancel") { cancelled = true; return; }
    if (msg.op !== "get" || !msg.fp) return;
    const track = lookup(msg.fp);
    if (!track) { dc.send(JSON.stringify({ op: "err", kind: "missing", message: "That song isn't on the other device any more." })); return; }
    try {
      let size = track.size ?? 0;
      if (!size) { const h = await fetch(track.sourceUrl, { headers: { Range: "bytes=0-0" } }); size = Number(h.headers.get("content-range")?.split("/")[1] ?? 0); }
      if (!size) throw new Error("size unknown");
      dc.send(JSON.stringify({ op: "meta", size, mime: mimeOf(track.path || track.sourceUrl), name: `${track.artist} - ${track.title}`, ext: extOf(track.path) || "mp3" }));
      dc.bufferedAmountLowThreshold = HIGH_WATER / 2;
      for (let off = 0; off < size && !cancelled; off += BLOCK) {
        const block = await readBlock(track.sourceUrl, off, Math.min(off + BLOCK, size) - 1);
        for (let i = 0; i < block.length && !cancelled; i += SLICE) {
          if (dc.bufferedAmount > HIGH_WATER) await new Promise<void>((r) => { dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; r(); }; });
          if (dc.readyState !== "open") return;

          {/*dc.send(block.subarray(i, i + SLICE)); |           dc.send(block.subarray(i, i + SLICE) as Uint8Array<ArrayBuffer>);*/}

          const chunk = new Uint8Array(SLICE);
          chunk.set(block.subarray(i, i + SLICE));
          dc.send(chunk.buffer);

        }
      }
      if (dc.readyState === "open") dc.send(JSON.stringify({ op: cancelled ? "cancelled" : "end" }));
    } catch (e) {
      if (dc.readyState === "open") dc.send(JSON.stringify({ op: "err", kind: "other", message: `The other device couldn't read the song (${e instanceof Error ? e.message : e}).` }));
    }
  };
}

/** Start answering other devices' requests. Call once when sync is on; returns a stop function. Safe to call when WebRTC is missing. */
export async function startP2PHost(lookup: (fp: string) => Track | undefined): Promise<() => void> {
  if (!p2pSupported()) return () => undefined;
  const sig = await signaller();
  const peers = new Map<string, RTCPeerConnection>();
  const off = sig.on(async (s) => {
    if (s.t === "offer") {
      peers.get(s.from)?.close();
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      peers.set(s.from, pc);
      pc.onicecandidate = (e) => e.candidate && sig.send({ t: "ice", from: deviceId(), to: s.from, cand: e.candidate.toJSON() });
      pc.ondatachannel = (e) => void serve(e.channel, lookup);
      pc.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(pc.connectionState)) { pc.close(); peers.delete(s.from); } };
      await pc.setRemoteDescription(s.sdp);
      await pc.setLocalDescription(await pc.createAnswer());
      sig.send({ t: "answer", from: deviceId(), to: s.from, sdp: pc.localDescription! });
    } else if (s.t === "ice") {
      await peers.get(s.from)?.addIceCandidate(s.cand).catch(() => undefined);
    }
  });
  return () => { off(); peers.forEach((p) => p.close()); peers.clear(); };
}

// ---------------------------------------------------------------------------------------------------------------- receiving
export interface IncomingSong {
  meta: { size: number; mime: string; name: string; ext: string };
  /** Resolves with a playable URL: right after the read-ahead buffer is full (stream) or when the whole song arrived (copy). */
  ready: Promise<string>;
  /** Resolves with the complete file once every byte arrived. */
  done: Promise<Blob>;
  cancel: () => void;
}

export interface ReceiveOptions {
  deviceId: string;
  fp: string;
  mode: "copy" | "stream";
  /** Read-ahead before playback starts, seconds (stream mode). */
  bufferSeconds?: number;
  durationSec?: number;
  onProgress?: (received: number, total: number) => void;
}

export async function receiveSong(o: ReceiveOptions): Promise<IncomingSong> {
  if (!p2pSupported()) throw new P2PError("This device's web engine can't make direct connections, so songs can't be moved from another device here.", "unsupported");
  const sig = await signaller();
  const me = deviceId();
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const dc = pc.createDataChannel("song", { ordered: true });
  dc.binaryType = "arraybuffer";
  const stop = sig.on(async (s) => {
    if (s.from !== o.deviceId) return;
    if (s.t === "answer") await pc.setRemoteDescription(s.sdp);
    else if (s.t === "ice") await pc.addIceCandidate(s.cand).catch(() => undefined);
  });
  pc.onicecandidate = (e) => e.candidate && sig.send({ t: "ice", from: me, to: o.deviceId, cand: e.candidate.toJSON() });

  const cleanup = () => { stop(); try { dc.close(); } catch { /* already closed */ } pc.close(); };
  try {
    await pc.setLocalDescription(await pc.createOffer());
    sig.send({ t: "offer", from: me, to: o.deviceId, sdp: pc.localDescription! });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new P2PError("The other device didn't answer. Open BlackMusic on it (signed in, sync on) and try again.", "offline")), OPEN_TIMEOUT_MS);
      dc.onopen = () => { clearTimeout(timer); resolve(); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") { clearTimeout(timer); reject(new P2PError("Couldn't make a direct connection. On different networks you may need a TURN server (Settings → Sync → Connection).", "network")); } };
    });
  } catch (e) { cleanup(); throw e; }

  return new Promise<IncomingSong>((resolveSong, rejectSong) => {
    const chunks: Uint8Array[] = [];
    let received = 0;
    let meta: IncomingSong["meta"] | null = null;
    let resolveReady!: (u: string) => void; let rejectReady!: (e: Error) => void;
    let resolveDone!: (b: Blob) => void; let rejectDone!: (e: Error) => void;
    const ready = new Promise<string>((a, b) => { resolveReady = a; rejectReady = b; });
    const done = new Promise<Blob>((a, b) => { resolveDone = a; rejectDone = b; });
    ready.catch(() => undefined); done.catch(() => undefined);
    let mse: { url: string; push: (c: Uint8Array) => void; end: () => void } | null = null;
    let readyFired = false;
    const fail = (e: Error) => { rejectReady(e); rejectDone(e); rejectSong(e); cleanup(); };

    const makeMse = (mime: string) => {
      if (typeof MediaSource === "undefined" || mime !== "audio/mpeg" || !MediaSource.isTypeSupported(mime)) return null;
      const ms = new MediaSource();
      const queue: Uint8Array[] = [];
      let sb: SourceBuffer | null = null;
      let ended = false;
      const pump = () => {
        if (!sb || sb.updating || ms.readyState !== "open") return;
        const next = queue.shift();
        if (next) { try { sb.appendBuffer(next as unknown as BufferSource); } catch { /* quota: the oldest data is dropped by the browser */ } }
        else if (ended && ms.readyState === "open") { try { ms.endOfStream(); } catch { /* already ended */ } }
      };
      ms.addEventListener("sourceopen", () => { sb = ms.addSourceBuffer(mime); sb.addEventListener("updateend", pump); pump(); });
      return { url: URL.createObjectURL(ms), push: (c: Uint8Array) => { queue.push(c); pump(); }, end: () => { ended = true; pump(); } };
    };

    const readyBytes = () => {
      if (o.mode === "copy" || !meta) return Infinity;
      const frac = o.durationSec && o.durationSec > 0 ? Math.min(1, (o.bufferSeconds ?? 20) / o.durationSec) : 0.1;
      return Math.max(256 * 1024, Math.floor(meta.size * frac));
    };

    dc.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        const m = JSON.parse(ev.data) as { op: string; size?: number; mime?: string; name?: string; ext?: string; message?: string; kind?: string };
        if (m.op === "meta") {
          meta = { size: m.size!, mime: m.mime!, name: m.name!, ext: m.ext! };
          if (o.mode === "stream") mse = makeMse(meta.mime);
          resolveSong({ meta, ready, done, cancel: () => { try { dc.send(JSON.stringify({ op: "cancel" })); } catch { /* closed */ } fail(new P2PError("Cancelled.", "cancelled")); } });
        } else if (m.op === "end") {
          const blob = new Blob(chunks as unknown as BlobPart[], { type: meta?.mime });
          mse?.end();
          if (!readyFired) { readyFired = true; resolveReady(mse?.url ?? URL.createObjectURL(blob)); }
          resolveDone(blob);
          cleanup();
        } else if (m.op === "err") {
          fail(new P2PError(m.message ?? "The other device couldn't send that song.", m.kind === "missing" ? "missing" : "other"));
        }
        return;
      }
      const c = new Uint8Array(ev.data as ArrayBuffer);
      chunks.push(c);
      received += c.length;
      mse?.push(c);
      o.onProgress?.(received, meta?.size ?? 0);
      if (!readyFired && mse && received >= readyBytes()) { readyFired = true; resolveReady(mse.url); }
    };
    dc.onclose = () => { if (meta && received < meta.size) fail(new P2PError("The connection to the other device dropped before the song finished.", "network")); };
    dc.send(JSON.stringify({ op: "get", fp: o.fp }));
  });
}
