import { useRef, useState, type PointerEvent } from "react";
import { CloseIcon, ExpandIcon, MinimizeIcon } from "@/app/layout/icons";
import { usePersistentState } from "@/lib/usePersistentState";
import { parseYouTubeId } from "@/lib/video/ytdlp";
import "./LinkDropperModal.css";

/**
 * 2.1.0: no longer a blocking, stationary modal. It's a floating window — drag it by the
 * header, minimize it to a small pill, and keep using the app underneath (no backdrop).
 * YouTube links open in the embed player; anything else loads in a sandboxed iframe.
 */
export function LinkDropperModal({ url, onClose }: { url: string; onClose: () => void }) {
  const id = parseYouTubeId(url);
  const src = id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0` : url;

  const [pos, setPos] = usePersistentState<{ x: number; y: number }>("linkWindow.position", { x: 120, y: 90 });
  const [minimized, setMinimized] = usePersistentState<boolean>("linkWindow.minimized", false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDown = (e: PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.min(window.innerWidth - 140, Math.max(0, e.clientX - drag.current.dx)),
      y: Math.min(window.innerHeight - 44, Math.max(0, e.clientY - drag.current.dy)),
    });
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div className="link-window" data-minimized={minimized} data-dragging={dragging} style={{ left: pos.x, top: pos.y }}>
      <div className="link-window__header" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
        <span className="link-window__url" title={url}>{minimized ? "Dropped link" : url}</span>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimized((v) => !v)} aria-label={minimized ? "Restore" : "Minimize"}>
          {minimized ? <ExpandIcon /> : <MinimizeIcon />}
        </button>
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </div>
      {/* Kept mounted while minimized so the video keeps playing. */}
      <iframe
        className="link-window__frame"
        src={src}
        title="Dropped link"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        hidden={minimized}
      />
    </div>
  );
}
