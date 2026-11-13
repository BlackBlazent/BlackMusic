/** FEAT-05 — alphabet / number / symbol navigation for large lists. */
export type AlphaKey = "all" | "number" | "symbol" | string; // string = "A".."Z"

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Bucket of a title: "A".."Z" (accents folded: Émile → E), "number" for digits, "symbol" for anything else (incl. non-Latin scripts). */
export function alphaBucket(title: string): AlphaKey {
  const first = title.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0);
  if (!first) return "symbol";
  if (/[0-9]/.test(first)) return "number";
  const up = first.toUpperCase();
  return /^[A-Z]$/.test(up) ? up : "symbol";
}

/** Which buckets actually contain tracks, so empty letters can be dimmed. */
export function bucketCounts<T>(items: T[], titleOf: (item: T) => string): Map<AlphaKey, number> {
  const counts = new Map<AlphaKey, number>();
  for (const item of items) {
    const k = alphaBucket(titleOf(item));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}
