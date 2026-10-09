// Supabase Edge Function — GET /functions/v1/promotions
//
// This is the ONLY place the Involve Asia API key/secret are ever used. The
// Tauri client calls this function (see src/lib/services/promotions.ts); it
// never talks to api.involve.asia directly, and the secret never ships in
// the app bundle. See update_blackmusic_2.1.0.md sections 28–32 for the
// architecture this implements.
//
// Deploy:
//   supabase functions deploy promotions
//   supabase secrets set INVOLVE_API_KEY=general INVOLVE_API_SECRET=... INVOLVE_API_BASE_URL=https://api.involve.asia/api
//
// VERIFY BEFORE GOING LIVE: Involve Asia publishes an OpenAPI 3.1 spec and a
// Postman collection for their Publisher API (linked from their API docs at
// developers.involve.asia at the time this was written). The shapes below
// (POST /authenticate with api_key/secret_key returning a bearer token good
// for ~2 hours; GET /offers; POST /deeplink/generate) match their publicly
// documented pattern, but field names can drift — diff this against their
// current OpenAPI spec before relying on it in production.

/** 

const INVOLVE_API_KEY = Deno.env.get("INVOLVE_API_KEY") ?? "";
const INVOLVE_API_SECRET = Deno.env.get("INVOLVE_API_SECRET") ?? "";
const INVOLVE_API_BASE_URL = Deno.env.get("INVOLVE_API_BASE_URL") ?? "https://api.involve.asia/api";

// In-memory cache, scoped to this function instance. Edge Functions can spin
// up a fresh instance at any time, so this is a *speed-up*, not the durable
// cache — section 31 of the spec wants a real scheduled sync into a table so
// promotions survive cold starts too. See the TODO near the bottom for
// wiring that up once you have a `promotions_cache` table.
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedOffers: { offers: RawOffer[]; fetchedAt: number } | null = null;
const OFFERS_CACHE_TTL_MS = 15 * 60 * 1000; // don't hammer Involve Asia on every app open — section 31

interface RawOffer {
  id: string;
  name?: string;
  advertiser_name?: string;
  description?: string;
  banner_url?: string;
  tracking_link?: string;
  status?: string;
}

export interface Promotion {
  id: string;
  source: "involve-asia";
  type: "campaign";
  brandName: string;
  title: string;
  description: string;
  imageUrl: string | null;
  trackingUrl: string;
  // Only the API-eligible placements are ever emitted — see the placement
  // validation below and section 27 of the spec. This function decides
  // `placement`, the client never gets to reassign one.
  placement: "local" | "online" | "library-all-music";
}

const API_ALLOWED_PLACEMENTS: Promotion["placement"][] = ["local", "online", "library-all-music"];

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  if (!INVOLVE_API_KEY || !INVOLVE_API_SECRET) return null;

  try {
    const response = await fetch(`${INVOLVE_API_BASE_URL}/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ api_key: INVOLVE_API_KEY, secret_key: INVOLVE_API_SECRET }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const token: string | undefined = data.data?.token ?? data.token;
    if (!token) return null;
    cachedToken = { token, expiresAt: Date.now() + 2 * 60 * 60 * 1000 };
    return token;
  } catch {
    return null;
  }
}

async function fetchOffers(): Promise<RawOffer[]> {
  if (cachedOffers && Date.now() - cachedOffers.fetchedAt < OFFERS_CACHE_TTL_MS) {
    return cachedOffers.offers;
  }

  const token = await getAccessToken();
  if (!token) return cachedOffers?.offers ?? []; // section 32: fall back to stale cache rather than failing outright

  try {
    const response = await fetch(`${INVOLVE_API_BASE_URL}/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return cachedOffers?.offers ?? [];
    const data = await response.json();
    const offers: RawOffer[] = data.data ?? data.offers ?? [];
    cachedOffers = { offers, fetchedAt: Date.now() };
    return offers;
  } catch {
    return cachedOffers?.offers ?? [];
  }
}

// Maps a raw Involve Asia offer to a BlackMusic Promotion, or null to drop it (missing fields, wrong status). 
function toPromotion(offer: RawOffer, placement: Promotion["placement"]): Promotion | null {
  if (offer.status && offer.status.toLowerCase() !== "approved" && offer.status.toLowerCase() !== "active") {
    return null;
  }
  if (!offer.tracking_link) return null; // section 36: don't show a promotion with nowhere to send the click

  return {
    id: offer.id,
    source: "involve-asia",
    type: "campaign",
    brandName: offer.advertiser_name ?? "Sponsor",
    title: offer.name ?? offer.advertiser_name ?? "Featured offer",
    description: offer.description ?? "",
    imageUrl: offer.banner_url ?? null,
    trackingUrl: offer.tracking_link,
    placement,
  };
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  // Which surface is asking — home/local/online/library all get their own
  // small, curated slice rather than one firehose of every approved offer
  // (section 36: quality over quantity). Defaults to "online" if unspecified.
  const placementParam = (url.searchParams.get("placement") ?? "online") as Promotion["placement"];
  const placement = API_ALLOWED_PLACEMENTS.includes(placementParam) ? placementParam : "online";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "6"), 20);

  try {
    const offers = await fetchOffers();
    const promotions = offers
      .map((offer) => toPromotion(offer, placement))
      .filter((p): p is Promotion => p !== null)
      .slice(0, limit);

    return new Response(JSON.stringify({ success: true, promotions }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Section 32: affiliate functionality must never break BlackMusic. Any
    // failure here still returns a 200 with an empty list, never a 500 that
    // could cascade into a client-side error boundary.
    return new Response(JSON.stringify({ success: false, promotions: [], error: String(error) }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// TODO (post-v1, see section 34 — don't build this until it's actually needed):
// Replace the in-memory `cachedOffers` with a `promotions_cache` Postgres
// table written by a scheduled (pg_cron / GitHub Actions) hit of this
// function, so the cache survives cold starts and every client read is a
// cheap table read rather than depending on this instance's memory.

**/

// Supabase Edge Function (Deno): Involve Asia -> BlackMusic promotions. Public data, no login required.
const BASE = (Deno.env.get("INVOLVE_API_BASE_URL") ?? "https://api.involve.asia/api").replace(/\/$/, "");
const KEY = Deno.env.get("INVOLVE_API_KEY");
const SECRET = Deno.env.get("INVOLVE_API_SECRET");
const COUNTRIES = Deno.env.get("INVOLVE_COUNTRIES") ?? ""; // optional, pipe-separated e.g. Philippines|Singapore
const ALLOWED = (Deno.env.get("ALLOWED_CATEGORIES") ?? "").split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
const TTL_MS = 30 * 60_000;
const BACKOFF = [250, 500, 1000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

let token: string | null = null;
let tokenExpiresAt = 0;
let cache: { syncedAt: number; promotions: Row[]; counts: { offers: number; campaigns: number }; error?: string } = {
  syncedAt: 0, promotions: [], counts: { offers: 0, campaigns: 0 },
};
let inflight: Promise<void> | null = null;

async function authenticate() {
  if (!KEY || !SECRET) throw new Error("INVOLVE_API_KEY / INVOLVE_API_SECRET are not set in Supabase secrets");
  const response = await fetch(`${BASE}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: KEY, secret: SECRET }),
  });
  if (!response.ok) throw new Error(`authenticate failed: ${response.status}`);
  const body = await response.json();
  token = body?.data?.token;
  if (!token) throw new Error("authenticate: no token in response");
  tokenExpiresAt = Date.now() + 110 * 60_000;
}

async function involve(path: string, fields: Record<string, string> = {}, retried = false): Promise<Row> {
  if (!token || Date.now() > tokenExpiresAt) await authenticate();
  let attempt = 0;
  for (;;) {
    const response = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    });
    if (response.status === 401 && !retried) {
      await authenticate();
      return involve(path, fields, true);
    }
    if (response.status === 429) {
      await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
      if (++attempt > 6) throw new Error("rate limited");
      continue;
    }
    if (!response.ok) throw new Error(`${path} -> ${response.status}`);
    return response.json();
  }
}

async function pageAll(path: string, fields: Record<string, string>, maxPages = 5): Promise<Row[]> {
  const rows: Row[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const body = await involve(path, { ...fields, page: String(page), limit: "100" });
    const env = body?.data ?? {};
    rows.push(...(env.data ?? []));
    if (page * 100 >= (env.count ?? 0)) break;
    await sleep(1100); // stay far below 60 requests/minute
  }
  return rows;
}

async function sync() {
  const offerFilters: Record<string, string> = { "filters[application_status]": "Approved", "filters[offer_status]": "Active" };
  if (COUNTRIES) offerFilters["filters[offer_country]"] = COUNTRIES;
  const offers = await pageAll("/offers/all", offerFilters);
  const approved = new Map(offers.map((o) => [String(o.offer_id), o]));

  const campaignFilters: Record<string, string> = { "filters[with_banner]": "true", "filters[device_type]": "desktop" };
  if (COUNTRIES) campaignFilters["filters[country]"] = COUNTRIES;
  const campaigns = await pageAll("/campaigns/all", campaignFilters);

  const today = new Date().toISOString().slice(0, 10);
  const promotions: Row[] = [];
  for (const c of campaigns) {
    const offer = approved.get(String(c.offer_id));
    if (!offer) continue;
    if (c.date_campaign_end && c.date_campaign_end < today) continue;
    if (!c.tracking_link) continue;
    const category = String(c.categories || offer.categories || "");
    if (ALLOWED.length && !ALLOWED.some((a) => category.toLowerCase().includes(a))) continue;
    const base = {
      id: `ia-${c.campaign_banner_id ?? c.offer_id}`,
      source: "involve-asia",
      type: "campaign",
      brandName: c.offer_name || offer.offer_name || "Offer",
      title: c.campaign_name || c.offer_name || "Special offer",
      description: c.description || undefined,
      category,
      imageUrl: c.banner_image_url || offer.logo || undefined,
      trackingUrl: c.tracking_link,
      campaignName: c.campaign_name,
      enabled: true,
    };
    for (const placement of ["local", "online", "library-all-music"]) {
      promotions.push({ ...base, id: `${base.id}-${placement}`, placement });
    }
  }
  cache = { syncedAt: Date.now(), promotions, counts: { offers: offers.length, campaigns: campaigns.length } };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (Date.now() - cache.syncedAt > TTL_MS) {
    inflight ??= sync().catch((e) => { cache.error = String(e?.message ?? e); }).finally(() => { inflight = null; });
    if (cache.syncedAt === 0) await inflight;                  // first call must wait for data
    else EdgeRuntime?.waitUntil(inflight);                     // later: serve stale, refresh in the background
  }

  // `counts` and `error` make "why is it empty?" answerable by just opening the URL in a browser.
  return json({ success: !cache.error || cache.syncedAt > 0, syncedAt: cache.syncedAt, counts: cache.counts, error: cache.error, promotions: cache.promotions });
});