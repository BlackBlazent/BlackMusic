/*
import type { Promotion } from "./types";
import { isPlacementAllowed } from "./types";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { serviceFetch } from "@/lib/services/serviceFetch";

/**
 * Involve Asia promotions arrive from the BlackMusic BACKEND (see
 * /server/promotions-server.mjs). The Involve API key/secret live only there —
 * this client never sees them (spec §28). The backend already authenticates,
 * filters (Approved + Active + usable banner), and caches; the app just reads
 * `GET {VITE_PROMOTIONS_API_URL}/api/promotions`, caches it locally too, and
 * silently shows nothing if everything fails (spec §32).
 *

const CACHE_KEY = "blackmusic:promotionsCache";
const VIEWS_KEY = "blackmusic:promotionViews";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface Cache {
  fetchedAt: number;
  promotions: Promotion[];
}

export async function loadApiPromotions(): Promise<Promotion[]> {
  const cached = await getPreference<Cache | null>(CACHE_KEY, null);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return sanitize(cached.promotions);

  const base = import.meta.env.VITE_PROMOTIONS_API_URL as string | undefined;
  if (!base) return sanitize(cached?.promotions ?? []);

  try {
    const response = await serviceFetch(`${base.replace(/\/$/, "")}/api/promotions`);
    if (!response.ok) throw new Error(String(response.status));
    const body = (await response.json()) as { success?: boolean; promotions?: Promotion[] };
    const promotions = sanitize(body.promotions ?? []);
    await setPreference<Cache>(CACHE_KEY, { fetchedAt: Date.now(), promotions });
    return promotions;
  } catch {
    // API unavailable -> stale cache -> otherwise nothing. Music keeps working.
    return sanitize(cached?.promotions ?? []);
  }
}

function sanitize(list: Promotion[]): Promotion[] {
  return list.filter(
    (p) => p && p.enabled !== false && p.source === "involve-asia" && isPlacementAllowed(p) && (p.trackingUrl || p.destinationUrl),
  );
}

// --- Frequency control ---------------------------------------------------------

interface DayViews {
  date: string;
  counts: Record<string, number>;
}

const sessionViews = new Map<string, number>();
const today = () => new Date().toISOString().slice(0, 10);

export async function eligibleForView(
  promotion: Promotion,
  caps: { maxViewsPerSession: number; maxViewsPerDay: number },
): Promise<boolean> {
  if ((sessionViews.get(promotion.id) ?? 0) >= caps.maxViewsPerSession) return false;
  const stored = await getPreference<DayViews>(VIEWS_KEY, { date: today(), counts: {} });
  const counts = stored.date === today() ? stored.counts : {};
  return (counts[promotion.id] ?? 0) < caps.maxViewsPerDay;
}

export async function recordView(promotionId: string): Promise<void> {
  sessionViews.set(promotionId, (sessionViews.get(promotionId) ?? 0) + 1);
  const stored = await getPreference<DayViews>(VIEWS_KEY, { date: today(), counts: {} });
  const counts = stored.date === today() ? stored.counts : {};
  counts[promotionId] = (counts[promotionId] ?? 0) + 1;
  await setPreference<DayViews>(VIEWS_KEY, { date: today(), counts });
}
  */

import type { Promotion } from "./types";
import { isPlacementAllowed } from "./types";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { serviceFetch } from "@/lib/services/serviceFetch";

/**
 * Involve Asia promotions arrive from the BlackMusic BACKEND (the Supabase Edge Function / promotions server).
 * The Involve API key/secret live only there — this client never sees them. The app reads
 * `GET {VITE_PROMOTIONS_API_URL}/api/promotions`, keeps a local copy, and shows nothing if everything fails
 * (music always keeps working) — but now it tells you WHY in the console and in Settings → Promotions.
 */

const CACHE_KEY = "blackmusic:promotionsCache";
const VIEWS_KEY = "blackmusic:promotionViews";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface Cache {
  fetchedAt: number;
  promotions: Promotion[];
}

export interface PromotionsStatus {
  backendUrl: string | null;
  source: "network" | "cache" | "none";
  total: number;
  byPlacement: Record<string, number>;
  error: string | null;
  at: number | null;
}

let status: PromotionsStatus = { backendUrl: null, source: "none", total: 0, byPlacement: {}, error: null, at: null };
export const getPromotionsStatus = (): PromotionsStatus => status;

function setStatus(list: Promotion[], source: PromotionsStatus["source"], backendUrl: string | null, error: string | null) {
  const byPlacement: Record<string, number> = {};
  for (const p of list) byPlacement[p.placement] = (byPlacement[p.placement] ?? 0) + 1;
  status = { backendUrl, source, total: list.length, byPlacement, error, at: Date.now() };
}

export async function loadApiPromotions(force = false): Promise<Promotion[]> {
  const base = (import.meta.env.VITE_PROMOTIONS_API_URL as string | undefined)?.trim() || null;
  const cached = await getPreference<Cache | null>(CACHE_KEY, null);

  // Only trust a cache that actually contains promotions — an EMPTY cached answer (e.g. from an early, broken
  // backend response) used to hide promotions for 30 minutes.
  if (!force && cached && cached.promotions.length > 0 && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    const list = sanitize(cached.promotions);
    setStatus(list, "cache", base, null);
    return list;
  }

  if (!base) {
    const message = "VITE_PROMOTIONS_API_URL is not set in the running app. Edit .env, then fully restart `pnpm tauri dev` (Vite only reads .env at startup).";
    console.warn(`[promotions] ${message}`);
    const list = sanitize(cached?.promotions ?? []);
    setStatus(list, list.length ? "cache" : "none", null, message);
    return list;
  }

  try {
    const response = await serviceFetch(`${base.replace(/\/$/, "")}/api/promotions`);
    if (!response.ok) throw new Error(`Backend answered HTTP ${response.status}`);
    const body = (await response.json()) as { success?: boolean; error?: string; promotions?: Promotion[] };
    const raw = body.promotions ?? [];
    const list = sanitize(raw);
    console.info(`[promotions] backend sent ${raw.length}, ${list.length} usable`, body.error ? `(backend error: ${body.error})` : "");
    if (raw.length > 0 && list.length === 0) console.warn("[promotions] all entries were rejected by sanitize() — check source/placement/enabled/trackingUrl fields.");
    if (list.length > 0) await setPreference<Cache>(CACHE_KEY, { fetchedAt: Date.now(), promotions: list });
    setStatus(list, "network", base, list.length === 0 ? body.error ?? "The backend returned no promotions." : null);
    return list;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[promotions] fetch failed:", error);
    const list = sanitize(cached?.promotions ?? []);
    setStatus(list, list.length ? "cache" : "none", base, message);
    return list;
  }
}

function sanitize(list: Promotion[]): Promotion[] {
  return list.filter(
    (p) => p && p.enabled !== false && p.source === "involve-asia" && isPlacementAllowed(p) && (p.trackingUrl || p.destinationUrl),
  );
}

// --- Frequency control ---------------------------------------------------------
// While developing (`pnpm tauri dev`) the limits are OFF so you can see promotions on every visit;
// release builds enforce them (see frequencyCap in types.ts).

interface DayViews {
  date: string;
  counts: Record<string, number>;
}

const sessionViews = new Map<string, number>();
const today = () => new Date().toISOString().slice(0, 10);

export async function eligibleForView(
  promotion: Promotion,
  caps: { maxViewsPerSession: number; maxViewsPerDay: number },
): Promise<boolean> {
  if (import.meta.env.DEV) return true;
  if ((sessionViews.get(promotion.id) ?? 0) >= caps.maxViewsPerSession) return false;
  const stored = await getPreference<DayViews>(VIEWS_KEY, { date: today(), counts: {} });
  const counts = stored.date === today() ? stored.counts : {};
  return (counts[promotion.id] ?? 0) < caps.maxViewsPerDay;
}

export async function recordView(promotionId: string): Promise<void> {
  if (import.meta.env.DEV) return;
  sessionViews.set(promotionId, (sessionViews.get(promotionId) ?? 0) + 1);
  const stored = await getPreference<DayViews>(VIEWS_KEY, { date: today(), counts: {} });
  const counts = stored.date === today() ? stored.counts : {};
  counts[promotionId] = (counts[promotionId] ?? 0) + 1;
  await setPreference<DayViews>(VIEWS_KEY, { date: today(), counts });
}

/** Settings → Promotions → "Reset": forget the cached list and all view counts. */
export async function resetPromotionState(): Promise<void> {
  sessionViews.clear();
  await setPreference<Cache | null>(CACHE_KEY, null);
  await setPreference<DayViews>(VIEWS_KEY, { date: today(), counts: {} });
}
