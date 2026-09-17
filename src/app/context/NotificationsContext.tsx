import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const STORAGE_KEY = "blackmusic:notifications";
const MAX_NOTIFICATIONS = 100;

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  push: (title: string, body?: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getPreference<AppNotification[]>(STORAGE_KEY, []).then((stored) => {
      setNotifications(
        stored.length > 0
          ? stored
          : [
              {
                id: "welcome",
                title: "Welcome to BlackMusic",
                body: "Add a watched folder in Folders to get started.",
                createdAt: Date.now(),
                read: false,
              },
            ],
      );
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) void setPreference(STORAGE_KEY, notifications.slice(-MAX_NOTIFICATIONS));
  }, [notifications, hydrated]);

  const push = (title: string, body?: string) => {
    setNotifications((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, body, createdAt: Date.now(), read: false },
    ]);
  };

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const clear = () => setNotifications([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, push, markAllRead, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
