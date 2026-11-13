import type { Track } from "@/lib/types";

/**
 * FEAT-12 — a logical track id that is the SAME on every device. Never a file path (paths differ per device and are private).
 * Built from the normalized title, artist, album and duration (rounded to 2 s so tiny encoder differences still match).
 * A metadata match is not proof of identical audio — that's why it is only used to line libraries up, never to delete anything.
 */
const norm = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function trackFingerprint(t: Pick<Track, "title" | "artist" | "album" | "duration">): Promise<string> {
  const basis = `${norm(t.title)}|${norm(t.artist)}|${norm(t.album)}|${Math.round((t.duration || 0) / 2)}`;
  const bytes = new TextEncoder().encode(basis);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "fp1:" + [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fingerprints for many tracks without freezing the UI (yields every 400). */
export async function fingerprintAll(tracks: Track[]): Promise<Map<string, string>> {
  const out = new Map<string, string>(); // track id -> fingerprint
  for (let i = 0; i < tracks.length; i++) {
    out.set(tracks[i].id, await trackFingerprint(tracks[i]));
    if (i % 400 === 399) await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

/** FNV-1a — a tiny change detector for "did this record change since the last upload?". Not a security hash. */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
