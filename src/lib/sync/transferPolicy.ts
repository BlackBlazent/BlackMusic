/**
 * FEAT-14 — decides how a song that lives on ANOTHER device reaches this one.
 *   copy   : transfer the file and keep it locally
 *   stream : play it while it arrives, with a read-ahead buffer, and keep nothing
 *   defer  : don't move audio now (no usable connection / over budget) — try later
 * Pure function: every input is passed in, so it is easy to test and to reason about.
 * Audio NEVER goes through Supabase storage; Supabase only carries metadata and the tiny connection set-up messages.
 */
export type TransferMode = "copy" | "stream" | "auto";

export interface TransferInputs {
  mode: TransferMode;
  /** Size of the song(s) the user wants now, in bytes. */
  bytes: number;
  /** Measured or reported throughput in Mbit/s (null = unknown). */
  downlinkMbps: number | null;
  saveData: boolean;
  metered: boolean;
  /** Free space on this device in bytes (null = unknown). */
  freeBytes: number | null;
  /** How much of the user's own transfer budget for this month is already used (0..1). */
  budgetUsed: number;
  /** Songs already copied from other devices on this device, in bytes. */
  alreadyCopiedBytes: number;
}

export interface TransferDecision {
  action: "copy" | "stream" | "defer";
  reason: string;
  /** Seconds of audio to read ahead before playback starts, when streaming. */
  bufferSeconds?: number;
}

const GB = 1024 ** 3;
const MIN_FREE_AFTER_COPY = 2 * GB; // never leave the phone with less than this
const LIBRARY_COPY_SOFT_CAP = 8 * GB; // past this, "auto" prefers streaming so a 16,000-song library can't fill the phone

export function decideTransfer(i: TransferInputs): TransferDecision {
  const slow = i.downlinkMbps !== null && i.downlinkMbps < 1.5;
  const unusable = i.downlinkMbps !== null && i.downlinkMbps < 0.25;
  const roomToCopy = i.freeBytes === null || i.freeBytes - i.bytes > MIN_FREE_AFTER_COPY;
  const overBudget = i.budgetUsed >= 1;
  const nearBudget = i.budgetUsed >= 0.85;

  if (unusable) return { action: "defer", reason: "The connection is too weak to move audio right now. It will try again when it improves." };
  if (overBudget) return { action: "defer", reason: "This month's transfer budget is used up. Raise it in Settings, or wait until next month." };

  // Buffer sized to the connection: a slower link reads further ahead before it starts, so playback doesn't stutter.
  const bufferSeconds = i.downlinkMbps === null ? 20 : slow ? 45 : i.downlinkMbps < 5 ? 25 : 10;

  if (i.mode === "stream") return { action: "stream", bufferSeconds, reason: "Streaming (your choice): nothing is saved on this device." };
  if (i.mode === "copy") {
    if (!roomToCopy) return { action: "stream", bufferSeconds, reason: "Not enough free space to copy safely, so this song is streamed instead." };
    if (slow) return { action: "copy", reason: "Copying (your choice). The connection is slow, so it will take a while." };
    return { action: "copy", reason: "Copying (your choice): the song is saved on this device." };
  }

  // auto
  if (!roomToCopy) return { action: "stream", bufferSeconds, reason: "Low on space, so this song is streamed instead of copied." };
  if (i.saveData || i.metered) return { action: "stream", bufferSeconds, reason: "Data saver / metered connection: streaming only what you play." };
  if (nearBudget) return { action: "stream", bufferSeconds, reason: "Close to this month's transfer budget, so streaming is used." };
  if (slow) return { action: "stream", bufferSeconds, reason: "Slow connection: streaming with a larger buffer." };
  if (i.alreadyCopiedBytes + i.bytes > LIBRARY_COPY_SOFT_CAP) return { action: "stream", bufferSeconds, reason: "Enough has been copied already; the rest is streamed to protect your storage." };
  return { action: "copy", reason: "Good connection and plenty of space: copying for offline listening." };
}

/** Reads what the browser/WebView knows about the connection and storage. Every field degrades to "unknown". NOTE: `freeBytes` is the WebView storage quota estimate, not true free disk space — a native free-space command is a follow-up. */
export async function readEnvironment(): Promise<Pick<TransferInputs, "downlinkMbps" | "saveData" | "metered" | "freeBytes">> {
  const c = (navigator as unknown as { connection?: { downlink?: number; saveData?: boolean; type?: string } }).connection;
  let freeBytes: number | null = null;
  try {
    const e = await navigator.storage?.estimate?.();
    if (e?.quota !== undefined && e.usage !== undefined) freeBytes = Math.max(0, e.quota - e.usage);
  } catch {
    /* unknown */
  }
  return { downlinkMbps: typeof c?.downlink === "number" ? c.downlink : null, saveData: Boolean(c?.saveData), metered: c?.type === "cellular", freeBytes };
}
