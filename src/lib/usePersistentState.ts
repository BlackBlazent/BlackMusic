import { useCallback, useEffect, useRef, useState } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";

/**
 * useState that survives restarts (2.1.0 "saved states & resume"). Starts at
 * `initial`, hydrates from the preference store (Tauri store on desktop,
 * localStorage in a browser), and writes back debounced. `hydrated` lets a
 * page avoid flashing defaults before the saved value lands.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const storageKey = `blackmusic:ui:${key}`;
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const valueRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPreference<T>(storageKey, initial).then((stored) => {
      if (cancelled) return;
      valueRef.current = stored;
      setValue(stored);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `initial` is only the first-run default
  }, [storageKey]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void setPreference(storageKey, valueRef.current), 250);
    },
    [storageKey],
  );

  return [value, set, hydrated];
}
