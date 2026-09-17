import { useRef, useState } from "react";
import { useNotifications } from "@/app/context/NotificationsContext";
import { useClickOutside } from "@/lib/useClickOutside";
import { BellIcon } from "./icons";
import "./NotificationsPopover.css";

function timeAgo(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAllRead } = useNotifications();
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div className="notifications-popover" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notifications-popover__badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notifications-popover__panel" role="menu">
          <h2>Notifications</h2>
          {notifications.length === 0 ? (
            <p className="notifications-popover__empty">Nothing yet.</p>
          ) : (
            <div className="notifications-popover__list">
              {[...notifications].reverse().map((n) => (
                <div key={n.id} className="notifications-popover__item">
                  <span className="notifications-popover__item-title">{n.title}</span>
                  {n.body && <span className="notifications-popover__item-body">{n.body}</span>}
                  <span className="notifications-popover__item-time">{timeAgo(n.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
