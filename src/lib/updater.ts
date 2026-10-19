import { isTauri } from "./platform";
import { serviceFetch } from "./services/serviceFetch";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

/** Same endpoint as src-tauri/tauri.conf.json → plugins.updater.endpoints[0] (used only for diagnostics). */
const MANIFEST_URL = "https://github.com/BlackBlazent/BlackMusic/releases/latest/download/latest.json";

/**
 * Tauri plugin errors are rejected as plain STRINGS, not Error objects — so the old
 * `error instanceof Error ? error.message : "Couldn't check for updates."` always fell through to the generic text,
 * and nothing reached the console. Normalise everything to a readable message.
 */
export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function platformKeys(): string[] {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return [/ARM64|aarch64/i.test(ua) ? "windows-aarch64" : "windows-x86_64"];
  if (/Mac/i.test(ua)) return ["darwin-aarch64", "darwin-x86_64"];
  return ["linux-x86_64"];
}

const newer = (a: string, b: string) => {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
};

/**
 * When the updater plugin fails or reports "up to date", read latest.json ourselves and say WHY. The common causes:
 *   - the GitHub release is still a DRAFT (releases/latest ignores drafts → 404),
 *   - latest.json has no entry for this OS (CI only built Linux/macOS, so `windows-x86_64` is missing),
 *   - the manifest's version isn't newer than the installed one.
 */
export async function diagnoseUpdater(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const current = await getVersion();
    const res = await serviceFetch(MANIFEST_URL, { headers: { Accept: "application/json" } });
    if (res.status === 404) {
      {/* TODO: Preserve (dev): No update manifest found at the release URL (404). The latest GitHub release is probably still a draft, or has no latest.json asset. Publish the release and make sure the build uploaded latest.json.*/}
      return `Updates are temporarily unavailable. Please try again later.`;
    }
    if (!res.ok) return `The update server answered ${res.status}.`;
    const manifest = (await res.json()) as { version?: string; platforms?: Record<string, unknown> };
    const remote = manifest.version ?? "?";
    const keys = platformKeys();
    const platforms = Object.keys(manifest.platforms ?? {});
    if (!keys.some((k) => platforms.includes(k) || platforms.some((p) => p.startsWith(`${k}-`)))) {
      return `Release ${remote} exists but its latest.json has no build for this system (${keys.join(" / ")}). It only lists: ${platforms.join(", ") || "nothing"}. Add this platform to the release workflow so its installer + signature are uploaded.`;
    }
    if (!newer(remote, current)) return `You're on ${current}; the newest published release is ${remote}.`;
    return `Release ${remote} is available but the updater couldn't use it (signature or download problem). Check that the release's .sig files were produced with the private key matching the app's public key.`;
  } catch (e) {
    return `Couldn't reach the update server: ${errorText(e)}`;
  }
}

/** Only when a NEWER release exists that the updater plugin silently ignored (e.g. no build for this OS in latest.json). */
async function silentMismatch(): Promise<string | null> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const res = await serviceFetch(MANIFEST_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const manifest = (await res.json()) as { version?: string; platforms?: Record<string, unknown> };
    if (!manifest.version || !newer(manifest.version, await getVersion())) return null;
    return await diagnoseUpdater();
  } catch {
    return null;
  }
}

/** Returns update info if one's available, or null if already up to date. Throws a descriptive Error on failure. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) {
      const hidden = await silentMismatch();
      if (hidden) throw new Error(hidden);
      return null;
    }
    return { version: update.version, date: update.date, body: update.body };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Release ")) throw e;
    if (e instanceof Error && e.message.startsWith("Couldn't check")) throw e;
    console.error("[updater] check failed:", e);
    const reason = errorText(e);
    throw new Error(`Couldn't check for updates. ${await diagnoseUpdater()} (${reason})`);
  }
}

/** Downloads and installs the pending update, then relaunches the app. */
export async function installUpdateAndRelaunch(onProgress?: (downloaded: number, total: number | null) => void): Promise<void> {
  if (!isTauri()) return;
  const { check } = await import("@tauri-apps/plugin-updater");
  const { relaunch } = await import("@tauri-apps/plugin-process");

  let update;
  try {
    update = await check();
  } catch (e) {
    throw new Error(errorText(e));
  }
  if (!update) return;

  let downloaded = 0;
  let total: number | null = null;
  try {
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") total = event.data.contentLength ?? null;
      if (event.event === "Progress") downloaded += event.data.chunkLength;
      onProgress?.(downloaded, total);
    });
  } catch (e) {
    console.error("[updater] install failed:", e);
    throw new Error(`Update failed to install: ${errorText(e)}`);
  }

  await relaunch();
}
