import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let loadPromise: Promise<SupabaseClient | null> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export const SUPABASE_AUTH_REDIRECT = "blackmusic://auth/callback";

/** Lazily creates the client only once Supabase env vars are actually present. */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;

  if (!loadPromise) {
    loadPromise = import("@supabase/supabase-js").then(({ createClient }) => {
      client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: {
          // PKCE + a manual `exchangeCodeForSession` call (see AuthContext's
          // deep-link listener) is the approach Supabase itself recommends for
          // desktop/mobile apps — there's no browser location bar for Supabase's
          // default implicit-flow, detect-the-URL-automatically behavior to work
          // against, so that has to be turned off and done by hand instead.
          flowType: "pkce",
          detectSessionInUrl: false,
        },
      });
      return client;
    });
  }
  return loadPromise;
}
