/**
 * Path helpers for the library. 2.2.0 root cause: the library used `track.path.startsWith(folder)` everywhere, so the
 * folder "/Music" also claimed "/Music Videos/…" and "/Music2/…", and a parent folder swallowed its watched sub-folder's tracks
 * (double counts, and a rescan of one folder deleting another's tracks). These helpers compare whole path segments.
 */
const isWindowsPath = (p: string) => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("\\\\");

export function normPath(p: string): string {
  const slashed = p.replace(/\\/g, "/").replace(/\/+$/, "");
  return isWindowsPath(p) ? slashed.toLowerCase() : slashed; // Windows paths are case-insensitive
}

/** True when `path` is `folder` itself or lives anywhere below it. */
export function isInside(path: string, folder: string): boolean {
  const p = normPath(path);
  const f = normPath(folder);
  return p === f || p.startsWith(`${f}/`);
}

/** The most specific watched folder that contains `path` (so a track is counted once even with nested watched folders). */
export function owningFolder(path: string, folders: string[]): string | null {
  let best: string | null = null;
  for (const f of folders) {
    if (isInside(path, f) && (best === null || normPath(f).length > normPath(best).length)) best = f;
  }
  return best;
}

/**
 * Android's folder picker returns a content:// tree URI, which Rust's std::fs cannot list. For the two providers that map
 * 1:1 onto real storage we can recover the path; anything else is reported as unsupported instead of being saved and
 * then silently scanned as "empty".
 */
export function folderPathFromPicker(selected: string): { path: string } | { error: string } {
  if (!selected.startsWith("content://")) return { path: selected.replace(/^file:\/\//, "") };
  try {
    const url = new URL(selected);
    const treeMatch = /\/tree\/([^/]+)/.exec(url.pathname);
    if (!treeMatch) return { error: "That location can't be read directly." };
    const tree = decodeURIComponent(treeMatch[1]);
    if (url.host === "com.android.externalstorage.documents") {
      const [volume, ...rest] = tree.split(":");
      const rel = rest.join(":").replace(/^\/+/, "");
      const base = volume === "primary" ? "/storage/emulated/0" : `/storage/${volume}`;
      return { path: rel ? `${base}/${rel}` : base };
    }
    if (url.host === "com.android.providers.downloads.documents") return { path: "/storage/emulated/0/Download" };
    return { error: `Files provided by “${url.host}” can't be scanned directly. Pick a folder on internal storage or an SD card instead.` };
  } catch {
    return { error: "That location can't be read directly." };
  }
}
