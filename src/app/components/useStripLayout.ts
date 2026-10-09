import { useMemo } from "react";
import type { Track } from "@/lib/types";
import { usePersistentState } from "@/lib/usePersistentState";

export const MAX_STRIP_PINS = 10;

/**
 * Per-source layout of the Playground queue strip, persisted: manual drag order, pinned tracks
 * (max 10, shown first), and tracks removed from the strip. `scope` is "library" or "playlist:<id>".
 */
export function useStripLayout(scope: string, tracks: Track[]) {
  const [order, setOrder] = usePersistentState<string[]>(`strip.order.${scope}`, []);
  const [pins, setPins] = usePersistentState<string[]>("strip.pins", []);
  const [removed, setRemoved] = usePersistentState<string[]>(`strip.removed.${scope}`, []);

  const ordered = useMemo(() => {
    const gone = new Set(removed);
    const rank = new Map(order.map((id, i) => [id, i]));
    const base = tracks.filter((t) => !gone.has(t.id));
    const sorted = rank.size === 0 ? base : [...base].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    const pinRank = new Map(pins.map((id, i) => [id, i]));
    const pinned = sorted.filter((t) => pinRank.has(t.id)).sort((a, b) => pinRank.get(a.id)! - pinRank.get(b.id)!);
    return [...pinned, ...sorted.filter((t) => !pinRank.has(t.id))];
  }, [tracks, order, pins, removed]);

  const togglePin = (id: string): "pinned" | "unpinned" | "limit" => {
    if (pins.includes(id)) {
      setPins((p) => p.filter((x) => x !== id));
      return "unpinned";
    }
    if (pins.length >= MAX_STRIP_PINS) return "limit";
    // "Pin to first on the list": newest pin goes to the very front.
    setPins((p) => [id, ...p]);
    return "pinned";
  };

  const move = (dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    const ids = ordered.map((t) => t.id).filter((id) => id !== dragId);
    const at = ids.indexOf(targetId);
    ids.splice(at === -1 ? ids.length : at, 0, dragId);
    setOrder(ids);
  };

  const remove = (id: string) => {
    setRemoved((r) => (r.includes(id) ? r : [...r, id]));
    setPins((p) => p.filter((x) => x !== id));
  };

  return { ordered, pins, togglePin, move, remove };
}
