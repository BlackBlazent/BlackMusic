import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { CloseIcon } from "./icons";
import "./AccountModal.css";

export function AccountModal({ onClose }: { onClose: () => void }) {
  const { user, configured, loading, error, signInWithEmail, signUpWithEmail, signInWithProvider, signOut } =
    useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "login") void signInWithEmail(email, password);
    else void signUpWithEmail(email, password);
  };

  return (
    <div className="account-modal__backdrop" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="account-modal__header">
          <h2>Account</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {!configured && (
          <p className="account-modal__notice">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env</code> to enable accounts.
          </p>
        )}

        {user ? (
          <div className="account-modal__signed-in">
            <p>Signed in as {user.email ?? user.id}</p>
            <button type="button" className="account-modal__submit" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="account-modal__tabs">
              <button type="button" data-active={mode === "login"} onClick={() => setMode("login")}>
                Log in
              </button>
              <button type="button" data-active={mode === "signup"} onClick={() => setMode("signup")}>
                Sign up
              </button>
            </div>

            <form className="account-modal__form" onSubmit={onSubmit}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && <p className="account-modal__error">{error}</p>}
              <button type="submit" className="account-modal__submit" disabled={!configured || loading}>
                {loading ? "Working…" : mode === "login" ? "Log in" : "Create account"}
              </button>
            </form>

            <div className="account-modal__divider">or continue with</div>

            <div className="account-modal__providers">
              <button type="button" disabled={!configured} onClick={() => void signInWithProvider("google")}>
                Google
              </button>
              <button type="button" disabled={!configured} onClick={() => void signInWithProvider("github")}>
                GitHub
              </button>
              <button type="button" disabled={!configured} onClick={() => void signInWithProvider("facebook")}>
                Facebook
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
