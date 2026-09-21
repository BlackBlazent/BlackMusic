import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient, isSupabaseConfigured, SUPABASE_AUTH_REDIRECT } from "@/lib/supabaseClient";
import { openInSystemBrowser } from "@/lib/services/openInSystemBrowser";
import { isTauri } from "@/lib/platform";

interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  configured: boolean;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: "google" | "github" | "facebook") => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ ok: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    let unsubscribe: (() => void) | undefined;

    getSupabaseClient().then((client) => {
      if (!client) return;
      client.auth.getSession().then(({ data }) => {
        setUser(data.session ? { id: data.session.user.id, email: data.session.user.email ?? null } : null);
      });
      const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
        setUser(session ? { id: session.user.id, email: session.user.email ?? null } : null);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => unsubscribe?.();
  }, [configured]);

  // Catches `blackmusic://auth/callback?code=...` once Supabase finishes its
  // own exchange with the provider (GitHub/Google/Facebook) and redirects the
  // system browser back to us. See supabaseClient.ts for why this is a manual
  // `exchangeCodeForSession` call rather than Supabase's automatic
  // detect-it-from-the-browser-URL behavior — there's no browser location bar
  // in a desktop app for that to work against.
  useEffect(() => {
    if (!configured || !isTauri()) return;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/plugin-deep-link").then(({ onOpenUrl }) => {
      onOpenUrl(async (urls) => {
        const callbackUrl = urls.find((u) => u.startsWith(SUPABASE_AUTH_REDIRECT));
        if (!callbackUrl) return;
        const client = await getSupabaseClient();
        if (!client) return;
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(callbackUrl);
        if (exchangeError) setError(exchangeError.message);
      }).then((fn) => {
        unlisten = fn;
      });
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
    signInWithEmail: (email, password) => run((c) => c.auth.signInWithPassword({ email, password })),
    signUpWithEmail: (email, password) => run((c) => c.auth.signUp({ email, password })),
    signInWithProvider: async (provider) => {
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
        options: { redirectTo: SUPABASE_AUTH_REDIRECT, skipBrowserRedirect: true },
      });
      if (authError) setError(authError.message);
      else if (data.url) await openInSystemBrowser(data.url);
      setLoading(false);
    },
    signOut: async () => {
      const client = await getSupabaseClient();
      await client?.auth.signOut();
      setUser(null);
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
