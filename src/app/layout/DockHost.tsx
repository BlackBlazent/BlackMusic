import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useDock, type DockSettings } from "@/lib/personalization";
import { useIsMobile } from "@/lib/useIsMobile";
import { Overlay } from "@/app/overlay/Overlay";
import { FolderIcon, HomeIcon, LibraryIcon, LocalIcon, NextIcon, OnlineIcon, PauseIcon, PlayIcon, PlaygroundIcon, PreviousIcon, SettingsIcon } from "./icons";
import "./DockHost.css";

const ITEMS: { key: keyof DockSettings["pages"]; to: string; label: string; icon: typeof HomeIcon; end?: boolean }[] = [
  { key: "home", to: "/", label: "Home", icon: HomeIcon, end: true },
  { key: "playground", to: "/playground", label: "Playground", icon: PlaygroundIcon },
  { key: "local", to: "/local", label: "Local", icon: LocalIcon },
  { key: "online", to: "/online", label: "Online", icon: OnlineIcon },
  { key: "library", to: "/library", label: "Library", icon: LibraryIcon },
  { key: "folder", to: "/folder", label: "Folders", icon: FolderIcon },
  { key: "settings", to: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Where the navbar / footer / sidebar currently are, so the dock can sit right against (and emerge from) them. */
function useChromeInsets() {
  const [insets, setInsets] = useState({ top: 56, bottom: 36, left: 0, right: 0 });
  useEffect(() => {
    const measure = () => {
      const q = (s: string) => document.querySelector(s)?.getBoundingClientRect();
      const bar = q(".global-bar");
      const footer = q(".app-footer");
      setInsets({
        top: q(".topbar")?.bottom ?? 56,
        bottom: window.innerHeight - (bar?.top ?? footer?.top ?? window.innerHeight),
        left: q(".sidebar")?.right ?? 0,
        right: 0,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const s of [".topbar", ".global-bar", ".app-footer", ".sidebar"]) {
      const el = document.querySelector(s);
      if (el) ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  return insets;
}

/**
 * Dock Mode — a floating dock pinned to a screen edge that holds page shortcuts plus the global playback controls.
 * It emerges from the chrome it's attached to (footer ↔ bottom, navbar ↔ top, sidebar ↔ left, main container ↔ right),
 * magnifies items under the pointer (macOS style) and can auto-hide. Configure in Settings → Personalization.
 */
export function DockHost() {
  const [dock] = useDock();
  const mobile = useIsMobile();
  const { isPlaying, togglePlay, next, previous, currentTrack } = usePlayback();
  const { pathname } = useLocation();
  const insets = useChromeInsets();
  const [pointer, setPointer] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const vertical = dock.edge === "left" || dock.edge === "right";

  if (dock.edge === "off" || mobile) return null;

  const items = ITEMS.filter((i) => dock.pages[i.key]);
  const scaleFor = (i: number): number => {
    if (!dock.magnify || pointer === null) return 1;
    const el = refs.current[i];
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    const center = vertical ? r.top + r.height / 2 : r.left + r.width / 2;
    const d = Math.abs(pointer - center) / (dock.iconSize * 1.6);
    return 1 + (dock.magnification - 1) * Math.exp(-d * d);
  };

  const place: CSSProperties =
    dock.edge === "bottom" ? { left: "50%", bottom: insets.bottom + 8 }
    : dock.edge === "top" ? { left: "50%", top: insets.top + 8 }
    : dock.edge === "left" ? { top: "50%", left: insets.left + 8 }
    : { top: "50%", right: 8 };

  const hidden = dock.autoHide && !revealed;
  return (
    <Overlay layer="window">
      {dock.autoHide && <div className="dock-hotzone" data-edge={dock.edge} style={{ ...(dock.edge === "bottom" ? { bottom: insets.bottom } : {}) }} onPointerEnter={() => setRevealed(true)} />}
      <nav
        className="dock"
        data-edge={dock.edge}
        data-hidden={hidden}
        style={{ ...place, ["--dock-size" as string]: `${dock.iconSize}px` }}
        aria-label="Dock"
        onPointerMove={(e) => setPointer(vertical ? e.clientY : e.clientX)}
        onPointerLeave={() => { setPointer(null); setRevealed(false); }}
      >
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              ref={(el: HTMLAnchorElement | null) => { refs.current[i] = el; }}
              className="dock__item"
              data-active={active}
              style={{ transform: `scale(${scaleFor(i)})` }}
              title={item.label}
              aria-label={item.label}
            >
              <Icon />
            </NavLink>
          );
        })}
        {dock.pages.playback && (
          <>
            <span className="dock__sep" />
            {[
              { label: "Previous", icon: <PreviousIcon />, run: previous },
              { label: isPlaying ? "Pause" : "Play", icon: isPlaying ? <PauseIcon /> : <PlayIcon />, run: togglePlay, primary: true },
              { label: "Next", icon: <NextIcon />, run: next },
            ].map((b, k) => {
              const idx = items.length + k;
              return (
                <button
                  key={b.label}
                  type="button"
                  ref={(el) => { refs.current[idx] = el; }}
                  className="dock__item"
                  data-primary={b.primary ?? false}
                  disabled={!currentTrack}
                  style={{ transform: `scale(${scaleFor(idx)})` }}
                  title={b.label}
                  aria-label={b.label}
                  onClick={b.run}
                >
                  {b.icon}
                </button>
              );
            })}
          </>
        )}
      </nav>
    </Overlay>
  );
}
