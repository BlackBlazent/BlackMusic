import { useEffect, useState, type FormEvent } from "react";
import { usePromotions } from "@/app/context/PromotionsContext";
import { useTheme, type Theme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/context/AuthContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { useAppSettings, INTEGRATIONS } from "@/app/context/AppSettingsContext";
import { Switch } from "@/app/components/Switch";
import { ProfileCard } from "@/app/layout/ProfileCard";
import { ChangelogModal } from "@/app/components/ChangelogModal";
import { LyricsSettings } from "@/app/features/lyrics/components/LyricsSettings";
import { SERVICE_CLIENTS, SERVICE_KEYS_STORAGE_KEY, loadServiceKeys, type ServiceKeys } from "@/lib/services/serviceRegistry";
import { useCustomApis } from "@/lib/services/useCustomApis";
import { setPreference } from "@/lib/preferencesStore";
import { checkForUpdate, installUpdateAndRelaunch, type UpdateInfo } from "@/lib/updater";
import { APP_VERSION } from "@/lib/appVersion";
import { isTauri } from "@/lib/platform";
import { TrashIcon } from "@/app/layout/icons";
import "./Settings.css";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const KEYED_SERVICES = Object.values(SERVICE_CLIENTS).filter((c) => c.envKeys.length > 0);

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { user, configured, signOut } = useAuth();
  const { isEnabled, setEnabled } = useAppSettings();
  const { hiddenCount, unhideAll } = useLibrary();
  const [changelogOpen, setChangelogOpen] = useState(false);

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="settings__section">
        <h2>Account</h2>
        {!configured ? (
          <p>
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to enable accounts.
          </p>
        ) : user ? (
          <div className="settings__account">
            <ProfileCard user={user} size={64} />
            <button type="button" className="settings__update-btn" onClick={() => void signOut()}>
              Log out
            </button>
          </div>
        ) : (
          <p>Not signed in — use the account icon in the top bar.</p>
        )}
      </section>

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
          Turn a service off and BlackMusic won't reach out to it at all — no background requests, no entry in the logo menu. Last.fm
          and YouTube default to off.
        </p>
        <div className="settings__integrations">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.id} className="settings__integration-row">
              <div>
                <span className="settings__integration-name">{integration.name}</span>
                <span className="settings__integration-desc">{integration.description}</span>
              </div>
              <Switch checked={isEnabled(integration.id)} onChange={(next) => setEnabled(integration.id, next)} label={`Toggle ${integration.name}`} />
            </div>
          ))}
        </div>
      </section>

      <ServiceKeysSection />
      <CustomApisSection />

      <section className="settings__section">
        <h2>Library</h2>
        <p>{hiddenCount === 0 ? "No tracks are hidden." : `${hiddenCount} track${hiddenCount === 1 ? " is" : "s are"} hidden from your library.`}</p>
        <button type="button" className="settings__update-btn" disabled={hiddenCount === 0} onClick={unhideAll}>
          Unhide all tracks
        </button>
      </section>
      
      <section className="settings__section">
        <h2>Lyrics overlay</h2>
        <p>Style the lyrics shown over the Playground stage. Lyrics are fetched once and saved to your app data folder.</p>
        <LyricsSettings />
      </section>
      
      {import.meta.env.DEV && <PromotionsSection />} {/* TODO: For production {import.meta.env.DEV && <PromotionsSection />}. For my own: <PromotionsSection /> */}
      <UpdatesSection onShowChangelog={() => setChangelogOpen(true)} />
      {changelogOpen && <ChangelogModal onClose={() => setChangelogOpen(false)} />}
    </div>
  );
}

/** Settings → Promotions: shows what the app received from the backend and helps diagnose empty results. */
function PromotionsSection() {
  const { status, reload, resetLimits } = usePromotions();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const placements = Object.entries(status.byPlacement)
    .map(([placement, count]) => `${placement}: ${count}`)
    .join(" · ");

  return (
    <section className="settings__section" style={{ display: 'none' }}>
      <h2>Promotions</h2>

      <p>
        Backend:{" "}
        <code>
          {status.backendUrl ?? "VITE_PROMOTIONS_API_URL not set"}
        </code>
      </p>

      <p>
        {status.total > 0
          ? `${status.total} promotion${status.total === 1 ? "" : "s"} loaded from ${status.source} (${placements}).`
          : "No promotions loaded."}
      </p>

      {status.error && (
        <p className="settings__update-error">{status.error}</p>
      )}

      <p className="settings__integration-desc">
        API promotions appear on Local and Online (after the 4th row) and
        Library → All Music (after the 5th). In release builds, each is
        shown at most once per session and 3 times a day. During{" "}
        <code>pnpm tauri dev</code>, those limits are off.
      </p>

      <div className="settings__account">
        <button
          type="button"
          className="settings__update-btn"
          disabled={busy}
          onClick={() => void run(reload)}
        >
          {busy ? "Refreshing…" : "Refresh now"}
        </button>

        <button
          type="button"
          className="settings__update-btn"
          disabled={busy}
          onClick={() => void run(resetLimits)}
        >
          Reset cache &amp; view limits
        </button>
      </div>
    </section>
  );
}

/** Settings → Service API keys: type a key once; it's saved locally and used instead of (or without) .env. */
function ServiceKeysSection() {
  const [keys, setKeys] = useState<ServiceKeys>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadServiceKeys().then(setKeys);
  }, []);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    const clean: ServiceKeys = {};
    for (const [id, value] of Object.entries(keys)) if (typeof value === "string" && value.trim()) clean[id] = value.trim();
    await setPreference(SERVICE_KEYS_STORAGE_KEY, clean);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="settings__section">
      <h2>Service API keys</h2>
      <p>
        Every service is already wired up — it only needs its key. Paste it here (stored on this device only) or put it in{" "}
        <code>.env</code>. Never paste a client <em>secret</em> you wouldn't want stored locally.
      </p>
      <form className="settings__keys" onSubmit={onSave}>
        {KEYED_SERVICES.map((client) => (
          <label key={client.id} className="settings__key-row">
            <span>
              {client.id}
              <small>{client.envKeys[0]}</small>
            </span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Not set"
              value={keys[client.id] ?? ""}
              onChange={(e) => setKeys((prev) => ({ ...prev, [client.id]: e.target.value }))}
            />
          </label>
        ))}
        <button type="submit" className="settings__update-btn">
          {saved ? "Saved ✓" : "Save keys"}
        </button>
      </form>
    </section>
  );
}

/** Settings → Custom API integrations: bring your own music-service endpoint. */
function CustomApisSection() {
  const { apis, save } = useCustomApis();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [authHeader, setAuthHeader] = useState("Authorization");
  const [error, setError] = useState<string | null>(null);

  const onAdd = async (event: FormEvent) => {
    event.preventDefault();
    try {
      new URL(baseUrl);
    } catch {
      setError("Enter a full URL, e.g. https://api.example.com/tracks");
      return;
    }
    setError(null);
    await save([...apis, { id: `${Date.now()}`, name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), authHeader: authHeader.trim() || "Authorization", enabled: true }]);
    setName("");
    setBaseUrl("");
    setApiKey("");
  };

  return (
    <section className="settings__section">
      <h2>Custom API integrations</h2>
      <p>
        Add your own music service. BlackMusic calls the endpoint (GET), sends your key in the header you choose, and lists the tracks
        in Online. It accepts a JSON array, or an object with <code>tracks</code>, <code>data</code> or <code>items</code>; each
        track can use <code>title/name</code>, <code>artist</code>, <code>album</code>, <code>duration</code>,{" "}
        <code>stream_url/preview/url</code> and <code>artwork/cover/image</code>.
      </p>

      {apis.length > 0 && (
        <div className="settings__integrations">
          {apis.map((api) => (
            <div key={api.id} className="settings__integration-row">
              <div>
                <span className="settings__integration-name">{api.name}</span>
                <span className="settings__integration-desc">{api.baseUrl}</span>
              </div>
              <Switch checked={api.enabled} onChange={(on) => void save(apis.map((a) => (a.id === api.id ? { ...a, enabled: on } : a)))} label={`Toggle ${api.name}`} />
              <button type="button" className="settings__icon-btn" aria-label={`Delete ${api.name}`} onClick={() => void save(apis.filter((a) => a.id !== api.id))}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <form className="settings__custom-form" onSubmit={onAdd}>
        <input placeholder="Service name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Endpoint URL (returns tracks as JSON)" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required />
        <input type="password" autoComplete="off" placeholder="API key (optional)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <input placeholder="Key header (default: Authorization)" value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} />
        {error && <p className="settings__update-error">{error}</p>}
        <button type="submit" className="settings__update-btn">
          Save integration
        </button>
      </form>
    </section>
  );
}

function UpdatesSection({ onShowChangelog }: { onShowChangelog: () => void }) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "installing" | "error">("idle");
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
      <p>
        Version {APP_VERSION}{" "}
        <button type="button" className="settings__link-btn" onClick={onShowChangelog}>
          What's new
        </button>
      </p>

      {!isTauri() && <p className="settings__integration-desc">Update checks only run inside the Tauri app.</p>}

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
            Requires <code>src-tauri/tauri.conf.json</code>'s updater <code>endpoints</code> and <code>pubkey</code> to point at a real
            GitHub Releases feed — see DEVELOPMENT.md.
          </p>
        </>
      )}
    </section>
  );
}
