import { detectMobile } from "./useIsMobile";

/**
 * Makes the web view behave like a native shell on phones:
 *  - marks <html data-mobile> early (before React renders) so scrollbar hiding / zoom lock apply from the first frame,
 *    including to portalled overlays that live outside the app shell;
 *  - blocks pinch zoom (iOS `gesture*` events, multi-touch moves on Android) and Ctrl+wheel / Ctrl+± zoom,
 *    WITHOUT touching single-finger scrolling, taps, text selection in inputs, or system gestures.
 * The viewport meta in index.html does the declarative half of this; these listeners cover WebViews that ignore it.
 */
export function installMobileLock(): void {
  if (typeof document === "undefined") return;
  const apply = () => document.documentElement.setAttribute("data-mobile", String(detectMobile()));
  apply();
  window.matchMedia("(max-width: 720px)").addEventListener("change", apply);
  if (!detectMobile()) return;

  const stop = (e: Event) => e.preventDefault();
  document.addEventListener("gesturestart", stop as EventListener, { passive: false });
  document.addEventListener("gesturechange", stop as EventListener, { passive: false });
  document.addEventListener("gestureend", stop as EventListener, { passive: false });
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) e.preventDefault(); });
}
