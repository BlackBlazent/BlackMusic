import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { APP_VERSION } from "@/lib/appVersion";

const STORAGE_KEY = "blackmusic:notifications";
const MAX_NOTIFICATIONS = 100;
const VERSION_KEY = "blackmusic:lastSeenVersion";

export interface AppNotification {
  id: string;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
  /** Clicking the notification opens this (e.g. the 2.1.0 changelog). */
  action?: "changelog";
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  push: (title: string, body?: string, action?: AppNotification["action"]) => void;
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

      // One-time "what's new" notice per version.
      getPreference<string>(VERSION_KEY, "").then((seen) => {
        if (seen === APP_VERSION) return;

        void setPreference(VERSION_KEY, APP_VERSION);

        setNotifications((prev) => {
          const notificationId = `update-${APP_VERSION}`;

          // Prevent duplicate update notifications.
          if (prev.some((n) => n.id === notificationId)) {
            return prev;
          }

          return [
            ...prev,
            {
              id: notificationId,
              title: `BlackMusic ${APP_VERSION} is here`,
              body: "Tap to see what's new — video mode, PiP, lyrics, sleep timer, fast import and more.",
              createdAt: Date.now(),
              read: false,
              action: "changelog",
            },
          ];
        });
      });
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      void setPreference(
        STORAGE_KEY,
        notifications.slice(-MAX_NOTIFICATIONS),
      );
    }
  }, [notifications, hydrated]);

  const push = (
    title: string,
    body?: string,
    action?: AppNotification["action"],
  ) => {
    setNotifications((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        body,
        createdAt: Date.now(),
        read: false,
        action,
      },
    ]);
  };

  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
      })),
    );
  };

  const clear = () => setNotifications([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        push,
        markAllRead,
        clear,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);

  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }

  return ctx;
}