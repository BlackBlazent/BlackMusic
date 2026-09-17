import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let loadPromise: Promise<SupabaseClient | null> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/** Lazily creates the client only once Supabase env vars are actually present. */
export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;

  if (!loadPromise) {
    loadPromise = import("@supabase/supabase-js").then(({ createClient }) => {
      client = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      );
      return client;
    });
  }
  return loadPromise;
}
