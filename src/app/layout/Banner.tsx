import { useEffect, useRef, useState } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useBanner } from "@/lib/personalization";
import { isTauri } from "@/lib/platform";
import "./Banner.css";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4" };

/** Loads the banner file kept in app data into a blob: URL (no asset-protocol scope needed; revoked on change). */
function useBannerUrl(path: string, kind: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path || kind === "none" || !isTauri()) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let created: string | null = null;
    (async () => {
      try {
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const bytes = await readFile(path);
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        created = URL.createObjectURL(new Blob([bytes], { type: MIME[ext] ?? "application/octet-stream" }));
        if (!revoked) setUrl(created);
      } catch {
        if (!revoked) setUrl(null);
      }
    })();
    return () => {
      revoked = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path, kind]);
  return url;
}

/**
 * App-wide banner (like a TikTok profile header): spans the full width — including the upper part of the sidebar — and
 * fades into the normal theme background below. The gradient is built from theme tokens, so it blends in dark AND light.
 *
 * Video banners are muted by default. With "video sound" on, the video keeps RUNNING but its audio is silenced while
 * music plays, and fades back in (2 s) when the music pauses.
 */
export function Banner() {
  const [banner] = useBanner();
  const { isPlaying } = usePlayback();
  const url = useBannerUrl(banner.path, banner.kind);
  const video = useRef<HTMLVideoElement>(null);
  const fadeRaf = useRef(0);

  useEffect(() => {
    const el = video.current;
    if (!el || banner.kind !== "video") return;
    cancelAnimationFrame(fadeRaf.current);
    if (!banner.videoAudio) {
      el.muted = true;
      return;
    }
    el.muted = false;
    const target = isPlaying ? 0 : 1;
    const from = el.volume;
    const ms = isPlaying ? 250 : 2000; // duck quickly when music starts, return gradually when it stops
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      el.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k < 1) fadeRaf.current = requestAnimationFrame(step);
    };
    fadeRaf.current = requestAnimationFrame(step);
    void el.play().catch(() => undefined); // keep it running regardless of audio state
    return () => cancelAnimationFrame(fadeRaf.current);
  }, [isPlaying, banner.videoAudio, banner.kind, url]);

  if (banner.kind === "none" || !url) return null;
  return (
    <div className="app-banner" style={{ ["--banner-height" as string]: `${banner.heightPx}px`, ["--banner-dim" as string]: banner.dim }} aria-hidden="true">
      {banner.kind === "photo" ? (
        <img src={url} alt="" draggable={false} />
      ) : (
        <video ref={video} src={url} autoPlay loop muted playsInline />
      )}
      <div className="app-banner__veil" />
    </div>
  );
}
