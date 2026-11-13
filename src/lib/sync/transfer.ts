import { getSupabaseClient } from "@/lib/supabaseClient";
import { readSharedSetting, writeSharedSetting } from "@/lib/sharedSetting";
import { decideTransfer, readEnvironment, type TransferDecision, type TransferMode } from "./transferPolicy";
import { receiveSong, type IncomingSong } from "./p2p";
import { safeFileName } from "@/lib/backup/build";

/** FEAT-14 — what the user sees of "a song that lives on another device", and how it gets here. */
export interface RemoteSong {
  fp: string;
  deviceId: string;
  deviceName: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  sizeBytes: number;
}

interface Budget { month: string; usedBytes: number; copiedBytes: number }
const month = () => new Date().toISOString().slice(0, 7);
function budget(): Budget {
  const b = readSharedSetting<Budget>("sync.budget", { month: month(), usedBytes: 0, copiedBytes: 0 });
  return b.month === month() ? b : { month: month(), usedBytes: 0, copiedBytes: b.copiedBytes }; // usage resets monthly; copied songs stay copied
}
const addUsage = (bytes: number, copied: boolean) => { const b = budget(); writeSharedSetting("sync.budget", { ...b, usedBytes: b.usedBytes + bytes, copiedBytes: b.copiedBytes + (copied ? bytes : 0) }); };
export const budgetStatus = () => { const b = budget(); const cap = readSharedSetting<number>("sync.monthlyBudgetGb", 2) * 1024 ** 3; return { ...b, capBytes: cap, used: cap ? b.usedBytes / cap : 0 }; };

/** Songs a folder holds on another device (names/metadata only — straight from the sync tables). */
export async function listRemoteFolderSongs(deviceId: string, deviceName: string, folderName: string): Promise<RemoteSong[]> {
  const client = await getSupabaseClient();
  if (!client) return [];
  const { data: pres, error } = await client.from("sync_track_presence").select("fingerprint,size_bytes").eq("device_id", deviceId).eq("folder_name", folderName).limit(5000);
  if (error) throw new Error(error.message);
  const fps = (pres ?? []).map((p) => p.fingerprint as string);
  const meta = new Map<string, { title: string; artist: string; album: string; duration_ms: number }>();
  for (let i = 0; i < fps.length; i += 200) {
    const { data } = await client.from("sync_tracks").select("fingerprint,title,artist,album,duration_ms").in("fingerprint", fps.slice(i, i + 200));
    (data ?? []).forEach((r) => meta.set(r.fingerprint as string, r as never));
  }
  return (pres ?? []).map((p) => {
    const m = meta.get(p.fingerprint as string);
    return { fp: p.fingerprint as string, deviceId, deviceName, title: m?.title ?? "Unknown", artist: m?.artist ?? "", album: m?.album ?? "", durationSec: (m?.duration_ms ?? 0) / 1000, sizeBytes: Number(p.size_bytes) || 0 };
  }).sort((a, b) => a.title.localeCompare(b.title));
}

export interface StartedTransfer { decision: TransferDecision; incoming: IncomingSong; finish: () => Promise<{ savedPath?: string; folder?: string }> }

/** Applies the copy-vs-stream policy, connects to the other device and starts receiving. Throws a sentence the user can read. */
export async function startTransfer(song: RemoteSong, onProgress?: (done: number, total: number) => void): Promise<StartedTransfer> {
  const mode = readSharedSetting<TransferMode>("sync.transferMode", "auto");
  const env = await readEnvironment();
  const b = budgetStatus();
  const decision = decideTransfer({ mode, bytes: song.sizeBytes, ...env, budgetUsed: b.used, alreadyCopiedBytes: b.copiedBytes });
  if (decision.action === "defer") throw new Error(decision.reason);
  const incoming = await receiveSong({ deviceId: song.deviceId, fp: song.fp, mode: decision.action, bufferSeconds: decision.bufferSeconds, durationSec: song.durationSec, onProgress });
  const finish = async () => {
    const blob = await incoming.done;
    addUsage(blob.size, decision.action === "copy");
    if (decision.action !== "copy") return {}; // streaming keeps nothing on disk
    const { appLocalDataDir, join } = await import("@tauri-apps/api/path");
    const { mkdir, writeFile } = await import("@tauri-apps/plugin-fs");
    const folder = await join(await appLocalDataDir(), "Synced", safeFileName(song.deviceName));
    await mkdir(folder, { recursive: true });
    const savedPath = await join(folder, `${safeFileName(incoming.meta.name)}.${incoming.meta.ext}`);
    await writeFile(savedPath, new Uint8Array(await blob.arrayBuffer()));
    return { savedPath, folder };
  };
  return { decision, incoming, finish };
}
