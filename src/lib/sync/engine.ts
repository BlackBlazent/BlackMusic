import type { PlayEvent, Track } from "@/lib/types";
import type { Playlist } from "@/app/context/PlaylistsContext";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { readSharedSetting, writeSharedSetting } from "@/lib/sharedSetting";
import { fingerprintAll, fnv } from "./fingerprint";
import { clearTombstones, pendingPlaylistDeletions, pendingUnfavorites } from "./tombstones";
import type { SyncedFolder } from "./syncedFolders";
import { isMobileOs } from "@/lib/useIsMobile";

/**
 * FEAT-12 — Music Portable Sync engine (local-first). The local app state stays the source of truth; Supabase only receives
 * METADATA (titles, playlists, favorites, folder names, play events). No audio is uploaded, ever.
 * Incremental: only records that changed since the last run are sent. Idempotent: retries never duplicate (primary keys / op_id).
 * Tombstones carry deletions. Conflict rules are in the doc comment of `applyPlaylists`.
 */

export class SyncError extends Error {
  constructor(message: string, readonly kind: "not-configured" | "signed-out" | "schema" | "network" | "other" = "other") {
    super(message);
    this.name = "SyncError";
  }
}

const K = {
  enabled: "sync.enabled",
  deviceId: "sync.deviceId",
  deviceName: "sync.deviceName",
  trackHashes: "sync.trackHashes",
  playlistHashes: "sync.playlistHashes",
  favoritesSynced: "sync.favoritesSynced",
  unresolved: "sync.unresolvedFingerprints",
  cursor: "sync.pullCursor",
  playCursor: "sync.playCursor",
  remoteFolders: "sync.remoteFolders",
  report: "sync.lastReport",
} as const;

export interface SyncReport {
  at: number;
  pushed: { tracks: number; playlists: number; favorites: number; plays: number };
  pulled: { playlists: number; favorites: number; folders: number; tracksOnlyElsewhere: number };
}

export const isSyncEnabled = () => readSharedSetting<boolean>(K.enabled, false);
export const setSyncEnabled = (on: boolean) => writeSharedSetting(K.enabled, on);
export const lastSyncReport = () => readSharedSetting<SyncReport | null>(K.report, null);

export function deviceId(): string {
  let id = readSharedSetting<string>(K.deviceId, "");
  if (!id) {
    id = crypto.randomUUID();
    writeSharedSetting(K.deviceId, id);
  }
  return id;
}
export const defaultDeviceName = () => (isMobileOs() ? (/iPhone|iPad/i.test(navigator.userAgent) ? "iPhone / iPad" : "Android phone") : /Mac/i.test(navigator.userAgent) ? "Mac" : /Windows/i.test(navigator.userAgent) ? "Windows PC" : "Linux PC");
export const getDeviceName = () => readSharedSetting<string>(K.deviceName, "") || defaultDeviceName();
export const setDeviceName = (n: string) => writeSharedSetting(K.deviceName, n.trim().slice(0, 80));

const parentName = (path: string) => path.split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] ?? "";
const chunk = <T,>(rows: T[], n: number) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));

function mapError(e: unknown): SyncError {
  if (e instanceof SyncError) return e;
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (/relation .* does not exist|schema cache|Could not find the table/i.test(msg)) return new SyncError("Sync isn't set up on the server yet. Apply the sync database migration in Supabase, then try again.", "schema");
  if (/fetch|network|Failed to|timeout/i.test(msg)) return new SyncError("Couldn't reach the sync service. Check your connection and try again.", "network");
  return new SyncError(msg);
}

export interface SyncInput {
  tracks: Track[];
  playlists: Playlist[];
  favoriteIds: Set<string>;
  events: PlayEvent[];
  replacePlaylists: (updater: (prev: Playlist[]) => Playlist[]) => void;
  replaceFavorites: (updater: (prev: Set<string>) => Set<string>) => void;
}

export async function runSync(input: SyncInput, onProgress?: (label: string) => void): Promise<SyncReport> {
  const client = await getSupabaseClient();
  if (!client) throw new SyncError("Sync needs the account service, which isn't configured in this build.", "not-configured");
  const { data: auth } = await client.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new SyncError("Sign in to your account to use sync.", "signed-out");

  try {
    const me = deviceId();
    const { error: devErr } = await client.from("sync_devices").upsert({ id: me, user_id: uid, name: getDeviceName(), platform: isMobileOs() ? "mobile" : "desktop", last_seen_at: new Date().toISOString() });
    if (devErr) throw devErr;

    onProgress?.("Identifying your songs…");
    const fpById = await fingerprintAll(input.tracks);
    const idByFp = new Map<string, string>();
    for (const [id, fp] of fpById) if (!idByFp.has(fp)) idByFp.set(fp, id); // duplicate songs collapse to one — they are not transferred twice
    const report: SyncReport = { at: Date.now(), pushed: { tracks: 0, playlists: 0, favorites: 0, plays: 0 }, pulled: { playlists: 0, favorites: 0, folders: 0, tracksOnlyElsewhere: 0 } };

    // ---- PUSH: tracks (metadata only) + where this device keeps them ---------------------------------------------------------
    onProgress?.("Uploading library details…");
    const hashes = readSharedSetting<Record<string, string>>(K.trackHashes, {});
    const changed: Track[] = [];
    for (const t of input.tracks) {
      const fp = fpById.get(t.id)!;
      const h = fnv(`${t.title}|${t.artist}|${t.album}|${t.genre ?? ""}|${t.year ?? ""}|${t.composer ?? ""}|${t.country ?? ""}|${t.mood ?? ""}|${t.size ?? 0}|${parentName(t.path)}`);
      if (hashes[fp] !== h && idByFp.get(fp) === t.id) { changed.push(t); hashes[fp] = h; }
    }
    for (const batch of chunk(changed, 500)) {
      const now = new Date().toISOString();
      const { error: e1 } = await client.from("sync_tracks").upsert(
        batch.map((t) => ({ user_id: uid, fingerprint: fpById.get(t.id)!, title: t.title, artist: t.artist, album: t.album, duration_ms: Math.round((t.duration || 0) * 1000), genre: t.genre ?? null, year: t.year ?? null, composer: t.composer ?? null, country: t.country ?? null, mood: t.mood ?? null, updated_at: now, deleted_at: null })),
      );
      if (e1) throw e1;
      const { error: e2 } = await client.from("sync_track_presence").upsert(
        batch.map((t) => ({ user_id: uid, device_id: me, fingerprint: fpById.get(t.id)!, folder_name: parentName(t.path) || null, size_bytes: t.size ?? 0, updated_at: now })),
      );
      if (e2) throw e2;
      report.pushed.tracks += batch.length;
    }
    writeSharedSetting(K.trackHashes, hashes);

    // folder NAMES for this device (IMP-08)
    const folders = new Map<string, { n: number; bytes: number }>();
    for (const t of input.tracks) {
      const name = parentName(t.path);
      if (!name) continue;
      const f = folders.get(name) ?? { n: 0, bytes: 0 };
      f.n++;
      f.bytes += t.size ?? 0;
      folders.set(name, f);
    }
    if (folders.size) {
      const { error } = await client.from("sync_folders").upsert([...folders].map(([name, f]) => ({ user_id: uid, device_id: me, name, track_count: f.n, total_bytes: f.bytes, updated_at: new Date().toISOString() })));
      if (error) throw error;
    }

    // ---- PUSH: playlists ---------------------------------------------------------------------------------------------------------
    onProgress?.("Syncing playlists…");
    const plHashes = readSharedSetting<Record<string, string>>(K.playlistHashes, {});
    const unresolved = readSharedSetting<Record<string, string[]>>(K.unresolved, {});
    const plRows: Record<string, unknown>[] = [];
    const nextPlHashes: Record<string, string> = { ...plHashes };
    for (const p of input.playlists) {
      const fps = [...p.trackIds.map((id) => fpById.get(id)).filter((x): x is string => Boolean(x)), ...(unresolved[p.id] ?? [])];
      const h = fnv(JSON.stringify([p.name, p.description, p.mood, p.pinned, fps]));
      if (plHashes[p.id] === h) continue;
      nextPlHashes[p.id] = h;
      plRows.push({ user_id: uid, id: p.id, name: p.name, description: p.description, mood: p.mood, pinned: p.pinned, track_fingerprints: fps, created_at_ms: p.createdAt, updated_at: new Date().toISOString(), deleted_at: null });
    }
    for (const id of pendingPlaylistDeletions()) {
      plRows.push({ user_id: uid, id, name: "(deleted)", track_fingerprints: [], updated_at: new Date().toISOString(), deleted_at: new Date().toISOString() });
      delete nextPlHashes[id];
    }
    for (const batch of chunk(plRows, 200)) {
      const { error } = await client.from("sync_playlists").upsert(batch);
      if (error) throw error;
      report.pushed.playlists += batch.length;
    }
    writeSharedSetting(K.playlistHashes, nextPlHashes);

    // ---- PUSH: favorites ---------------------------------------------------------------------------------------------------------
    const favNow = new Set([...input.favoriteIds].map((id) => fpById.get(id)).filter((x): x is string => Boolean(x)));
    const favBefore = new Set(readSharedSetting<string[]>(K.favoritesSynced, []));
    const added = [...favNow].filter((f) => !favBefore.has(f));
    const removed = pendingUnfavorites().map((id) => fpById.get(id)).filter((x): x is string => Boolean(x));
    const favRows = [
      ...added.map((fingerprint) => ({ user_id: uid, fingerprint, updated_at: new Date().toISOString(), deleted_at: null })),
      ...removed.map((fingerprint) => ({ user_id: uid, fingerprint, updated_at: new Date().toISOString(), deleted_at: new Date().toISOString() })),
    ];
    for (const batch of chunk(favRows, 500)) {
      const { error } = await client.from("sync_favorites").upsert(batch);
      if (error) throw error;
      report.pushed.favorites += batch.length;
    }
    // ---- PUSH: play events (idempotent op_id) --------------------------------------------------------------------------------
    const playCursor = readSharedSetting<number>(K.playCursor, 0);
    const newPlays = input.events.filter((e) => e.playedAt > playCursor && fpById.has(e.trackId));
    for (const batch of chunk(newPlays, 500)) {
      const { error } = await client.from("sync_plays").upsert(
        batch.map((e) => ({ user_id: uid, op_id: `${me}:${e.playedAt}:${fpById.get(e.trackId)!.slice(4, 16)}`, fingerprint: fpById.get(e.trackId)!, played_at: new Date(e.playedAt).toISOString() })),
        { onConflict: "user_id,op_id", ignoreDuplicates: true },
      );
      if (error) throw error;
      report.pushed.plays += batch.length;
    }
    if (newPlays.length) writeSharedSetting(K.playCursor, Math.max(...newPlays.map((e) => e.playedAt)));
    clearTombstones();

    // ---- PULL --------------------------------------------------------------------------------------------------------------------
    onProgress?.("Getting changes from your other devices…");
    const cursor = readSharedSetting<string>(K.cursor, "1970-01-01T00:00:00Z");
    const pullStarted = new Date().toISOString();

    const { data: remotePl, error: plErr } = await client.from("sync_playlists").select("*").gt("updated_at", cursor).order("updated_at").limit(1000);
    if (plErr) throw plErr;
    const unresolvedNext = { ...unresolved };
    const applyPl = (remote: Record<string, unknown>[]) => {
      /**
       * Conflict rules (documented, deterministic):
       *  - a remote tombstone deletes the playlist here;
       *  - if only the remote changed since the last sync, the remote version replaces ours;
       *  - if BOTH changed, the name/description/mood come from the remote (newer upload) and the song list is the UNION
       *    (our order first, remote-only songs appended) — nothing either person added is lost.
       * Songs that aren't on this device stay recorded (as fingerprints) so they come back when the file arrives and are
       * re-uploaded unchanged; they simply aren't shown here.
       */
      input.replacePlaylists((prev) => {
        let list = [...prev];
        for (const r of remote) {
          const id = String(r.id);
          if (r.deleted_at) { list = list.filter((p) => p.id !== id); delete nextPlHashes[id]; delete unresolvedNext[id]; continue; }
          const fps = (r.track_fingerprints as string[]) ?? [];
          const local = list.find((p) => p.id === id);
          const localFps = local ? [...local.trackIds.map((t) => fpById.get(t)).filter((x): x is string => Boolean(x)), ...(unresolved[id] ?? [])] : [];
          const localChanged = local ? fnv(JSON.stringify([local.name, local.description, local.mood, local.pinned, localFps])) !== plHashes[id] : false;
          if (local && fnv(JSON.stringify([local.name, local.description, local.mood, local.pinned, localFps])) === fnv(JSON.stringify([r.name, r.description, r.mood, r.pinned, fps]))) continue;
          const mergedFps = local && localChanged ? [...localFps, ...fps.filter((f) => !localFps.includes(f))] : fps;
          const ids = mergedFps.map((f) => idByFp.get(f)).filter((x): x is string => Boolean(x));
          unresolvedNext[id] = mergedFps.filter((f) => !idByFp.has(f));
          const next: Playlist = { id, name: String(r.name), description: String(r.description ?? ""), mood: (r.mood as Playlist["mood"]) ?? null, trackIds: ids, pinned: Boolean(r.pinned), createdAt: Number(r.created_at_ms) || Date.now(), coverUrl: local?.coverUrl };
          list = local ? list.map((p) => (p.id === id ? next : p)) : [...list, next];
          nextPlHashes[id] = fnv(JSON.stringify([next.name, next.description, next.mood, next.pinned, mergedFps]));
          report.pulled.playlists++;
        }
        return list;
      });
    };
    if (remotePl?.length) applyPl(remotePl);
    writeSharedSetting(K.playlistHashes, nextPlHashes);
    writeSharedSetting(K.unresolved, unresolvedNext);

    const { data: remoteFav, error: favErr } = await client.from("sync_favorites").select("fingerprint,deleted_at").gt("updated_at", cursor).limit(5000);
    if (favErr) throw favErr;
    if (remoteFav?.length) {
      input.replaceFavorites((prev) => {
        const next = new Set(prev);
        for (const r of remoteFav) {
          const id = idByFp.get(r.fingerprint as string);
          if (!id) continue;
          if (r.deleted_at) next.delete(id);
          else if (!next.has(id)) { next.add(id); report.pulled.favorites++; }
        }
        return next;
      });
    }
    const favAfter = new Set(favNow);
    for (const r of remoteFav ?? []) r.deleted_at ? favAfter.delete(r.fingerprint as string) : favAfter.add(r.fingerprint as string);
    writeSharedSetting(K.favoritesSynced, [...favAfter]);

    // other devices' folders (names only) for the Folder page
    const { data: devs } = await client.from("sync_devices").select("id,name").neq("id", me);
    const names = new Map((devs ?? []).map((d) => [d.id as string, d.name as string]));
    const { data: rf } = await client.from("sync_folders").select("device_id,name,track_count,total_bytes").neq("device_id", me).limit(2000);
    const remoteFolders: SyncedFolder[] = (rf ?? []).filter((f) => names.has(f.device_id as string)).map((f) => ({ name: String(f.name), deviceId: String(f.device_id), deviceName: names.get(f.device_id as string)!, trackCount: Number(f.track_count), totalBytes: Number(f.total_bytes) }));
    writeSharedSetting(K.remoteFolders, remoteFolders);
    report.pulled.folders = remoteFolders.length;

    // how many songs exist only on other devices (shown as "unavailable here"; duplicates already collapsed above)
    const { count } = await client.from("sync_track_presence").select("fingerprint", { count: "exact", head: true }).neq("device_id", me);
    report.pulled.tracksOnlyElsewhere = Math.max(0, (count ?? 0) - [...fpById.values()].length);

    writeSharedSetting(K.cursor, pullStarted);
    writeSharedSetting(K.report, report);
    return report;
  } catch (e) {
    throw mapError(e);
  }
}

/** "Disable sync and delete remote metadata" — never touches local music. */
export async function disableSyncAndDeleteRemote(): Promise<void> {
  const client = await getSupabaseClient();
  if (client) {
    const { data } = await client.auth.getUser();
    if (data.user) {
      const { error } = await client.rpc("sync_delete_my_data");
      if (error) throw mapError(error);
    }
  }
  setSyncEnabled(false);
  for (const k of [K.trackHashes, K.playlistHashes, K.favoritesSynced, K.unresolved, K.cursor, K.playCursor, K.remoteFolders, K.report]) writeSharedSetting(k, k === K.cursor ? "1970-01-01T00:00:00Z" : k === K.playCursor ? 0 : k === K.favoritesSynced ? [] : k === K.report ? null : k === K.remoteFolders ? [] : {});
}
