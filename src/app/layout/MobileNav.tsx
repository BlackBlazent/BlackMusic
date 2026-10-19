import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FolderIcon, HomeIcon, LibraryIcon, LocalIcon, OnlineIcon, PlaygroundIcon, SettingsIcon } from "./icons";
import "./MobileNav.css";

const TABS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/playground", label: "Playing", icon: PlaygroundIcon },
  { to: "/local", label: "Local", icon: LocalIcon },
  { to: "/online", label: "Online", icon: OnlineIcon },
  { to: "/library", label: "Library", icon: LibraryIcon },
  { to: "/folder", label: "Folders", icon: FolderIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Bottom tab bar replacing the sidebar + footer on phones. Seven destinations (Local was missing — it had a route and a sidebar
 * entry, but this list stopped at six). They don't all fit on a narrow screen, so the row swipes sideways with its scrollbar hidden;
 * the active tab is scrolled into view on every navigation.
 */
export function MobileNav() {
  const { pathname } = useLocation();
  const row = useRef<HTMLElement>(null);
  useEffect(() => {
    row.current?.querySelector<HTMLElement>(".mobile-nav__tab.active")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);
  return (
    <nav className="mobile-nav" aria-label="Main" ref={row}>
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="mobile-nav__tab">
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
