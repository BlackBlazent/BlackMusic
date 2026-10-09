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

/** Three-dots menu used on Library tracks and Playground queue cards. */
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
