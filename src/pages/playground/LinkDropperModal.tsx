import { parseYouTubeId } from "@/lib/video/ytdlp";
import { FloatingWindow } from "@/app/overlay/FloatingWindow";
import "./LinkDropperModal.css";

/**
 * 2.2.0: rendered through the global overlay layer (FloatingWindow), so it's no longer a child of the Playground
 * page — it can be dragged anywhere, stays under the navbar/footer, and never disturbs the page layout.
 * YouTube links open in the embed player; anything else loads in a sandboxed iframe.
 */
export function LinkDropperModal({ url, onClose }: { url: string; onClose: () => void }) {
  const id = parseYouTubeId(url);
  const src = id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : url;
  return (
    <FloatingWindow id="link-window" title={url} onClose={onClose} width={560} keepMounted defaultPosition={{ x: 120, y: 90 }}>
      <iframe
        className="link-window__frame"
        src={src}
        title="Dropped link"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </FloatingWindow>
  );
}
