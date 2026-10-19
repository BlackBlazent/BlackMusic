import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Overlay } from "./Overlay";

interface Props {
  anchorRef: RefObject<HTMLElement>;
  onClose: () => void;
  children: ReactNode;
  /** Prefer opening above the anchor (default) or below it. Flips automatically when there's no room. */
  placement?: "top" | "bottom";
  width?: number;
  title?: string;
}

/**
 * A popover in the global overlay layer, positioned from an anchor's bounding box. Because it floats outside the page
 * flow it can never push or collapse neighbouring layout (the old inline Playground panels squeezed the theater stage).
 */
export function AnchoredPopover({ anchorRef, onClose, children, placement = "top", width = 420, title }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number }>({ left: 8, maxHeight: 360 });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const w = Math.min(width, window.innerWidth - 16);
      const left = Math.min(Math.max(8, a.left + a.width / 2 - w / 2), window.innerWidth - w - 8);
      const spaceAbove = a.top - 64;
      const spaceBelow = window.innerHeight - a.bottom - 48;
      const up = placement === "top" ? spaceAbove >= 180 || spaceAbove >= spaceBelow : spaceBelow < 180 && spaceAbove > spaceBelow;
      setStyle(up ? { left, bottom: window.innerHeight - a.top + 8, maxHeight: Math.max(160, spaceAbove - 8) } : { left, top: a.bottom + 8, maxHeight: Math.max(160, spaceBelow - 8) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, placement, width]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  return (
    <Overlay layer="popover">
      <div ref={ref} className="bm-popover" role="dialog" aria-label={title} style={{ ...style, width: Math.min(width, window.innerWidth - 16) }}>
        {title && <div className="bm-popover__title">{title}</div>}
        <div className="bm-popover__body">{children}</div>
      </div>
    </Overlay>
  );
}
