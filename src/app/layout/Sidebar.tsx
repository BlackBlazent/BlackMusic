import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { NavLink } from "react-router-dom";
import {
  ChevronsLeftIcon,
  FolderIcon,
  HomeIcon,
  LibraryIcon,
  LocalIcon,
  OnlineIcon,
  PlaygroundIcon,
  SettingsIcon,
} from "./icons";
import { usePane, SIDEBAR_COLLAPSED_WIDTH } from "@/app/context/PaneContext";
import { ServicesMenu } from "./ServicesMenu";
import { Tooltip } from "@/app/components/Tooltip";
import { useT, type TKey } from "@/lib/i18n";
import "./Sidebar.css";

const NAV_ITEMS = [
  { to: "/", label: "nav.home" as TKey, icon: HomeIcon, end: true },
  { to: "/playground", label: "nav.playground" as TKey, icon: PlaygroundIcon, end: false },
  { to: "/local", label: "nav.local" as TKey, icon: LocalIcon, end: false },
  { to: "/online", label: "nav.online" as TKey, icon: OnlineIcon, end: false },
  { to: "/library", label: "nav.library" as TKey, icon: LibraryIcon, end: false },
  { to: "/folder", label: "nav.folders" as TKey, icon: FolderIcon, end: false },
  { to: "/settings", label: "nav.settings" as TKey, icon: SettingsIcon, end: false },
];

export function Sidebar() {
  const t = useT();
  const { collapsed, width, toggleCollapsed, setWidth } = usePane();
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      if (collapsed) return;
      dragState.current = { startX: event.clientX, startWidth: width };

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragState.current) return;
        const delta = moveEvent.clientX - dragState.current.startX;
        setWidth(dragState.current.startWidth + delta);
      };
      const onUp = () => {
        dragState.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [collapsed, width, setWidth],
  );

  return (
    <aside
      className="sidebar"
      data-collapsed={collapsed}
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : width }}
    >
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <ServicesMenu />
          {!collapsed && <span className="sidebar__logo-text">BlackMusic</span>}
        </div>
        <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            type="button"
            className="sidebar__collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            <ChevronsLeftIcon style={{ transform: collapsed ? "rotate(180deg)" : undefined }} />
          </button>
        </Tooltip>
      </div>

      <nav className="sidebar__nav" aria-label="Pages">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) =>
          collapsed ? (
            <Tooltip key={to} label={t(label)} side="right">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `sidebar__nav-item${isActive ? " is-active" : ""}`}
              >
                <Icon className="sidebar__nav-icon" />
              </NavLink>
            </Tooltip>
          ) : (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `sidebar__nav-item${isActive ? " is-active" : ""}`}
            >
              <Icon className="sidebar__nav-icon" />
              <span>{t(label)}</span>
            </NavLink>
          ),
        )}
      </nav>

      {!collapsed && (
        <div className="sidebar__resize-handle" onMouseDown={onResizeStart} aria-hidden="true" />
      )}
    </aside>
  );
}
