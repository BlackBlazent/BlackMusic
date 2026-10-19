import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";

/**
 * Persistent setting that is SHARED between components (unlike usePersistentState, whose instances don't see each
 * other's writes). Settings → Personalization writes it, the app shell (banner, dock, screensaver, i18n) reads it, and
 * both update instantly. Persisted through the same preference store.
 */
const PREFIX = "blackmusic:setting:";
const cache = new Map<string, unknown>();
const touched = new Set<string>();
const hydrated = new Set<string>();
const subs = new Map<string, Set<() => void>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const notify = (key: string) => subs.get(key)?.forEach((fn) => fn());

function hydrate<T>(key: string, initial: T) {
  if (hydrated.has(key)) return;
  hydrated.add(key);
  void getPreference<T>(PREFIX + key, initial).then((stored) => {
    if (touched.has(key)) return; // the user changed it before the stored value arrived
    cache.set(key, stored);
    notify(key);
  });
}

export function readSharedSetting<T>(key: string, initial: T): T {
  return (cache.has(key) ? cache.get(key) : initial) as T;
}

export function writeSharedSetting<T>(key: string, next: T): void {
  touched.add(key);
  cache.set(key, next);
  notify(key);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => void setPreference(PREFIX + key, cache.get(key)), 200));
}

export function useSharedSetting<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  if (!cache.has(key)) cache.set(key, initial); // stable snapshot identity for useSyncExternalStore
  useEffect(() => hydrate(key, initial), []); // eslint-disable-line react-hooks/exhaustive-deps

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!subs.has(key)) subs.set(key, new Set());
      subs.get(key)!.add(cb);
      return () => subs.get(key)!.delete(cb);
    },
    [key],
  );
  const value = useSyncExternalStore(subscribe, () => cache.get(key) as T);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => writeSharedSetting(key, typeof next === "function" ? (next as (p: T) => T)(cache.get(key) as T) : next),
    [key],
  );
  return [value, set];
}
