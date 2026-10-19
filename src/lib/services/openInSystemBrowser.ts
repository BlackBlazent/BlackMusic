import { isTauri } from "@/lib/platform";

export async function openInSystemBrowser(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener"); // opener works on desktop AND mobile (plugin-shell is desktop-only)
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
