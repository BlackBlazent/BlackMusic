import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { usePersistentState } from "@/lib/usePersistentState";
import { CloseIcon, ExpandIcon, MinimizeIcon } from "@/app/layout/icons";
import { Overlay } from "./Overlay";

const TOPBAR = 56;
const FOOTER = 36;

interface Props {
  /** Unique key — position/minimized state is remembered per window. */
  id: string;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number | string;
  defaultPosition?: { x: number; y: number };
  minimizable?: boolean;
  /** Keep children mounted while minimized (e.g. a playing video). */
  keepMounted?: boolean;
}

/**
 * A draggable window rendered in the global overlay layer (outside <main>), so it can be dragged anywhere
 * from just under the navbar to just above the footer and never collapses the page layout beneath it.
 */
export function FloatingWindow({ id, title, onClose, children, width = 520, defaultPosition = { x: 140, y: 100 }, minimizable = true, keepMounted = false }: Props) {
  const [pos, setPos] = usePersistentState<{ x: number; y: number }>(`window.${id}.pos`, defaultPosition);
  const [minimized, setMinimized] = usePersistentState<boolean>(`window.${id}.min`, false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const clamp = useCallback((x: number, y: number) => {
    const w = ref.current?.offsetWidth ?? 300;
    return {
      x: Math.min(Math.max(0, window.innerWidth - 80), Math.max(80 - w, x)),
      y: Math.min(window.innerHeight - FOOTER - 36, Math.max(TOPBAR, y)),
    };
  }, []);

  // Re-clamp when the window resizes so a window can never be stranded off-screen.
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, setPos]);

  const onDown = (e: PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy));
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <Overlay layer="window">
      <div
        ref={ref}
        className="bm-window"
        data-dragging={dragging}
        data-minimized={minimized}
        style={{ left: pos.x, top: Math.max(TOPBAR, pos.y), width: minimized ? 240 : width }}
        role="dialog"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <div className="bm-window__header" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <span className="bm-window__title">{title}</span>
          {minimizable && (
            <button type="button" onPointerDown={stop} onClick={() => setMinimized((v) => !v)} aria-label={minimized ? "Restore" : "Minimize"}>
              {minimized ? <ExpandIcon /> : <MinimizeIcon />}
            </button>
          )}
          <button type="button" onPointerDown={stop} onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {(!minimized || keepMounted) && (
          <div className="bm-window__body" hidden={minimized}>
            {children}
          </div>
        )}
      </div>
    </Overlay>
  );
}
