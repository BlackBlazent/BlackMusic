import { isTauri } from "@/lib/platform";

export async function openInFileExplorer(path: string): Promise<void> {
  if (!isTauri()) {
    // eslint-disable-next-line no-console -- dev-mode signal, not an error
    console.warn("Opening a folder in the file explorer requires the Tauri shell.");
    return;
  }
  const { open } = await import("@tauri-apps/plugin-shell");
  // Handing a directory path to the OS's default opener is exactly what
  // double-clicking it in Explorer/Finder/the file manager does.
  await open(path);
}
