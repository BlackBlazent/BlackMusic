import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured, SUPABASE_AUTH_REDIRECT } from "@/lib/supabaseClient";
import { openInSystemBrowser } from "@/lib/services/openInSystemBrowser";
import { isTauri } from "@/lib/platform";
import { completeAuthFromUrl } from "@/lib/auth/authCallback";
import { storeSpotifyProviderTokens } from "@/lib/services/spotifyClient";
import { useNotifications } from "./NotificationsContext";

export type AuthProviderId = "google" | "github" | "facebook" | "spotify";

export interface AuthUser {
  id: string;
  email: string | null;
  /** Full name as reported by the sign-in provider (or entered at sign-up). */
  fullName: string | null;
  /** Profile picture URL from the provider (Google/GitHub/Facebook/Spotify). */
  avatarUrl: string | null;
  /** "google" | "github" | "facebook" | "spotify" | "email" */
  provider: string;
}

function toAuthUser(session: Session): AuthUser {
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const identity = u.identities?.[0]?.identity_data as Record<string, unknown> | undefined;
  return {
    id: u.id,
    email: u.email ?? str(meta.email) ?? str(identity?.email),
    fullName: str(meta.full_name) ?? str(meta.name) ?? str(identity?.full_name) ?? str(identity?.name) ?? str(meta.user_name),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture) ?? str(identity?.avatar_url) ?? str(identity?.picture),
    provider: str(u.app_metadata?.provider) ?? "email",
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  configured: boolean;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: AuthProviderId, options?: { scopes?: string }) => Promise<void>;
  /** Message shown after a successful email sign-up that still needs confirmation. */
  notice: string | null;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { push } = useNotifications();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const configured = isSupabaseConfigured();
  const pushRef = useRef(push);
  const lastNotifiedUser = useRef<string | null>(null);
  pushRef.current = push;

  useEffect(() => {
    if (!configured) return;
    let unsubscribe: (() => void) | undefined;

    getSupabaseClient().then((client) => {
      if (!client) return;
      client.auth.getSession().then(({ data }) => {
        setUser(data.session ? toAuthUser(data.session) : null);
      });
      const { data: sub } = client.auth.onAuthStateChange((event, session) => {
        setUser(session ? toAuthUser(session) : null);
        if (session && event === "SIGNED_IN") {
          const next = toAuthUser(session);
          // Spotify signs in through Supabase now — its provider token is the
          // Spotify access token, so hand it to the Spotify client.
          if (next.provider === "spotify" && session.provider_token) {
            void storeSpotifyProviderTokens(session.provider_token, session.provider_refresh_token ?? null);
          }
          if (lastNotifiedUser.current !== next.id) {
            lastNotifiedUser.current = next.id;
            pushRef.current("Signed in", `Welcome${next.fullName ? `, ${next.fullName}` : ""}! You're signed in${next.email ? ` as ${next.email}` : ""}.`);
          }
        }
        if (event === "SIGNED_OUT") lastNotifiedUser.current = null;
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => unsubscribe?.();
  }, [configured]);

  // Catches `blackmusic://auth/callback?code=...` once Supabase finishes its
  // own exchange with the provider and redirects the system browser back to
  // us. Two delivery paths matter on desktop:
  //   1. the app was already running -> `onOpenUrl` fires (single-instance
  //      plugin forwards the second process's URL to this one)
  //   2. the app was cold-started by the link -> `getCurrent()` has it
  useEffect(() => {
    if (!configured || !isTauri()) return;
    let unlisten: (() => void) | undefined;
    const handled = new Set<string>();

    const handle = async (urls: string[] | null) => {
      const callbackUrl = urls?.find((u) => u.startsWith(SUPABASE_AUTH_REDIRECT));
      if (!callbackUrl || handled.has(callbackUrl)) return;
      handled.add(callbackUrl);
      const client = await getSupabaseClient();
      if (!client) return;
      setLoading(true);
      const result = await completeAuthFromUrl(client, callbackUrl);
      setLoading(false);
      if (!result.ok) setError(result.error ?? "Sign-in failed.");
      else setError(null);
    };

    import("@tauri-apps/plugin-deep-link").then(async ({ onOpenUrl, getCurrent }) => {
      void handle(await getCurrent());
      unlisten = await onOpenUrl((urls) => void handle(urls));
    });

    return () => unlisten?.();
  }, [configured]);

  const run = async (fn: (client: NonNullable<Awaited<ReturnType<typeof getSupabaseClient>>>) => Promise<{ error: { message: string } | null }>) => {
    const client = await getSupabaseClient();
    if (!client) {
      setError("Supabase isn't configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await fn(client);
    if (authError) setError(authError.message);
    setLoading(false);
  };

  const value: AuthContextValue = {
    user,
    configured,
    loading,
    error,
    notice,
    signInWithEmail: (email, password) => run((c) => c.auth.signInWithPassword({ email, password })),
    signUpWithEmail: async (email, password) => {
      setNotice(null);
      await run(async (c) => {
        const { data, error: signUpError } = await c.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: SUPABASE_AUTH_REDIRECT },
        });
        // No session back = Supabase wants the email confirmed first.
        if (!signUpError && !data.session) setNotice("Check your inbox to confirm your email, then log in.");
        return { error: signUpError };
      });
    },
    signInWithProvider: async (provider, options) => {
      const client = await getSupabaseClient();
      if (!client) {
        setError("Supabase isn't configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
        return;
      }
      setLoading(true);
      setError(null);
      // `skipBrowserRedirect` because there's no in-app browser to redirect —
      // this just returns the provider's authorize URL, which we open in the
      // system browser ourselves (same pattern as Spotify's connect flow).
      const { data, error: authError } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: SUPABASE_AUTH_REDIRECT, skipBrowserRedirect: true, scopes: options?.scopes },
      });
      if (authError) setError(authError.message);
      else if (data.url) await openInSystemBrowser(data.url);
      setLoading(false);
    },
    signOut: async () => {
      const client = await getSupabaseClient();
      await client?.auth.signOut();
      setUser(null);
      pushRef.current("Signed out", "You've been signed out of BlackMusic.");
    },
    deleteAccount: async () => {
      const client = await getSupabaseClient();
      if (!client) return { ok: false, message: "Supabase isn't configured." };
      // Supabase has no client-side "delete my own account" call — deleting a
      // user requires the admin API (a service-role key, which must never be
      // shipped in this app) or a Supabase Edge Function that runs with that
      // key server-side and checks the caller's own session before deleting.
      // Wire one up and call it here — e.g. `client.functions.invoke("delete-account")`
      // — once it exists; there isn't one yet, so this is honest about that
      // instead of pretending to delete anything.
      return {
        ok: false,
        message: "Account deletion needs a small server-side function — not set up yet. Sign out is available now.",
      };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
