import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLastfmUser, useBanner, useButtonMotion, useCoverEffect, useDock, useScreensaver, DEFAULT_BANNER, type DockEdge } from "@/lib/personalization";
import { LANGUAGES, useLanguage, useT } from "@/lib/i18n";
import { VIZ_MODES } from "@/lib/audio/visualizers";
import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { downloadModel, deleteModel, getActiveModel, importModel, listModels, setActiveModel, type WhisperModel } from "@/lib/whisper";
import { importTool, resetTool, toolStatus, updateYtDlp, type ToolStatus } from "@/lib/tools/ytdlpRunner";
import { useNotifications } from "@/app/context/NotificationsContext";
import "./PersonalizationSections.css";

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="pers__field"><span>{label}</span>{children}</label>
);

/** Banner controls — rendered inside the Appearance section. */
const BANNER_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "m4v"];
/** Extension from the name when it has a supported one; otherwise sniffed from the bytes (content:// URIs often have no extension). */
function bannerExtension(name: string, b: Uint8Array): string | null {
  const ext = name.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  if (BANNER_EXTS.includes(ext)) return ext;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8) return "jpg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp") return "mp4";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm";
  return null;
}

export function BannerSettings() {
  const t = useT();
  const [banner, setBanner] = useBanner();
  const [error, setError] = useState<string | null>(null);

  const choose = async () => {
    setError(null);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ multiple: false, filters: [{ name: "Photo or video", extensions: ["jpg", "jpeg", "png", "webp", "gif", "mp4", "webm", "mov", "m4v"] }] });
      if (typeof picked !== "string") return; // cancelled — nothing changes
      // 2.2.0 root cause: the mobile capability (capabilities/mobile.json) never granted `fs:allow-copy-file` (only the desktop one did),
      // and Android's picker returns a content:// URI that a path-based copy can't read anyway. So the file is READ through the
      // plugin (which understands content URIs) and WRITTEN into the app's own data folder — only read + write, both already
      // granted, and no new filesystem permission.
      const { readFile, writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
      const bytes = await readFile(picked);
      const ext = bannerExtension(picked, bytes);
      if (!ext) throw new Error("That file isn't a supported photo or video. Use JPG, PNG, WebP, GIF, MP4, WebM, MOV or M4V.");
      const kind = ["mp4", "webm", "mov", "m4v"].includes(ext) ? "video" : "photo";
      const limit = kind === "video" ? 250 * 1024 * 1024 : 25 * 1024 * 1024;
      if (bytes.byteLength > limit) throw new Error(`That ${kind} is ${(bytes.byteLength / 1048576).toFixed(0)} MB — the limit is ${limit / 1048576} MB.`);
      const { appDataDir, join } = await import("@tauri-apps/api/path");
      const dir = await join(await appDataDir(), "banner");
      await mkdir(dir, { recursive: true });
      const dest = await join(dir, `banner-${Date.now()}.${ext}`);
      await writeFile(dest, bytes);
      setBanner({ ...banner, kind, path: dest }); // only after the copy exists: a failed upload leaves the current banner alone
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="pers">
      <h3>{t("settings.banner")}</h3>
      <div className="pers__row">
        {(["none", "photo", "video"] as const).map((k) => (
          <button key={k} type="button" className="pers__chip" data-active={banner.kind === k} disabled={k !== "none" && !banner.path} onClick={() => setBanner({ ...banner, kind: k })}>
            {t(`settings.banner.${k}` as const)}
          </button>
        ))}
        <button type="button" className="settings__update-btn" onClick={() => void choose()} disabled={!isTauri()}>{t("settings.banner.choose")}</button>
        {banner.kind !== "none" && <button type="button" className="pers__chip" onClick={() => setBanner(DEFAULT_BANNER)}>{t("common.remove")}</button>}
      </div>
      {banner.kind !== "none" && (
        <>
          <Field label={`${t("settings.banner.height")}: ${banner.heightPx}px`}>
            <input type="range" min={140} max={420} step={10} value={banner.heightPx} onChange={(e) => setBanner({ ...banner, heightPx: Number(e.target.value) })} />
          </Field>
          <Field label={`${t("settings.banner.dim")}: ${Math.round(banner.dim * 100)}%`}>
            <input type="range" min={0} max={0.9} step={0.05} value={banner.dim} onChange={(e) => setBanner({ ...banner, dim: Number(e.target.value) })} />
          </Field>
        </>
      )}
      {banner.kind === "video" && (
        <label className="pers__check"><input type="checkbox" checked={banner.videoAudio} onChange={(e) => setBanner({ ...banner, videoAudio: e.target.checked })} /> {t("settings.banner.videoAudio")}</label>
      )}
      {error && <p className="settings__update-error">{error}</p>}
    </div>
  );
}

export function PersonalizationSection() {
  const t = useT();
  const [cover, setCover] = useCoverEffect();
  const [motion, setMotion] = useButtonMotion();
  const [dock, setDock] = useDock();
  const [saver, setSaver] = useScreensaver();
  const [lastfmUser, setLastfmUser] = useLastfmUser();
  const mobile = isMobileOs();
  const edges: DockEdge[] = ["off", "bottom", "top", "left", "right"];

  return (
    <section className="settings__section">
      <h2>{t("settings.personalization")}</h2>
      <div className="pers">
        <Field label={t("settings.coverEffect")}>
          <select value={cover} onChange={(e) => setCover(e.target.value as typeof cover)}>
            {(["off", "vibrate", "zoom", "rotate"] as const).map((k) => <option key={k} value={k}>{t(`settings.coverEffect.${k}` as const)}</option>)}
          </select>
        </Field>
        <label className="pers__check"><input type="checkbox" checked={motion} onChange={(e) => setMotion(e.target.checked)} /> {t("settings.buttonMotion")}</label>
        <Field label="Last.fm username (shows your scrobble history under Online → Last.fm)">
          <input type="text" value={lastfmUser} placeholder="your-username" onChange={(e) => setLastfmUser(e.target.value)} />
        </Field>

        {!mobile && (
          <>
            <h3>{t("settings.dock")}</h3>
            <Field label={t("settings.dock.edge")}>
              <select value={dock.edge} onChange={(e) => setDock({ ...dock, edge: e.target.value as DockEdge })}>
                {edges.map((k) => <option key={k} value={k}>{k === "off" ? t("settings.coverEffect.off") : k[0].toUpperCase() + k.slice(1)}</option>)}
              </select>
            </Field>
            {dock.edge !== "off" && (
              <>
                <label className="pers__check"><input type="checkbox" checked={dock.magnify} onChange={(e) => setDock({ ...dock, magnify: e.target.checked })} /> {t("settings.dock.magnify")}</label>
                {dock.magnify && <Field label={`×${dock.magnification.toFixed(1)}`}><input type="range" min={1.1} max={2} step={0.1} value={dock.magnification} onChange={(e) => setDock({ ...dock, magnification: Number(e.target.value) })} /></Field>}
                <Field label={`${dock.iconSize}px`}><input type="range" min={28} max={64} step={2} value={dock.iconSize} onChange={(e) => setDock({ ...dock, iconSize: Number(e.target.value) })} /></Field>
                <label className="pers__check"><input type="checkbox" checked={dock.autoHide} onChange={(e) => setDock({ ...dock, autoHide: e.target.checked })} /> {t("settings.dock.autohide")}</label>
                <div className="pers__row">
                  {(Object.keys(dock.pages) as (keyof typeof dock.pages)[]).map((k) => (
                    <label key={k} className="pers__check"><input type="checkbox" checked={dock.pages[k]} onChange={(e) => setDock({ ...dock, pages: { ...dock.pages, [k]: e.target.checked } })} /> {k}</label>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        <h3>{t("settings.screensaver")}</h3>
        <label className="pers__check"><input type="checkbox" checked={saver.enabled} onChange={(e) => setSaver({ ...saver, enabled: e.target.checked })} /> {t("settings.screensaver")}</label>
        {saver.enabled && (
          <>
            <Field label={`${t("settings.screensaver.idle")}: ${saver.idleMinutes}`}>
              <input type="range" min={1} max={30} value={saver.idleMinutes} onChange={(e) => setSaver({ ...saver, idleMinutes: Number(e.target.value) })} />
            </Field>
            <div className="pers__row">
              {VIZ_MODES.map((m) => <button key={m.id} type="button" className="pers__chip" data-active={saver.mode === m.id} onClick={() => setSaver({ ...saver, mode: m.id })}>{m.label}</button>)}
            </div>
            <label className="pers__check"><input type="checkbox" checked={saver.showTrackInfo} onChange={(e) => setSaver({ ...saver, showTrackInfo: e.target.checked })} /> Track title &amp; artist</label>
          </>
        )}
      </div>
    </section>
  );
}

export function LanguageSection() {
  const t = useT();
  const [code, setCode] = useLanguage();
  return (
    <section className="settings__section">
      <h2>{t("settings.language")}</h2>
      <div className="pers">
        <select value={code} onChange={(e) => setCode(e.target.value)} aria-label={t("settings.language")}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}{l.native !== l.english ? ` — ${l.english}` : ""}</option>)}
        </select>
        <p>{t("settings.language.hint")}</p>
      </div>
    </section>
  );
}

function ToolRow({ tool, title, hint }: { tool: "yt-dlp" | "whisper-cli" | "ffmpeg"; title: string; hint: string }) {
  const t = useT();
  const { push } = useNotifications();
  const [status, setStatus] = useState<ToolStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => void toolStatus(tool as "yt-dlp" | "whisper-cli").then(setStatus).catch(() => setStatus({ source: "missing", path: null, version: null, problem: null })), [tool]);
  useEffect(refresh, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { push("Tool error", e instanceof Error ? e.message : String(e)); } finally { setBusy(false); refresh(); }
  };
  const importIt = () => run(async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const p = await open({ multiple: false });
    if (typeof p === "string") { await importTool(tool as "yt-dlp", p); push("Imported", `${title} was replaced with your file.`); }
  });
  const label = status ? ({ bundled: "Bundled with the app", imported: "Imported by you", system: "Found on PATH", missing: "Not available" } as const)[status.source] : "Checking…";

  return (
    <div className="pers__tool" data-state={status?.source}>
      <div>
        <strong>{title}</strong>
        <small>{label}{status?.version ? ` · ${status.version}` : ""}</small>
        <small>{hint}</small>
        {status?.problem && <small role="alert" style={{ color: "var(--color-danger, #ff5d5d)" }}>{status.problem}</small>}
      </div>
      <div className="pers__row">
        {tool === "yt-dlp" && <button type="button" className="settings__update-btn" disabled={busy} onClick={() => void run(async () => push("yt-dlp", await updateYtDlp()))}>{t("common.update")}</button>}
        <button type="button" className="settings__update-btn" disabled={busy} onClick={() => void importIt()}>{t("common.import")}…</button>
        {status?.source === "imported" && <button type="button" className="pers__chip" disabled={busy} onClick={() => void run(() => resetTool(tool as "yt-dlp"))}>{t("common.reset")}</button>}
      </div>
    </div>
  );
}

/* Models Descriptions List */

const WHISPER_MODEL_DESCRIPTIONS: Record<string, string> = {
  tiny: "Fastest multilingual transcription. Best for quick notes and basic speech.",
  "tiny.en": "Fast English-only transcription for quick notes and low-resource devices.",
  base: "Fast multilingual transcription with improved accuracy over Tiny.",
  "base.en": "Fast English-only transcription with better accuracy than Tiny English.",
  small: "Balanced multilingual transcription for everyday recordings and conversations.",
  "small.en": "Accurate English-only transcription with a good balance of speed and quality.",
  medium: "High-accuracy multilingual transcription for longer recordings and complex speech.",
  "medium.en": "High-accuracy English-only transcription for detailed or challenging recordings.",
  "large-v1": "Original Large model for high-accuracy multilingual transcription.",
  "large-v2": "Improved Large model with better multilingual transcription accuracy.",
  "large-v3": "Advanced multilingual transcription for challenging audio and diverse accents.",
  "large-v3-turbo": "Near-Large transcription quality with much faster processing.",
};


export function PluginsToolsSection() {
  const t = useT();
  const { push } = useNotifications();
  const [models, setModels] = useState<WhisperModel[]>([]);
  const [active, setActive] = useState("tiny");
  const [progress, setProgress] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    void listModels().then(setModels);
    void getActiveModel().then(setActive);
  }, []);
  useEffect(load, [load]);

  if (!isTauri() || isMobileOs()) {
    return (
      <section className="settings__section">
        <h2>{t("settings.plugins")}</h2>
        <p>yt-dlp and whisper.cpp are desktop tools — on mobile BlackMusic falls back to previews and hosted lyrics.</p>
      </section>
    );
  }

  const download = async (m: WhisperModel) => {
    setProgress((p) => ({ ...p, [m.id]: 0 }));
    try {
      await downloadModel(m.id, (done, total) => setProgress((p) => ({ ...p, [m.id]: total ? done / total : 0 })));
      push("Model ready", `Downloaded the “${m.id}” speech model.`);
    } catch (e) {
      push("Download failed", `${e instanceof Error ? e.message : String(e)} — use “Import model” with a file downloaded manually.`);
    } finally {
      setProgress((p) => { const { [m.id]: _drop, ...rest } = p; return rest; });
      load();
    }
  };
  const importFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const p = await open({ multiple: false, filters: [{ name: "whisper.cpp model", extensions: ["bin"] }] });
      if (typeof p === "string") { const id = await importModel(p); push("Model imported", `“${id}” is now available.`); load(); }
    } catch (e) { push("Import failed", e instanceof Error ? e.message : String(e)); }
  };

  return (
    <section className="settings__section">
      <h2>{t("settings.plugins")}</h2>
      <p>BlackMusic ships with yt-dlp and whisper.cpp built in. You can update them, or point to your own build.</p>
      <div className="pers">
        <ToolRow tool="yt-dlp" title={t("settings.tools.ytdlp")} hint="Plays YouTube & Last.fm tracks, searches videos, downloads." />
        <ToolRow tool="whisper-cli" title={t("settings.tools.whisper")} hint="Generates synced lyrics from the audio, fully offline." />
        <ToolRow tool={"ffmpeg" as "yt-dlp"} title="ffmpeg (optional)" hint="Only needed by the Format Converter (MP3/AAC output). Not bundled." />

        <h3>{t("settings.tools.models")}</h3>
        <p className="pers__hint">“tiny” is built in. Larger models are more accurate but slower; “.en” models are English-only and faster.</p>

        <div className="pers__models">
          {models.map((m) => (
            <div key={m.id} className="pers__model" data-active={active === m.id}>
              <label>
                <input type="radio" name="whisper-model" checked={active === m.id} disabled={!m.installed} onChange={() => { setActive(m.id); void setActiveModel(m.id); }} />
                {/*<strong>{m.id}</strong>*/}
                <strong
                  className="pers__model-name"
                  title={WHISPER_MODEL_DESCRIPTIONS[m.id] ?? "Speech transcription model."}
                    >
                  {m.id}
                </strong> 
                <small>~{m.approxMb >= 1000 ? `${(m.approxMb / 1000).toFixed(1)} GB` : `${m.approxMb} MB`}{m.bundled ? " · built in" : ""}</small>
              </label>
              {m.id in progress ? <span className="pers__progress"><span style={{ width: `${Math.round(progress[m.id] * 100)}%` }} /></span>
                : m.installed ? (m.bundled ? null : <button type="button" className="pers__chip" onClick={() => void deleteModel(m.id).then(load)}>{t("common.remove")}</button>)
                : <button type="button" className="settings__update-btn" onClick={() => void download(m)}>{t("common.download")}</button>}
            </div>
          ))}
        </div>
        <button type="button" className="settings__update-btn" onClick={() => void importFile()}>{t("common.import")} model…</button>
      </div>
    </section>
  );
}
