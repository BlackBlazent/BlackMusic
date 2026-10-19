import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Overlay } from "@/app/overlay/Overlay";
import { useT } from "@/lib/i18n";
import { CloseIcon, SearchIcon } from "./icons";
import "./SearchOverlay.css";

/**
 * Mobile search: the top bar only carries a search ICON; activating it opens this input in the global popover layer, above
 * the top bar, navigation and page content, so nothing underneath is pushed or covered unpredictably.
 * Closes with the X, Escape, a tap on the dimmed area, or by submitting.
 */
export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
    onClose();
  };

  return (
    <Overlay layer="popover">
      <div className="search-overlay" role="dialog" aria-label="Search">
        <div className="search-overlay__backdrop" onClick={onClose} />
        <form className="search-overlay__bar" onSubmit={submit} role="search">
          <SearchIcon className="search-overlay__icon" />
          <input
            ref={input}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label="Search BlackMusic"
          />
          <button type="button" onClick={onClose} aria-label="Close search">
            <CloseIcon />
          </button>
        </form>
      </div>
    </Overlay>
  );
}
