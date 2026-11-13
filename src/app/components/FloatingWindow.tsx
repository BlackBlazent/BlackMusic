import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Overlay } from "@/app/overlay/Overlay";
import { useIsMobile } from "@/lib/useIsMobile";
import "./FloatingWindow.css";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  height?: number;
  /** Resizable by dragging the bottom-right corner (desktop). */
  resizable?: boolean;
  /** Actions shown in the title bar before the minimize/close buttons. */
  actions?: ReactNode;
}

/**
 * 3.0.0 — a reusable global floating window (draggable by its title bar, minimizable, closable, optionally resizable).
 * Rendered through <Overlay>, so no page can clip it. On phones it docks as a bottom sheet instead of floating.
 */
export function FloatingWindow({ title, onClose, children, width = 420, height = 520, resizable = true, actions }: Props) {
  const mobile = useIsMobile();
  const [pos, setPos] = useState(() => ({ x: Math.max(8, window.innerWidth - width - 32), y: 72 }));
  const [minimized, setMinimized] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const clamp = useCallback((x: number, y: number) => {
    const w = box.current?.offsetWidth ?? width;
    return { x: Math.min(Math.max(-w + 80, x), window.innerWidth - 80), y: Math.min(Math.max(0, y), window.innerHeight - 40) };
  }, [width]);

  const onDown = (e: RPointerEvent) => {
    if (mobile || (e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => drag.current && setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  const onUp = () => (drag.current = null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <Overlay layer="window">
      <div
        ref={box}
        className="bm-float"
        data-mobile={mobile}
        data-minimized={minimized}
        data-resizable={resizable && !mobile && !minimized}
        style={mobile ? undefined : { left: pos.x, top: pos.y, width, height: minimized ? undefined : height }}
        role="dialog"
        aria-label={title}
      >
        <div className="bm-float__bar" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onDoubleClick={() => setMinimized((m) => !m)}>
          <strong>{title}</strong>
          <span className="bm-float__actions">
            {actions}
            <button type="button" onClick={() => setMinimized((m) => !m)} aria-label={minimized ? "Restore" : "Minimize"} title={minimized ? "Restore" : "Minimize"}>{minimized ? "▢" : "–"}</button>
            <button type="button" onClick={onClose} aria-label="Close" title="Close">✕</button>
          </span>
        </div>
        {!minimized && <div className="bm-float__body">{children}</div>}
      </div>
    </Overlay>
  );
}
