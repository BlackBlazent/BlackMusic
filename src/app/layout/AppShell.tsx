import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { GlobalPlaybackBar } from "./GlobalPlaybackBar";
import { FloatingPlaygroundToggle } from "./FloatingPlaygroundToggle";
import { Footer } from "./Footer";
import "./AppShell.css";

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar />
        <main className="app-shell__content">
          <Outlet />
        </main>
        <GlobalPlaybackBar />
        <Footer />
      </div>
      <FloatingPlaygroundToggle />
    </div>
  );
}
