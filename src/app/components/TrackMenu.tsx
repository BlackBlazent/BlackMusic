{/*}
import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import { MoreIcon } from "@/app/layout/icons";
import "./TrackMenu.css";

export interface TrackMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/** Three-dots menu used on Library tracks and Playground queue cards. 
export function TrackMenu({ items, label = "More", align = "right" }: { items: TrackMenuItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div className="track-menu" ref={ref} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button type="button" className="track-menu__trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} data-active={open} onClick={() => setOpen((v) => !v)}>
        <MoreIcon />
      </button>
      {open && (
        <div className="track-menu__panel" data-align={align} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="track-menu__item"
              data-danger={item.danger}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
  */}

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreIcon } from "@/app/layout/icons";
import { Overlay } from "@/app/overlay/Overlay";
import "./TrackMenu.css";

export interface TrackMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

const PANEL_WIDTH = 190;
const GAP = 4;

/**
 * Three-dots menu used on Library tracks and Playground queue cards.
 * 2.2.0: the panel is rendered in the global popover layer (outside the strip / list that holds the button), so it is
 * never clipped by `overflow`, never adds an inner scrollbar, and flips above the button when there's no room below.
 */
export function TrackMenu({ items, label = "More", align = "right" }: { items: TrackMenuItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Position from the trigger's bounding box (fixed coordinates).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const rawLeft = align === "right" ? r.right - PANEL_WIDTH : r.left;
    const left = Math.min(Math.max(8, rawLeft), window.innerWidth - PANEL_WIDTH - 8);
    const panelHeight = panelRef.current?.offsetHeight ?? items.length * 34 + 8;
    const spaceBelow = window.innerHeight - r.bottom - 48; // keep clear of the footer
    if (spaceBelow >= panelHeight + GAP) setPos({ left, top: r.bottom + GAP });
    else setPos({ left, bottom: window.innerHeight - r.top + GAP }); // flip above
  }, [open, align, items.length]);

  // Close on outside click, Escape, resize, or when anything scrolls (the button moves, so the panel would drift).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <div className="track-menu" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        className="track-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon />
      </button>
      {open && (
        <Overlay layer="popover">
          <div ref={panelRef} className="track-menu__panel" data-align={align} role="menu" style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: PANEL_WIDTH }}>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="track-menu__item"
                data-danger={item.danger}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </Overlay>
      )}
    </div>
  );
}
