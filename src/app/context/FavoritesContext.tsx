import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const STORAGE_KEY = "blackmusic:favorites";

interface FavoritesContextValue {
  favoriteIds: Set<string>;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getPreference<string[]>(STORAGE_KEY, []).then((ids) => setFavoriteIds(new Set(ids)));
  }, []);

  const toggleFavorite = (trackId: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      void setPreference(STORAGE_KEY, [...next]);
      return next;
    });
  };

  return (
    <FavoritesContext.Provider
      value={{ favoriteIds, isFavorite: (id) => favoriteIds.has(id), toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
