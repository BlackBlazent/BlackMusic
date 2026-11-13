import { useEffect, useState, type FormEvent } from "react";
import { Switch } from "@/app/components/Switch";
import { useAutoUpdateCheck } from "@/app/components/UpdateWatcher";
import { FAL_MODELS, useFalModelId } from "@/lib/services/falClient";
import { SERVICE_KEYS_STORAGE_KEY, loadServiceKeys, type ServiceKeys } from "@/lib/services/serviceRegistry";
import { setPreference } from "@/lib/preferencesStore";
import { openInSystemBrowser } from "@/lib/services/openInSystemBrowser";
import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { SEEK_ANIMATIONS, useSeekAnimation } from "@/lib/seekAnimation";
import { useSharedSetting } from "@/lib/sharedSetting";
import { useFolders } from "@/app/context/FoldersContext";

/** Hosted copy of docs/legal/PRIVACY_POLICY_AND_TERMS.md. Set VITE_LEGAL_URL to the BlackMusic Centric Website page once published. */
const LEGAL_URL = (import.meta.env.VITE_LEGAL_URL as string | undefined) || "https://www-blackblazent-com.vercel.app/blackmusic/privacy";

/** IMP-09 §9.2 — fal.ai (user's own key + model; image generation for FEAT-09 "Generate thumbnail"). */
export function AiArtworkSection() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [model, setModel] = useFalModelId();

  useEffect(() => void loadServiceKeys().then((k) => setKey(k.falai ?? "")), []);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const keys: ServiceKeys = { ...(await loadServiceKeys()) };
    if (key.trim()) keys.falai = key.trim();
    else delete keys.falai;
    await setPreference(SERVICE_KEYS_STORAGE_KEY, keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <section className="settings__section">
      <h2>AI artwork (fal.ai)</h2>
      <p>
        Generate a cover when no online artwork exists (Edit metadata → Album artwork → Generate thumbnail). This uses <strong>your own</strong>{" "}
        fal.ai account and is billed by fal.ai, not BlackMusic. The key stays on this device.
      </p>
      <form className="settings__keys" onSubmit={onSave}>
        <label className="settings__key-row">
          <span>fal.ai API key<small>Used only when you press “Generate thumbnail”</small></span>
          <input type="password" autoComplete="off" spellCheck={false} placeholder="Not set" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="settings__key-row">
          <span>Image model<small>Price as listed by fal.ai; check fal.ai for current rates</small></span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {FAL_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label} — {m.price}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="settings__update-btn">{saved ? "Saved ✓" : "Save"}</button>
      </form>
    </section>
  );
}

/** FEAT-11 — short intro of the Privacy Policy and Terms, placed before Updates. */
export function LegalSection() {
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    setError(null);
    try {
      await openInSystemBrowser(LEGAL_URL);
    } catch {
      setError("Couldn't open your browser. Copy this address instead: " + LEGAL_URL);
    }
  };
  return (
    <section className="settings__section">
      <h2>Privacy Policy &amp; Terms</h2>
      <p>
        Your music stays on your device — BlackMusic never uploads your audio files. There are no advertising trackers or analytics in the app. An account is
        optional and only used for sign-in. Some features contact third-party music, lyrics and artwork services when you use them, and promotional
        cards may contain affiliate links. By using BlackMusic you agree to the Terms.
      </p>
      <button type="button" className="settings__update-btn" onClick={() => void open()}>Read the full Privacy Policy &amp; Terms</button>
      {error && <p className="settings__update-error">{error}</p>}
    </section>
  );
}

/** IMP-09 §9.4 — switch for the background update scan (desktop only). */
export function AutoUpdateToggle() {
  const [auto, setAuto] = useAutoUpdateCheck();
  if (!isTauri() || isMobileOs()) return null;
  return (
    <div id="update_switch_automatic" className="settings__integration-row">
      <div>
        <span className="settings__integration-name">Check for updates automatically</span>
        <span className="settings__integration-desc">Looks for a new version in the background and tells you when one is ready.</span>
      </div>
      <Switch checked={auto} onChange={setAuto} label="Toggle automatic update checks" />
    </div>
  );
}

/** FEAT-04 (progress bar animation) + FEAT-03e (fullscreen controls) + FEAT-06 (album art shine, Online page only). */
export function PlaybackLookSection() {
  const [anim, setAnim] = useSeekAnimation();
  const [fsFull, setFsFull] = useSharedSetting<boolean>("fullscreenControls", true);
  const [shine, setShine] = useSharedSetting<boolean>("onlineArtShine", true);
  return (
    <section className="settings__section">
      <h2>Playback look</h2>
      <div className="settings__integration-row">
        <div>
          <span className="settings__integration-name">Progress bar animation</span>
          <span className="settings__integration-desc">Applies to the Playground and the bottom playback bar only. {SEEK_ANIMATIONS.find((a) => a.id === anim)?.hint}.</span>
        </div>
        <select value={anim} onChange={(e) => setAnim(e.target.value as typeof anim)} aria-label="Progress bar animation">
          {SEEK_ANIMATIONS.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>
      <div className="settings__integration-row">
        <div>
          <span className="settings__integration-name">Full controls in fullscreen</span>
          <span className="settings__integration-desc">Keep the Audio/Video tabs, playback controls, extra controls and queue strip in fullscreen. They hide when idle: click to show, double-click to hide.</span>
        </div>
        <Switch checked={fsFull} onChange={setFsFull} label="Toggle full controls in fullscreen" />
      </div>
      <div className="settings__integration-row">
        <div>
          <span className="settings__integration-name">Album art shine (Online page)</span>
          <span className="settings__integration-desc">A soft light sweeps across album art on the Online page.</span>
        </div>
        <Switch checked={shine} onChange={setShine} label="Toggle album art shine" />
      </div>
    </section>
  );
}

/** FEAT-01 (desktop) — optional background watch of the OS Music folder. Folder upload stays the default way to build a library. */
export function OsScanSection() {
  const [on, setOn] = useSharedSetting<boolean>("osScan.enabled", false);
  const { discover } = useFolders();
  if (!isTauri() || isMobileOs()) return null;
  return (
    <section className="settings__section">
      <h2>Library discovery</h2>
      <div className="settings__integration-row">
        <div>
          <span className="settings__integration-name">Also scan my system Music folder</span>
          <span className="settings__integration-desc">Adds your computer's own Music folder in the background. Folders you add yourself always work, and you can remove this one from the Folder page.</span>
        </div>
        <Switch checked={on} onChange={(v) => { setOn(v); if (v) setTimeout(() => void discover({ force: true }), 50); }} label="Toggle scanning the system Music folder" />
      </div>
    </section>
  );
}
