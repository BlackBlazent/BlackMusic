import { isTauri } from "@/lib/platform";

export interface MetadataPatch {
  title: string;
  artist: string;
  album: string;
}

/**
 * Writes tags into the audio file itself (MP3/ID3, FLAC, M4A, OGG, Opus, WAV, AIFF) through the Rust
 * `write_metadata` command, which uses `lofty`. (ExifTool was tried first, but it cannot write MP3 tags.)
 */
export async function writeMetadata(path: string, patch: MetadataPatch): Promise<void> {
  if (!isTauri()) throw new Error("Editing tags needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_metadata", { path, title: patch.title, artist: patch.artist, album: patch.album });
}