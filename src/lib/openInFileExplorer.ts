import { isTauri } from "@/lib/platform";

/**
 * 2.1.0: on Windows the "open watched folder" button triggers the bundled
 * `open_explorer` sidecar (tauri.conf.json → bundle.externalBin =
 * ["binaries/open_explorer"], i.e. binaries/open_explorer-x86_64-pc-windows-msvc.exe).
 * Everywhere else — and if the sidecar fails for any reason — it falls back to
 * the shell plugin, which hands the folder to the OS's default file manager.
 */
export async function openInFileExplorer(path: string): Promise<void> {
  if (!isTauri()) {
    // eslint-disable-next-line no-console -- dev-mode signal, not an error
    console.warn("Opening a folder in the file explorer requires the Tauri shell.");
    return;
  }
  const { Command, open } = await import("@tauri-apps/plugin-shell");

  if (/windows/i.test(navigator.userAgent)) {
    try {
      const output = await Command.sidecar("binaries/open_explorer", [path]).execute();
      // Explorer-launching tools commonly exit non-zero even on success (explorer.exe returns 1),
      // so only treat a spawn failure — the catch below — as a reason to fall back.
      if (output.code === 0 || output.code === 1) return;
    } catch {
      /* fall through to the shell plugin */
    }
  }
  await open(path);
}
