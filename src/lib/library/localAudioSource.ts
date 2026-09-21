import { readFile } from "@tauri-apps/plugin-fs";

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

function mimeTypeFor(extension: string): string {
  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "wav":
      return "audio/wav";
    case "ogg":
    case "opus":
      return "audio/ogg";
    case "m4a":
    case "aac":
      return "audio/mp4";
    case "wma":
      return "audio/x-ms-wma";
    default:
      return "application/octet-stream";
  }
}

/**
 * `convertFileSrc` + the asset:// protocol *should* work for this, and is the
 * normal, more memory-efficient way to do it (streams with range-request
 * support instead of loading the whole file up front). But it depends on the
 * webview's custom-protocol handling, CSP, and scope all lining up correctly,
 * none of which is verifiable without actually running the packaged app.
 * `readFile` is not in question — scanning already proves it works, since
 * every track's tags and embedded art come from exactly that call. Building
 * the `<audio>` source from the same proven call removes an entire unverified
 * subsystem from the playback path.
 */
export async function createLocalBlobUrl(path: string): Promise<string> {
  const bytes = await readFile(path);
  const blob = new Blob([bytes as BlobPart], { type: mimeTypeFor(extensionOf(path)) });
  return URL.createObjectURL(blob);
}
