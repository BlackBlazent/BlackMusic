import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GlobalPlaybackBar } from "./GlobalPlaybackBar";
import { FloatingPlaygroundToggle } from "./FloatingPlaygroundToggle";
import { Footer } from "./Footer";
import { PipHost } from "@/app/components/PipHost"; // import { PipPlayer } from "@/app/components/PipPlayer";
import { RouteResume } from "./RouteResume";
import { Banner } from "./Banner";
import { DockHost } from "./DockHost";
import { ScreensaverHost } from "./Screensaver";
import { FileOpenHandler } from "./FileOpenHandler";
import { MobileNav } from "./MobileNav";
import { useBanner, useButtonMotion } from "@/lib/personalization";
import { useIsMobile } from "@/lib/useIsMobile";
import { useLanguage } from "@/lib/i18n";
import { useMediaSession } from "@/lib/mediaSession";
import { useEffect } from "react";
import { useSyncRunner } from "@/lib/sync/useSyncRunner";
import { GlobalErrorWatcher } from "@/app/components/ErrorScreens";
import { TvMode } from "@/app/components/TvMode";
import { UpdateWatcher } from "@/app/components/UpdateWatcher";
import "./AppShell.css";

export function AppShell() {
  useSyncRunner(); // 3.0.0: optional background sync (only acts when the user turned it on and is signed in)
  const [banner] = useBanner();
  const [motion] = useButtonMotion();
  const mobile = useIsMobile();
  const [lang] = useLanguage();
  useMediaSession(); // lock-screen / notification-shade media controls
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { document.documentElement.setAttribute("data-mobile", String(mobile)); }, [mobile]);
  return (
    <div className="app-shell" data-banner={banner.kind !== "none"} data-motion={motion} data-mobile={mobile}>
      <TvMode />
      <GlobalErrorWatcher />
      <Banner />
      <RouteResume />
      <FileOpenHandler />
      {!mobile && <Sidebar />}
      <div className="app-shell__main">
        <TopBar />
        <main className="app-shell__content">
          <Outlet />
          <UpdateWatcher />
        </main>
        <GlobalPlaybackBar />
        {mobile ? <MobileNav /> : <Footer />}
      </div>
      <DockHost />
      <ScreensaverHost />
      <FloatingPlaygroundToggle />
      <PipHost /> {/*<PipPlayer />*/}
    </div>
  );
}
