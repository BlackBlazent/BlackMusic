import { useEffect, useRef } from "react";
import { usePlayerUi } from "@/app/context/PlayerUiContext";

/** YouTube embed with the JS API enabled so the transport controls can drive it via postMessage. */
export function VideoFrame({ videoId, className }: { videoId: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { registerPlayer } = usePlayerUi();

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    registerPlayer(frame, true);
    return () => registerPlayer(frame, false);
  }, [registerPlayer, videoId]);

  const params = new URLSearchParams({ enablejsapi: "1", autoplay: "1", rel: "0", modestbranding: "1", playsinline: "1", controls: "0", origin: window.location.origin });
  return (
    <iframe
      ref={ref}
      className={className}
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`}
      title="Video"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}