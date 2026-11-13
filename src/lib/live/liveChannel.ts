import { getSupabaseClient } from "@/lib/supabaseClient";

/**
 * FEAT-03c/d — a tiny live channel for Meet Room and Session Share, on Supabase Realtime BROADCAST.
 * Broadcast messages are relayed, never written to a table, and carry only small control data (which song, play/pause, position).
 * No audio is sent. Today this transport needs the internet; a same-Wi-Fi (offline) transport is NOT built yet.
 */
export type LiveSong = { fp: string; title: string; artist: string; album: string; duration: number };

export type LiveMessage =
  | { t: "hello"; id: string; name: string }
  | { t: "bye"; id: string }
  | { t: "state"; id: string; song: LiveSong | null; playing: boolean; position: number; sentAt: number }
  | { t: "seek"; id: string; position: number; sentAt: number }
  | { t: "queue-add"; id: string; by: string; song: LiveSong }
  | { t: "queue-sync"; id: string; queue: LiveSong[] };

export interface LiveHandle {
  send: (m: LiveMessage) => void;
  leave: () => Promise<void>;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** `length` 6 is easy to read out loud for a party room; 10 for a private share link. Uses crypto, not Math.random. */
export function makeCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

export async function joinChannel(kind: "room" | "share", code: string, onMessage: (m: LiveMessage) => void): Promise<LiveHandle> {
  const client = await getSupabaseClient();
  if (!client) throw new Error("Live sessions need the online service, which isn't configured in this build.");
  const channel = client.channel(`bm-${kind}-${code}`, { config: { broadcast: { self: false, ack: false } } });
  channel.on("broadcast", { event: "m" }, ({ payload }) => {
    if (payload && typeof payload === "object" && typeof (payload as { t?: unknown }).t === "string") onMessage(payload as LiveMessage);
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Couldn't connect. Check your internet connection and try again.")), 12_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") { clearTimeout(timer); resolve(); }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timer); reject(new Error("Couldn't connect. Check your internet connection and try again.")); }
    });
  });
  return {
    send: (m) => void channel.send({ type: "broadcast", event: "m", payload: m }),
    leave: async () => { await client.removeChannel(channel); },
  };
}

/**
 * Same-Wi-Fi transport (no internet): a WebSocket to the room host's relay (src-tauri/src/lan_room.rs).
 * `address` is "192.168.1.20:41781". The first message proves the room code; the host answers {t:"lan-ready"}.
 */
export async function joinLanChannel(address: string, code: string, onMessage: (m: LiveMessage) => void): Promise<LiveHandle> {
  const clean = address.trim().replace(/^wss?:\/\//, "");
  if (!/^[\w.\-]+:\d{2,5}$/.test(clean)) throw new Error("Type the room's address like 192.168.1.20:41781.");
  const ws = new WebSocket(`ws://${clean}`);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(new Error("Couldn't reach that room. Check you're on the same Wi-Fi and the address is right.")); }, 8_000);
    ws.onopen = () => ws.send(JSON.stringify({ code }));
    ws.onerror = () => { clearTimeout(timer); reject(new Error("Couldn't reach that room. Check you're on the same Wi-Fi and the address is right.")); };
    ws.onclose = () => { clearTimeout(timer); reject(new Error("The room refused the connection — check the code.")); };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(String(ev.data)) as { t?: string };
        if (m.t === "lan-ready") { clearTimeout(timer); resolve(); }
      } catch { /* ignore */ }
    };
  });
  ws.onclose = null;
  ws.onmessage = (ev) => {
    try {
      const m = JSON.parse(String(ev.data)) as LiveMessage;
      if (m && typeof m.t === "string" && m.t !== ("lan-ready" as string)) onMessage(m);
    } catch { /* malformed message from a member: ignore */ }
  };
  return {
    send: (m) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)); },
    leave: async () => { ws.onclose = null; ws.close(); },
  };
}
