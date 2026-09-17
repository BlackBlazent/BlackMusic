import type { Store } from "@tauri-apps/plugin-store";
import { isTauri } from "./platform";

let tauriStorePromise: Promise<Store> | null = null;

async function getTauriStore(): Promise<Store> {
  if (!tauriStorePromise) {
    tauriStorePromise = import("@tauri-apps/plugin-store").then(({ Store }) =>
      Store.load("preferences.json"),
    );
  }
  return tauriStorePromise;
}

/** Read a persisted preference (theme, sidebar state, playback settings, …). */
export async function getPreference<T>(key: string, fallback: T): Promise<T> {
  if (isTauri()) {
    const store = await getTauriStore();
    const value = await store.get<T>(key);
    // `??` covers both `null` (key absent) and `undefined` (Store's typing
    // allows it even though it doesn't occur in practice) in one check.
    return value ?? fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Persist a preference. Fire-and-forget is fine — these are non-critical UI settings. */
export async function setPreference<T>(key: string, value: T): Promise<void> {
  if (isTauri()) {
    const store = await getTauriStore();
    await store.set(key, value);
    // `set()` only updates the in-memory store — without an explicit `save()`
    // nothing actually reaches disk, which is very likely why watched folders,
    // the scanned-track cache, and every other setting stopped surviving a
    // restart. This is the fix for that.
    await store.save();
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota) — preferences just won't persist.
  }
}
