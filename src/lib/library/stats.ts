import { readSharedSetting, writeSharedSetting } from "@/lib/sharedSetting";
import { useSharedSetting } from "@/lib/sharedSetting";

/** Small lifetime counters the Home badges use (IMP-03). Stored locally only. */
export interface LifetimeStats {
  editedMetadata: number;
}
const DEFAULT: LifetimeStats = { editedMetadata: 0 };

export const useLifetimeStats = () => useSharedSetting<LifetimeStats>("lifetimeStats", DEFAULT)[0];

export function bumpStat(key: keyof LifetimeStats, by = 1): void {
  const cur = readSharedSetting<LifetimeStats>("lifetimeStats", DEFAULT);
  writeSharedSetting("lifetimeStats", { ...cur, [key]: (cur[key] ?? 0) + by });
}
