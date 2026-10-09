#!/usr/bin/env node
/**
 * BlackMusic promotions backend (Involve Asia Publisher API v2).
 *
 * WHY THIS EXISTS: the Involve API key + secret must never ship inside the
 * Tauri app. This tiny server holds them, authenticates, syncs on a schedule,
 * filters, caches, and exposes only the already-filtered result to the app:
 *
 *     GET /api/promotions  ->  { success, promotions: [...] }
 *
 * Zero dependencies (Node 18+). Deploy anywhere (e.g. your Render service) and
 * set the secrets in the host's secret environment — NOT in a .env in the repo:
 *
 *   INVOLVE_API_KEY=...
 *   INVOLVE_API_SECRET=...
 *   INVOLVE_API_BASE_URL=https://api.involve.asia/api      (default)
 *   INVOLVE_COUNTRIES=Philippines|Singapore                (optional, pipe-separated)
 *   ALLOWED_CATEGORIES=                                    (optional, pipe-separated allow-list)
 *   PORT=8787
 *   SYNC_MINUTES=30
 *
 * Notes on the Involve API (from the docs supplied with the 2.1.0 spec):
 *   - Bearer JWT, 2-hour lifetime -> cached, re-auth on 401
 *   - 60 requests/min/account -> sequential calls, exponential backoff on 429
 *   - /authenticate field names (`key`, `secret`) follow the public docs; verify
 *     against your account if authentication is rejected.
 *   - Deeplink generation (/deeplink/generate) is intentionally NOT used in v1.
 */
import http from "node:http";

const BASE = (process.env.INVOLVE_API_BASE_URL || "https://api.involve.asia/api").replace(/\/$/, "");
const KEY = process.env.INVOLVE_API_KEY;
const SECRET = process.env.INVOLVE_API_SECRET;
const PORT = Number(process.env.PORT || 8787);
const SYNC_MS = Number(process.env.SYNC_MINUTES || 30) * 60_000;
const COUNTRIES = process.env.INVOLVE_COUNTRIES || "";
const ALLOWED_CATEGORIES = (process.env.ALLOWED_CATEGORIES || "").split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);

const BACKOFF = [250, 500, 1000];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let token = null;
let tokenExpiresAt = 0;
let cache = { syncedAt: 0, promotions: [] };

async function authenticate() {
  if (!KEY || !SECRET) throw new Error("INVOLVE_API_KEY / INVOLVE_API_SECRET are not set");
  const response = await fetch(`${BASE}/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: KEY, secret: SECRET }),
  });
  if (!response.ok) throw new Error(`authenticate failed: ${response.status}`);
  const body = await response.json();
  token = body?.data?.token;
  if (!token) throw new Error("authenticate: no token in response");
  tokenExpiresAt = Date.now() + 110 * 60_000; // token lives 2h; refresh a little early
}

async function involve(path, fields = {}, { retried = false } = {}) {
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
      return involve(path, fields, { retried: true });
    }
    if (response.status === 429) {
      await sleep(BACKOFF[Math.min(attempt, BACKOFF.length - 1)]);
      attempt += 1;
      if (attempt > 6) throw new Error("rate limited");
      continue;
    }
    if (!response.ok) throw new Error(`${path} -> ${response.status}`);
    return response.json();
  }
}

/** Walks `{ data: { page, limit, count, data: [...] } }` envelopes. */
async function pageAll(path, fields, maxPages = 10) {
  const rows = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const body = await involve(path, { ...fields, page: String(page), limit: "100" });
    const env = body?.data ?? {};
    rows.push(...(env.data ?? []));
    if (page * 100 >= (env.count ?? 0)) break;
    await sleep(1100); // stay far below 60 req/min
  }
  return rows;
}

async function sync() {
  // 1. Offers we're APPROVED for and that are ACTIVE — never arbitrary offers.
  const offerFilters = { "filters[application_status]": "Approved", "filters[offer_status]": "Active" };
  if (COUNTRIES) offerFilters["filters[offer_country]"] = COUNTRIES;
  const offers = await pageAll("/offers/all", offerFilters);
  const approved = new Map(offers.map((o) => [String(o.offer_id), o]));

  // 2. Desktop campaigns that come with usable banner creatives.
  const campaignFilters = { "filters[with_banner]": "true", "filters[device_type]": "desktop" };
  if (COUNTRIES) campaignFilters["filters[country]"] = COUNTRIES;
  const campaigns = await pageAll("/campaigns/all", campaignFilters);

  const today = new Date().toISOString().slice(0, 10);
  const promotions = [];
  for (const c of campaigns) {
    const offer = approved.get(String(c.offer_id));
    if (!offer) continue; // not approved/active
    if (c.date_campaign_end && c.date_campaign_end < today) continue; // expired
    if (!c.tracking_link) continue; // nothing to redirect to
    const category = String(c.categories || offer.categories || "");
    if (ALLOWED_CATEGORIES.length && !ALLOWED_CATEGORIES.some((a) => category.toLowerCase().includes(a))) continue;

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
    // The same approved offer can be offered in each API placement; the app
    // applies its own per-placement limits and frequency cap.
    for (const placement of ["local", "online", "library-all-music"]) promotions.push({ ...base, id: `${base.id}-${placement}`, placement });
  }

  cache = { syncedAt: Date.now(), promotions };
  console.log(`[promotions] synced ${campaigns.length} campaigns -> ${promotions.length} placements`);
}

async function safeSync() {
  try {
    await sync();
  } catch (error) {
    // Failure behavior (spec §32): keep serving the previous cache, or an empty list.
    console.error("[promotions] sync failed:", error.message);
  }
}

const server = http.createServer((req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*", // the Tauri webview origin varies per platform
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  if (req.method === "GET" && req.url?.split("?")[0] === "/api/promotions") {
    res.writeHead(200, { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" });
    return res.end(JSON.stringify({ success: true, syncedAt: cache.syncedAt, promotions: cache.promotions }));
  }
  if (req.url === "/health") return res.writeHead(200, cors).end("ok");
  res.writeHead(404, cors).end();
});

server.listen(PORT, () => console.log(`[promotions] listening on :${PORT}`));
void safeSync();
setInterval(safeSync, SYNC_MS);
