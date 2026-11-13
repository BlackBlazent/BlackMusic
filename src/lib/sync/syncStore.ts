import { useSyncExternalStore } from "react";
import type { SyncReport } from "./engine";

export type SyncStatus =
  | { state: "idle" }
  | { state: "running"; label: string }
  | { state: "error"; message: string; kind: string }
  | { state: "done"; report: SyncReport };

let status: SyncStatus = { state: "idle" };
let trigger: (() => void) | null = null;
const subs = new Set<() => void>();

export const setSyncStatus = (s: SyncStatus) => { status = s; subs.forEach((f) => f()); };
export const registerSyncTrigger = (fn: (() => void) | null) => { trigger = fn; };
export const requestSync = () => trigger?.();
export const useSyncStatus = (): SyncStatus => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => status);
