import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useActionHistory } from "@/app/context/ActionHistoryContext";
import { useTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/context/AuthContext";
import { Tooltip } from "@/app/components/Tooltip";
import { MoonIcon, RedoArrowIcon, SearchIcon, SunIcon, UndoArrowIcon } from "./icons";
import { NotificationsPopover } from "./NotificationsPopover";
import { AccountModal } from "./AccountModal";
import { AccountPopover } from "./AccountPopover";
import "./TopBar.css";

export function TopBar() {
  const navigate = useNavigate();
  const { canUndo, canRedo, undo, redo } = useActionHistory();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <header className="topbar">
      <div className="topbar__history">
        <Tooltip label="Undo" side="bottom">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo last playback action">
            <UndoArrowIcon />
          </button>
        </Tooltip>
        <Tooltip label="Redo" side="bottom">
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo playback action">
            <RedoArrowIcon />
          </button>
        </Tooltip>
      </div>

      <form className="topbar__search" onSubmit={onSubmit} role="search">
        <SearchIcon className="topbar__search-icon" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your library, or try @youtube:, @online-spotify:, @genius:…"
          aria-label="Search BlackMusic"
        />
      </form>

      <div className="topbar__actions">
        <Tooltip label={theme === "dark" ? "Switch to light" : "Switch to dark"} side="bottom">
          <button type="button" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </Tooltip>

        <NotificationsPopover />

        <Tooltip label={user ? user.email ?? "Account" : "Log in / Sign up"} side="bottom">
          <div className="topbar__account-wrapper">
            <button
              type="button"
              className="topbar__account"
              aria-label="Account"
              onClick={() => setAccountOpen((v) => !v)}
            >
              <span className="topbar__account-avatar" data-signed-in={Boolean(user)} aria-hidden="true" />
            </button>
            {accountOpen && user && <AccountPopover onClose={() => setAccountOpen(false)} />}
          </div>
        </Tooltip>
      </div>

      {accountOpen && !user && <AccountModal onClose={() => setAccountOpen(false)} />}
    </header>
  );
}
