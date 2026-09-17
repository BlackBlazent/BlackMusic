import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";

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
    signInWithProvider: (provider) => run((c) => c.auth.signInWithOAuth({ provider })),
    signOut: async () => {
      const client = await getSupabaseClient();
      await client?.auth.signOut();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
