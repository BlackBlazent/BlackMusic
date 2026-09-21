import { createHashRouter } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Home } from "@/pages/home/Home";
import { Playground } from "@/pages/playground/Playground";
import { Local } from "@/pages/local/Local";
import { Online } from "@/pages/online/Online";
import { Library } from "@/pages/library/Library";
import { Folder } from "@/pages/folder/Folder";
import { SearchResults } from "@/pages/search/SearchResults";
import { Settings } from "@/pages/settings/Settings";

// Hash routing: the production build is served from the filesystem inside the
// Tauri webview, not from a server that can handle arbitrary history paths.
export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: "playground", element: <Playground /> },
      { path: "local", element: <Local /> },
      { path: "online", element: <Online /> },
      { path: "library", element: <Library /> },
      { path: "folder", element: <Folder /> },
      { path: "search", element: <SearchResults /> },
      { path: "settings", element: <Settings /> },
    ],
  },
], {
  future: {
    // @ts-ignore
    v7_startTransition: true,
  },
});
