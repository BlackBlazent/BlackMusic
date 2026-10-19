import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./overlay.css";

/**
 * 2.2.0 — Global popover/overlay layer.
 *
 * Everything that must float freely (Services panel, dropped-link window, metadata editor, batch tag
 * editor, screensaver, …) is rendered through <Overlay>, which portals into `#bm-overlay-root`: a
 * sibling of the app shell, OUTSIDE <main> and outside the sidebar. That means:
 *   - no ancestor `overflow: hidden`, `transform` or stacking context can clip or trap it,
 *   - it can be dragged anywhere in the window,
 *   - the navbar and footer (z-index var(--z-chrome)) always render above windows (var(--z-window)).
 *
 * Layers (see overlay.css):  window < modal < chrome (navbar/footer) < popover < screensaver
 */
export type OverlayLayer = "window" | "modal" | "popover" | "screensaver";

const ROOT_ID = "bm-overlay-root";

function getRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

export function Overlay({ children, layer = "window" }: { children: ReactNode; layer?: OverlayLayer }) {
  const [root, setRoot] = useState<HTMLElement | null>(() => getRoot());
  useEffect(() => {
    if (!root) setRoot(getRoot());
  }, [root]);
  if (!root) return null;
  return createPortal(
    <div className="bm-overlay-layer" data-layer={layer}>
      {children}
    </div>,
    root,
  );
}
