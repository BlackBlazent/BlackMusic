import { getPreference, setPreference } from "@/lib/preferencesStore";
import { mbArtistCountry } from "@/lib/services/musicbrainzClient";

/** FEAT-02 — artist → origin country, cached on this device (MusicBrainz is asked once per artist, ever). */
const KEY = "blackmusic:artistCountry";
type Cache = Record<string, { code: string | null; at: number }>;
let cache: Cache | null = null;
const RETRY_NULL_AFTER_MS = 30 * 24 * 3600 * 1000;

async function load(): Promise<Cache> {
  if (!cache) cache = await getPreference<Cache>(KEY, {});
  return cache;
}

export const regionName = (code: string): string => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

/** 🇵🇭 from "PH". */
export const flagEmoji = (code: string): string =>
  /^[A-Za-z]{2}$/.test(code) ? String.fromCodePoint(...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : "🌍";

let nameToCode: Map<string, string> | null = null;
/** "Philippines" → "PH" (for countries typed by hand in Edit metadata). */
export function codeFromName(name: string): string | null {
  if (!nameToCode) {
    nameToCode = new Map();
    for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const n = regionName(code);
      if (n !== code) nameToCode.set(n.toLowerCase(), code);
    }
  }
  return nameToCode.get(name.trim().toLowerCase()) ?? (/^[A-Za-z]{2}$/.test(name.trim()) ? name.trim().toUpperCase() : null);
}

export async function cachedArtistCountry(artist: string): Promise<string | null | undefined> {
  const c = await load();
  const hit = c[artist.toLowerCase()];
  if (!hit) return undefined;
  if (hit.code === null && Date.now() - hit.at > RETRY_NULL_AFTER_MS) return undefined;
  return hit.code;
}

/** Looks the artist up (network, rate-limited by the MusicBrainz client). Returns null if unknown. Never throws. */
export async function resolveArtistCountry(artist: string): Promise<string | null> {
  const known = await cachedArtistCountry(artist);
  if (known !== undefined) return known;
  try {
    const code = await mbArtistCountry(artist);
    const c = await load();
    c[artist.toLowerCase()] = { code, at: Date.now() };
    void setPreference(KEY, c);
    return code;
  } catch {
    return null; // offline / rate-limited: don't cache a failure as "no country"
  }
}
