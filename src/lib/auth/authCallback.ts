import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turns a `blackmusic://auth/callback...` deep link into a Supabase session.
 *
 * The 2.0.0 bug: `exchangeCodeForSession` takes the bare auth *code*, not the
 * whole callback URL — passing the URL made the exchange fail silently, which
 * is exactly the "callback returns to the app but nobody is logged in"
 * symptom. This parses every shape Supabase can send back:
 *   - PKCE:      blackmusic://auth/callback?code=...
 *   - implicit:  blackmusic://auth/callback#access_token=...&refresh_token=...
 *   - failure:   ?error=...&error_description=...
 */
export async function completeAuthFromUrl(
  client: SupabaseClient,
  callbackUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, error: "The sign-in callback link was malformed." };
  }

  const query = parsed.searchParams;
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const read = (key: string) => query.get(key) ?? hash.get(key);

  const providerError = read("error_description") ?? read("error");
  if (providerError) return { ok: false, error: decodeURIComponent(providerError.replace(/\+/g, " ")) };

  const code = query.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  return { ok: false, error: "The sign-in callback didn't include a code or token." };
}
