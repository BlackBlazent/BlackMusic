import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { isTauri } from "@/lib/platform";
import type { Track } from "@/lib/types";

const SUPPORTED = new Set(["mp3", "wav", "flac", "ogg", "opus", "m4a", "aac", "wma", "mp4", "webm", "mkv", "mov", "m4v"]);
const extOf = (p: string) => p.split(".").pop()?.toLowerCase() ?? "";
const baseName = (p: string) => (p.split(/[/\\]/).pop() ?? p).replace(/\.[^.]+$/, "");

/**
 * "Open with BlackMusic" (file associations). The Rust side (src-tauri/src/file_open.rs) queues paths from launch
 * arguments, a second launch (single-instance) or the macOS open event and emits `files:open`; we drain the queue here,
 * validate again, and replace the play queue with the opened files (one → just it, several → all, duplicates removed).
 */
export function FileOpenHandler() {
  const { playTrack } = usePlayback();
  const { push } = useNotifications();
  const navigate = useNavigate();
  const busy = useRef(false);
  const playRef = useRef(playTrack);
  playRef.current = playTrack;

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    const drain = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const raw: string[] = (await invoke<string[]>("take_pending_opens")) ?? [];
        const paths = [...new Set(raw)];
        if (paths.length === 0) return;
        const ok = paths.filter((p) => SUPPORTED.has(extOf(p)));
        if (ok.length < paths.length) push("Unsupported file skipped", `${paths.length - ok.length} file(s) aren't a format BlackMusic can play.`);
        if (ok.length === 0) return;

        const { readFullTags } = await import("@/lib/library/metadataEditor");
        const tracks: Track[] = await Promise.all(
          ok.map(async (path) => {
            let title = baseName(path);
            let artist = "Unknown artist";
            let album = "Unknown album";
            try {
              const t = await readFullTags(path);
              title = t.title || title;
              artist = t.artist || artist;
              album = t.album || album;
            } catch {
              /* untagged / video container — the file name is a fine title */
            }
            return { id: `file:${path}`, path, title, artist, album, duration: 0, sourceUrl: "", addedAt: Date.now() } satisfies Track;
          }),
        );
        playRef.current(tracks[0], tracks);
        navigate("/playground");
        if (tracks.length > 1) push("Opened files", `${tracks.length} files added to the play queue.`);
      } catch (e) {
        push("Couldn't open the file", e instanceof Error ? e.message : String(e));
      } finally {
        busy.current = false;
      }
    };

    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen("files:open", () => void drain());
      void drain(); // anything queued before we were listening (cold start)
    })();
    return () => unlisten?.();
  }, [navigate, push]);

  return null;
}
