import { isTauri } from "@/lib/platform";

/**
 * FEAT-13 — write a file the user picked. Desktop/mobile app: native Save dialog. Browser dev mode: a normal download.
 * Never silent: returns where it was saved, or throws a message fit to show the user ("cancelled" is reported as null).
 */
export async function saveTextFile(defaultName: string, content: string, mime = "text/plain"): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const ext = defaultName.includes(".") ? defaultName.split(".").pop()! : "txt";
    const path = await save({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
    if (!path) return null;
    await writeTextFile(path, content);
    return path;
  }
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement("a"), { href: url, download: defaultName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return defaultName;
}

/** Saves several files into one folder the user picks. Returns the folder, or null if cancelled. */
export async function saveFilesToFolder(files: { name: string; content: string }[]): Promise<string | null> {
  if (!isTauri()) {
    for (const f of files) await saveTextFile(f.name, f.content);
    return "your Downloads folder";
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const { join } = await import("@tauri-apps/api/path");
  const dir = await open({ directory: true, multiple: false, title: "Choose where to save" });
  if (!dir || Array.isArray(dir)) return null;
  for (const f of files) await writeTextFile(await join(dir, f.name), f.content);
  return dir;
}

/** Reads a text file the user picks (restore). Returns null if cancelled. */
export async function pickTextFile(extensions: string[]): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({ multiple: false, filters: [{ name: "Backup", extensions }] });
    if (!path || Array.isArray(path)) return null;
    return readTextFile(path);
  }
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: extensions.map((e) => `.${e}`).join(",") });
    input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
