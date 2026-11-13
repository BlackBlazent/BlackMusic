import { readSharedSetting, writeSharedSetting } from "@/lib/sharedSetting";

/** Deletions that still have to reach the other devices ("tombstones"). Cleared by the sync engine after they're uploaded. */
const PL = "sync.deletedPlaylists";
const FV = "sync.unfavorited"; // local track ids; the engine maps them to fingerprints when it uploads

export const recordPlaylistDeletion = (id: string) => writeSharedSetting<string[]>(PL, [...new Set([...readSharedSetting<string[]>(PL, []), id])]);
export const recordUnfavorite = (trackId: string) => writeSharedSetting<string[]>(FV, [...new Set([...readSharedSetting<string[]>(FV, []), trackId])]);
export const pendingPlaylistDeletions = () => readSharedSetting<string[]>(PL, []);
export const pendingUnfavorites = () => readSharedSetting<string[]>(FV, []);
export const clearTombstones = () => { writeSharedSetting<string[]>(PL, []); writeSharedSetting<string[]>(FV, []); };
