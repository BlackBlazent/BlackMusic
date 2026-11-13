import { useEffect } from "react";
import { detectTv, installSpatialNavigation } from "@/lib/tv/spatialNavigation";
import "./TvMode.css";

/** FEAT-15 — turns on remote-control navigation + a big focus ring on TVs. Renders nothing; does nothing on phones/desktops. */
export function TvMode() {
  useEffect(() => {
    if (!detectTv()) return;
    document.documentElement.dataset.tv = "true";
    const off = installSpatialNavigation();
    // Start with something focused so the very first D-pad press has a place to move from.
    const first = document.querySelector<HTMLElement>("main button, main a[href], nav button");
    first?.focus();
    return () => { off(); delete document.documentElement.dataset.tv; };
  }, []);
  return null;
}
