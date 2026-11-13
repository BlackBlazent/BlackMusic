import { useEffect, useState } from "react";
import { Switch } from "@/app/components/Switch";
import { useAuth } from "@/app/context/AuthContext";
import { useSharedSetting } from "@/lib/sharedSetting";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { requestSync, useSyncStatus } from "@/lib/sync/syncStore";
import { disableSyncAndDeleteRemote, getDeviceName, setDeviceName, setSyncEnabled } from "@/lib/sync/engine";
import { decideTransfer, readEnvironment, type TransferMode } from "@/lib/sync/transferPolicy";
import { useNotifications } from "@/app/context/NotificationsContext";
import { formatBytes } from "@/lib/formatBytes";
import { DEFAULT_ICE, type IceConfig } from "@/lib/sync/p2p";

const MODES: { id: TransferMode; label: string; hint: string }[] = [
  { id: "auto", label: "Automatic", hint: "Chooses per song from your connection, free space and transfer budget." },
  { id: "copy", label: "Copy to this device", hint: "Saves the song here for offline listening. Uses storage." },
  { id: "stream", label: "Stream with buffering", hint: "Plays while it arrives and saves nothing. Best for huge libraries." },
];

/** FEAT-12 (Music Portable Sync) + FEAT-14 (copy vs buffered stream). Optional: BlackMusic is a full local player without it. */
export function SyncSection() {
  const { user } = useAuth();
  const { push } = useNotifications();
  const [enabled, setEnabled] = useSharedSetting<boolean>("sync.enabled", false);
  const [mode, setMode] = useSharedSetting<TransferMode>("sync.transferMode", "auto");
  const [budgetGb, setBudgetGb] = useSharedSetting<number>("sync.monthlyBudgetGb", 2);
  const [name, setName] = useState(getDeviceName());
  const status = useSyncStatus();
  const [preview, setPreview] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let alive = true;
    void readEnvironment().then((env) => {
      if (!alive) return;
      const d = decideTransfer({ mode, bytes: 12 * 1024 * 1024, ...env, budgetUsed: 0, alreadyCopiedBytes: 0 });
      setPreview(`For a typical 12 MB song right now: ${d.action === "copy" ? "copy" : d.action === "stream" ? "stream" : "wait"} — ${d.reason}`);
    });
    return () => { alive = false; };
  }, [mode]);

  const onToggle = (on: boolean) => {
    if (on && !user) { push("Sign in first", "Sync uses your BlackMusic account. Sign in from the account menu, then turn sync on."); return; }
    setSyncEnabled(on);
    setEnabled(on);
    if (on) requestSync();
  };
  const onDisable = async () => {
    if (!window.confirm("Turn sync off and delete the synced library details from the server? Your music files and local playlists stay exactly as they are.")) return;
    try {
      await disableSyncAndDeleteRemote();
      setEnabled(false);
      push("Sync is off", "Your synced details were deleted from the server. Nothing on this device was removed.");
    } catch (e) {
      push("Couldn't delete the synced details", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="settings__section">
      <h2>Music Portable Sync</h2>
      <p>
        Keep your library organization the same on your phone and computer. Only <strong>details</strong> sync — song titles, playlists, favorites, folder names and play history.
        <strong> Your audio files are never uploaded or stored in the cloud.</strong> Without signing in, BlackMusic stays a fully local player.
      </p>
      {!configured && <p className="settings__update-error">Sync isn't available in this build (the account service isn't configured).</p>}

      <div id="sync__switch_section" className="settings__integration-row">
        <div>
          <span className="settings__integration-name">Turn on sync</span>
          <span className="settings__integration-desc">{user ? `Signed in as ${user.email ?? user.fullName ?? "your account"}.` : "Sign in to your account to use sync."}</span>
        </div>
        <Switch checked={enabled} onChange={onToggle} label="Toggle sync" />
      </div>

      {enabled && (
        <>
          <label id="sync__device_section" className="settings__key-row">
            <span>This device's name<small>Shown on your other devices as “Sync from your device {name || "…"}”</small></span>
            <input value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setDeviceName(e.target.value); }} />
          </label>
          <div className="settings__integration-row">
            <div>
              <span className="settings__integration-name">Status</span>
              <span className="settings__integration-desc" aria-live="polite">
                {status.state === "running" && status.label}
                {status.state === "error" && status.message}
                {status.state === "done" && `Synced just now — sent ${status.report.pushed.tracks} songs, ${status.report.pushed.playlists} playlists; received ${status.report.pulled.playlists} playlists, ${status.report.pulled.folders} folders from other devices.`}
                {status.state === "idle" && "Waiting to sync."}
              </span>
            </div>
            <button type="button" className="settings__update-btn" disabled={status.state === "running"} onClick={() => requestSync()}>{status.state === "running" ? "Syncing…" : "Sync now"}</button>
          </div>

          <h3 className="settings__sub">When a song is on another device</h3>
          <div className="sync__device_transfer_method" role="radiogroup" aria-label="Transfer mode">
            {MODES.map((m) => (
              <label key={m.id} className="settings__integration-row">
                <div><span className="settings__integration-name">{m.label}</span><span className="settings__integration-desc">{m.hint}</span></div>
                <input type="radio" name="sync-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
              </label>
            ))}
          </div>
          <label className="settings__key-row">
            <span>Monthly transfer budget<small>Automatic mode stops moving audio when this is used up ({formatBytes(budgetGb * 1024 ** 3)}).</small></span>
            <input type="number" min={0.1} max={500} step={0.1} value={budgetGb} onChange={(e) => setBudgetGb(Math.max(0.1, Number(e.target.value) || 0.1))} />
          </label>
          {preview && <p className="settings__integration-desc">{preview}</p>}
          <p className="settings__integration-desc">
            Songs move <strong>directly between your own devices</strong> (an encrypted peer-to-peer connection). They are never uploaded to, stored on, or counted against our servers — only small connection set-up messages go through the sync service. Open a folder under “On your other devices” on the Folder page to play or copy its songs.
          </p>
          <h3 className="settings__sub">Connection</h3>
          <p className="settings__integration-desc">On the same Wi-Fi this just works. Between different networks, devices find each other through a public STUN server (the default is Google's, which sees both devices' network addresses). If a strict network blocks the connection, add your own TURN server.</p>
          <IceFields />

          <button type="button" className="settings__update-btn settings__danger" onClick={() => void onDisable()}>Turn off sync and delete synced details</button>
        </>
      )}
    </section>
  );
}

/** Optional own STUN/TURN server. Empty = the public default. */
function IceFields() {
  const [servers, setServers] = useSharedSetting<IceConfig[]>("sync.iceServers", DEFAULT_ICE);
  const custom = servers.find((x) => x.urls.startsWith("turn")) ?? { urls: "", username: "", credential: "" };
  const set = (patch: Partial<IceConfig>) => {
    const next = { ...custom, ...patch };
    setServers(next.urls.trim() ? [...DEFAULT_ICE, { urls: next.urls.trim(), username: next.username, credential: next.credential }] : DEFAULT_ICE);
  };
  return (
    <>
      <label id="sync__turn-server__area" className="settings__key-row"><span>TURN server<small>For example turn:turn.example.com:3478 (optional)</small></span><input value={custom.urls} onChange={(e) => set({ urls: e.target.value })} spellCheck={false} /></label>
      <label id="sync__turn-server__area" className="settings__key-row"><span>TURN user name</span><input value={custom.username ?? ""} onChange={(e) => set({ username: e.target.value })} spellCheck={false} /></label>
      <label id="sync__turn-server__area" className="settings__key-row"><span>TURN password</span><input type="password" autoComplete="off" value={custom.credential ?? ""} onChange={(e) => set({ credential: e.target.value })} /></label>
    </>
  );
}
