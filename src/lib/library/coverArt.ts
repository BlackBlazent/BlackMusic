import { convertFileSrc } from "@tauri-apps/api/core";
import { serviceFetch } from "@/lib/services/serviceFetch";

/** Opens the native image picker; returns a file path or null. */
export async function pickImageFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({ multiple: false, filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "gif", "bmp"] }] });
  // return typeof picked === "string" ? picked : null;

  // “Couldn’t read that image: No such file (os error 2)”
  /*
  Root cause: Android’s picker returns a content:// URI, not a path. Rust’s image::open() and the asset:// preview can’t open it.
  That also explains the broken “New cover” preview in your screenshot.
  */

  if (typeof picked !== "string") return null;
  // Android returns content:// — copy it into the cache folder and hand back a real path.
  if (picked.startsWith("content://")) {
    const { readFile, writeFile } = await import("@tauri-apps/plugin-fs");
    const { tempDir, join } = await import("@tauri-apps/api/path");
    const dest = await join(await tempDir(), `cover-${Date.now()}.img`);
    await writeFile(dest, await readFile(picked));
    return dest;
  }
  return picked;
}

export const previewSrc = (path: string) => convertFileSrc(path);

/** Downloads an image URL into the temp folder so Rust can embed it (used by "Find online" and Cover Battle). */
export async function downloadToTemp(url: string, name = `cover-${Date.now()}`): Promise<string> {
  const res = await serviceFetch(url);
  if (!res.ok) throw new Error(`Image download failed (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const { tempDir, join } = await import("@tauri-apps/api/path");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const dest = await join(await tempDir(), `${name}.jpg`);
  await writeFile(dest, bytes);
  return dest;
}
