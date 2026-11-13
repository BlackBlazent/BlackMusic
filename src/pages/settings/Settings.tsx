import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { usePromotions } from "@/app/context/PromotionsContext";
import { useTheme, type Theme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/context/AuthContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { useAppSettings, INTEGRATIONS } from "@/app/context/AppSettingsContext";
import { Switch } from "@/app/components/Switch";
import { ProfileCard } from "@/app/layout/ProfileCard";
import { ChangelogModal } from "@/app/components/ChangelogModal";
import { BannerSettings, LanguageSection, PersonalizationSection, PluginsToolsSection } from "./PersonalizationSections";
import { errorText } from "@/lib/updater";
import { isMobileOs, useIsMobile } from "@/lib/useIsMobile";
import { LyricsSettings } from "@/app/features/lyrics/components/LyricsSettings";
import { SERVICE_CLIENTS, SERVICE_KEYS_STORAGE_KEY, loadServiceKeys, type ServiceKeys } from "@/lib/services/serviceRegistry";
import { useCustomApis } from "@/lib/services/useCustomApis";
import { setPreference } from "@/lib/preferencesStore";
import { checkForUpdate, installUpdateAndRelaunch, type UpdateInfo } from "@/lib/updater";
import { APP_VERSION } from "@/lib/appVersion";
import { isTauri } from "@/lib/platform";
import { TrashIcon } from "@/app/layout/icons";
import { SyncSection } from "./SyncSection";
import { BackupSection } from "./BackupSection";
import { AiArtworkSection, AutoUpdateToggle, LegalSection, OsScanSection, PlaybackLookSection } from "./Settings3";
import "./Settings.css";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const KEYED_SERVICES = Object.values(SERVICE_CLIENTS).filter((c) => c.envKeys.length > 0);

function AccountSection() {
  const { user, configured, signOut } = useAuth();
  return (
    <>
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
    </>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  return (
    <>
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
              <BannerSettings />
      </section>
    </>
  );
}

function IntegrationsSection() {
  const { isEnabled, setEnabled } = useAppSettings();
  return (
    <>
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
    </>
  );
}

function LibrarySection() {
  const { hiddenCount, unhideAll } = useLibrary();
  return (
    <>
      <section className="settings__section">
        <h2>Library</h2>
        <p>{hiddenCount === 0 ? "No tracks are hidden." : `${hiddenCount} track${hiddenCount === 1 ? " is" : "s are"} hidden from your library.`}</p>
        <button type="button" className="settings__update-btn" disabled={hiddenCount === 0} onClick={unhideAll}>
          Unhide all tracks
        </button>
      </section>
    </>
  );
}

function LyricsSection() {
  return (
    <>
      <section className="settings__section">
        <h2>Lyrics overlay</h2>
        <p>Style the lyrics shown over the Playground stage. Lyrics are fetched once and saved to your app data folder.</p>
        <LyricsSettings />
      </section>
    </>
  );
}

/**
 * IMP-09 §9.1 — block layout inspired by phone system settings: a search bar, a profile block, then rounded blocks of rows
 * (icon · title · hint · chevron). Each row opens its own page (full screen on phones, a side panel on wide screens).
 * Only the LAYOUT follows that style; every section's content is exactly what it was.
 */
interface SettingsRow { id: string; title: string; hint: string; icon: string; tint: string; keywords: string; node: ReactNode }

export function Settings() {
  const { user, configured } = useAuth();
  const mobile = useIsMobile();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | null>(null);

  const groups = useMemo<{ title: string; rows: SettingsRow[] }[]>(() => [
    { title: "Library & listening", rows: [
      { id: "library", title: "Library", hint: "Hidden tracks, system Music folder", icon: "/assets/media/images/icons/general/navigations/library.svg", tint: "#e5a000", keywords: "library hidden unhide discovery scan folder music", node: <><LibrarySection /><OsScanSection /></> },
      { id: "playback", title: "Playback look", hint: "Progress bar, fullscreen, album shine", icon: "/assets/media/images/icons/general/navigations/playback-look.svg", tint: "#3b9bff", keywords: "progress bar animation fullscreen shine playback", node: <PlaybackLookSection /> },
      { id: "lyrics", title: "Lyrics overlay", hint: "Style the lyrics on the stage", icon: "/assets/media/images/icons/general/navigations/lyrics-overlay.svg", tint: "#9b6bff", keywords: "lyrics overlay style", node: <LyricsSection /> },
    ] },
    { title: "Appearance & language", rows: [
      { id: "appearance", title: "Appearance", hint: "Dark or light, banner image", icon: "/assets/media/images/icons/general/navigations/appearance.svg", tint: "#4aa8a0", keywords: "theme dark light banner appearance", node: <AppearanceSection /> },
      { id: "personalization", title: "Personalization", hint: "Cover effects, dock, Last.fm name", icon: "/assets/media/images/icons/general/navigations/personalization.svg", tint: "#e0568f", keywords: "personalization cover effect dock motion lastfm screensaver", node: <PersonalizationSection /> },
      { id: "language", title: "Language", hint: "App language", icon: "/assets/media/images/icons/general/navigations/language.svg", tint: "#3b9bff", keywords: "language translate", node: <LanguageSection /> },
    ] },
    { title: "Online & services", rows: [
      { id: "integrations", title: "Integrations", hint: "Turn services on or off", icon: "/assets/media/images/icons/general/navigations/integrations.svg", tint: "#2fb36d", keywords: "integrations services spotify youtube lastfm audius", node: <IntegrationsSection /> },
      { id: "keys", title: "Service API keys", hint: "Your own keys, kept on this device", icon: "/assets/media/images/icons/general/navigations/services-api-key.svg", tint: "#e5a000", keywords: "api keys youtube spotify tidal lastfm genius custom", node: <><ServiceKeysSection /><CustomApisSection /></> },
      { id: "ai", title: "AI artwork", hint: "fal.ai cover generation", icon: "/assets/media/images/icons/general/navigations/ai-artwork.svg", tint: "#9b6bff", keywords: "fal ai artwork thumbnail cover generate image model", node: <AiArtworkSection /> },
      ...(import.meta.env.DEV ? [{ id: "promo", title: "Promotions", hint: "Developer diagnostics", icon: "/assets/media/images/icons/general/navigations/promotions.svg", tint: "#888", keywords: "promotions diagnostics", node: <PromotionsSection /> }] : []),
    ] },
    { title: "Sync & backup", rows: [
      { id: "sync", title: "Music Portable Sync", hint: "Same library on phone and computer", icon: "/assets/media/images/icons/general/navigations/music-portable-sync.svg", tint: "#3b9bff", keywords: "sync devices transfer copy stream budget", node: <SyncSection /> },
      { id: "backup", title: "Backup & export", hint: "JSON, M3U8, CSV, restore", icon: "/assets/media/images/icons/general/navigations/backup-export.svg", tint: "#2fb36d", keywords: "backup restore export json m3u csv playlist", node: <BackupSection /> },
    ] },
    { title: "Plug-ins & tools", rows: [
      { id: "plugins", title: "Plug-ins & Tools", hint: "yt-dlp, whisper.cpp, FFmpeg, speech models", icon: "/assets/media/images/icons/general/navigations/plugins-tools.svg", tint: "#e0568f", keywords: "plugins tools ytdlp whisper ffmpeg models speech transcription", node: <PluginsToolsSection /> },
    ] },
    { title: "About", rows: [
      { id: "legal", title: "Privacy Policy & Terms", hint: "How your data is handled", icon: "/assets/media/images/icons/general/navigations/privacy-terms.svg", tint: "#4aa8a0", keywords: "privacy policy terms legal conditions", node: <LegalSection /> },
      { id: "updates", title: "Updates & version", hint: "Check for a new version", icon: "/assets/media/images/icons/general/navigations/updates-version.svg", tint: "#3b9bff", keywords: "update version changelog release", node: <UpdatesSection onShowChangelog={() => setChangelogOpen(true)} /> },
    ] },
  ], []);

  const account: SettingsRow = { id: "account", title: user ? (user.fullName ?? user.email ?? "Account") : "Account", hint: !configured ? "Accounts aren't set up in this build" : user ? "Account & sign-out" : "Not signed in", icon: "/assets/media/images/icons/general/navigations/account-avatar.svg", tint: "#3b9bff", keywords: "account profile sign in log out", node: <AccountSection /> };
  const all = useMemo(() => [account, ...groups.flatMap((g) => g.rows)], [groups, account.title, account.hint]); // eslint-disable-line react-hooks/exhaustive-deps
  const q = query.trim().toLowerCase();
  const matches = q ? all.filter((r) => `${r.title} ${r.hint} ${r.keywords}`.toLowerCase().includes(q)) : null;
  const current = all.find((r) => r.id === (active ?? (mobile ? "" : "account"))) ?? null;

  const row = (r: SettingsRow) => (
    <button key={r.id} type="button" className="settings-row" data-active={current?.id === r.id} onClick={() => setActive(r.id)}>
      {/*<span className="settings-row__icon" style={{ background: r.tint }} aria-hidden>{r.icon}</span>*/}
      <span className="settings-row__icon" style={{ background: r.tint }} aria-hidden>
        <img src={r.icon} alt="" />
      </span>
      <span className="settings-row__text"><strong>{r.title}</strong><small>{r.hint}</small></span>
      <span className="settings-row__chev" aria-hidden>›</span>
    </button>
  );

  const list = (
    <nav className="settings-home" aria-label="Settings">
      <input className="settings-search" type="search" placeholder="Search settings" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search settings" />
      {matches ? (
        <div className="settings-block">
          {matches.length === 0 ? <p className="settings-empty">Nothing matches “{query}”.</p> : matches.map(row)}
        </div>
      ) : (
        <>
          <div className="settings-block settings-block--profile">{row(account)}</div>
          {groups.map((g) => (
            <div key={g.title} className="settings-group">
              <h2>{g.title}</h2>
              <div className="settings-block">{g.rows.map(row)}</div>
            </div>
          ))}
        </>
      )}
    </nav>
  );

  return (
    <div className="settings" data-layout={mobile ? "stack" : "split"} data-detail={current ? "open" : "closed"}>
      <h1>Settings</h1>
      {(!mobile || !current) && list}
      {current && (
        <div className="settings-detail">
          {mobile && <button type="button" className="settings-back" onClick={() => setActive(null)}>‹ Settings</button>}
          <h2 className="settings-detail__title">{current.title}</h2>
          {current.node}
        </div>
      )}
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
        Connect the services you want to use by providing their required API keys.
        Keys entered here are stored locally on this device. Only enter credentials
        you trust this app to use, and never provide private client secrets or
        other sensitive credentials that should remain on a secure server.
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
  const [pct, setPct] = useState<number | null>(null);

  const onCheck = async () => {
    setStatus("checking");
    setErrorMessage(null);
    try {
      const found = await checkForUpdate();
      setUpdate(found);
      setStatus(found ? "available" : "up-to-date");
    } catch (error) {
      setErrorMessage(errorText(error));
      setStatus("error");
    }
  };

  const onInstall = async () => {
    setStatus("installing");
    try {
      setPct(0);
      await installUpdateAndRelaunch((done, total) => setPct(total ? Math.min(100, Math.round((done / total) * 100)) : null));
    } catch (error) {
      setErrorMessage(errorText(error));
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
      {isTauri() && isMobileOs() && <p className="settings__integration-desc">Updates on Android and iOS come from the store or the build you installed.</p>}

      {isTauri() && !isMobileOs() && (
        <>
          <button type="button" className="settings__update-btn" onClick={onCheck} disabled={status === "checking" || status === "installing"}>
            {status === "checking" ? "Checking…" : "Check for updates"}
          </button>

          {status === "installing" && (
            <p className="settings__integration-desc" aria-live="polite">
              Installing update… {pct === null ? "downloading" : `${pct}%`} — BlackMusic will restart when it's done.
            </p>
          )}
          <AutoUpdateToggle />
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
