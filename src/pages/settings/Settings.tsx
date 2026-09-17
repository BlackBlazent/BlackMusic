import { useState } from "react";
import { useTheme, type Theme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/context/AuthContext";
import { useAppSettings, INTEGRATIONS } from "@/app/context/AppSettingsContext";
import { Switch } from "@/app/components/Switch";
import { checkForUpdate, installUpdateAndRelaunch, type UpdateInfo } from "@/lib/updater";
import { isTauri } from "@/lib/platform";
import "./Settings.css";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const APP_VERSION = "2.0.0"; // mirrors src-tauri/tauri.conf.json's "version"

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, configured } = useAuth();
  const { isEnabled, setEnabled } = useAppSettings();

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="settings__section">
        <h2>Appearance</h2>
        <p>BlackMusic supports dark and light — no other theme variants.</p>
        <div className="settings__theme-options" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={theme === option.value}
              className="settings__theme-option"
              data-active={theme === option.value}
              onClick={() => setTheme(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h2>Integrations</h2>
        <p>
          Turn a service off and BlackMusic won't reach out to it at all — no background requests,
          no entry in the logo menu. Last.fm and YouTube default to off.
        </p>
        <div className="settings__integrations">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.id} className="settings__integration-row">
              <div>
                <span className="settings__integration-name">{integration.name}</span>
                <span className="settings__integration-desc">{integration.description}</span>
              </div>
              <Switch
                checked={isEnabled(integration.id)}
                onChange={(next) => setEnabled(integration.id, next)}
                label={`Toggle ${integration.name}`}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="settings__section">
        <h2>Account</h2>
        {configured ? (
          <p>{user ? `Signed in as ${user.email ?? user.id}.` : "Not signed in — use the account icon in the top bar."}</p>
        ) : (
          <p>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code>.env</code> to enable accounts.
          </p>
        )}
      </section>

      <UpdatesSection />

      <section className="settings__section settings__section--pending">
        <h2>Playback</h2>
        <p>Default playback mode, noise removal, and loop behavior — coming with Playground.</p>
      </section>
    </div>
  );
}

function UpdatesSection() {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "installing" | "error">(
    "idle",
  );
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onCheck = async () => {
    setStatus("checking");
    setErrorMessage(null);
    try {
      const found = await checkForUpdate();
      setUpdate(found);
      setStatus(found ? "available" : "up-to-date");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Couldn't check for updates.");
      setStatus("error");
    }
  };

  const onInstall = async () => {
    setStatus("installing");
    try {
      await installUpdateAndRelaunch();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Update failed to install.");
      setStatus("error");
    }
  };

  return (
    <section className="settings__section">
      <h2>Updates</h2>
      <p>Version {APP_VERSION}</p>

      {!isTauri() && (
        <p className="settings__integration-desc">Update checks only run inside the Tauri app.</p>
      )}

      {isTauri() && (
        <>
          <button type="button" className="settings__update-btn" onClick={onCheck} disabled={status === "checking" || status === "installing"}>
            {status === "checking" ? "Checking…" : "Check for updates"}
          </button>

          {status === "up-to-date" && <p className="settings__integration-desc">You're on the latest version.</p>}
          {status === "error" && <p className="settings__update-error">{errorMessage}</p>}

          {status === "available" && update && (
            <div className="settings__update-available">
              <p>
                Version {update.version} is available{update.date ? ` (${update.date})` : ""}.
              </p>
              {update.body && <p className="settings__integration-desc">{update.body}</p>}
              <button type="button" className="settings__update-btn" onClick={onInstall}>
                Download and install
              </button>
            </div>
          )}

          {status === "installing" && <p className="settings__integration-desc">Downloading and installing — the app will relaunch.</p>}

          <p className="settings__integration-desc">
            Requires <code>src-tauri/tauri.conf.json</code>'s updater <code>endpoints</code> and{" "}
            <code>pubkey</code> to point at a real GitHub Releases feed — see DEVELOPMENT.md.
          </p>
        </>
      )}
    </section>
  );
}
