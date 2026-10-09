import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { PaneProvider } from "@/app/context/PaneContext";
import { ActionHistoryProvider } from "@/app/context/ActionHistoryContext";
import { AppSettingsProvider } from "@/app/context/AppSettingsContext";
import { FoldersProvider } from "@/app/context/FoldersContext";
import { LibraryProvider } from "@/app/context/LibraryContext";
import { FavoritesProvider } from "@/app/context/FavoritesContext";
import { PlaylistsProvider } from "@/app/context/PlaylistsContext";
import { PlaybackHistoryProvider } from "@/app/context/PlaybackHistoryContext";
import { PlaybackProvider } from "@/app/context/PlaybackContext";
import { ServicesProvider } from "@/app/context/ServicesContext";
import { NotificationsProvider } from "@/app/context/NotificationsContext";
import { AuthProvider } from "@/app/context/AuthContext";
import { PlayerUiProvider } from "@/app/context/PlayerUiContext";
import { PromotionsProvider } from "@/app/context/PromotionsContext";
import { LyricsProvider } from "@/app/features/lyrics/context/LyricsContext";
import { router } from "@/app/router";

export function App() {
  return (
    <ThemeProvider>
      <PaneProvider>
        <NotificationsProvider>
          <AuthProvider>
            <AppSettingsProvider>
              <ServicesProvider>
                <ActionHistoryProvider>
                  <FoldersProvider>
                    <LibraryProvider>
                      <FavoritesProvider>
                        <PlaylistsProvider>
                          <PlaybackHistoryProvider>
                            <PlaybackProvider>
                              <LyricsProvider>
                                <PromotionsProvider>
                                  <PlayerUiProvider>
                                    <RouterProvider router={router} />
                                  </PlayerUiProvider>
                                </PromotionsProvider>
                              </LyricsProvider>
                            </PlaybackProvider>
                          </PlaybackHistoryProvider>
                        </PlaylistsProvider>
                      </FavoritesProvider>
                    </LibraryProvider>
                  </FoldersProvider>
                </ActionHistoryProvider>
              </ServicesProvider>
            </AppSettingsProvider>
          </AuthProvider>
        </NotificationsProvider>
      </PaneProvider>
    </ThemeProvider>
  );
}
