import { useEffect, useRef, useState } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { StageCanvas } from "@/pages/playground/StageCanvas";
import { Overlay } from "@/app/overlay/Overlay";
import { useScreensaver } from "@/lib/personalization";
import "./Screensaver.css";

/**
 * Visualizer-driven screensaver: music playing + no input for N minutes (default 5) → the app turns into a
 * music-reactive visual. Any input dismisses it. (A true OS-level screensaver isn't possible from an app — and not at
 * all on mobile — so this is an in-app one; it covers the entire window, navbar and footer included.)
 */
export function ScreensaverHost() {
  const [cfg] = useScreensaver();
  const { isPlaying, currentTrack } = usePlayback();
  const [active, setActive] = useState(false);
  const lastInput = useRef(Date.now());
  const shownAt = useRef(0);

  useEffect(() => {
    const bump = () => {
      lastInput.current = Date.now();
      // ignore the tiny pointer jitter right after it appears so it doesn't vanish instantly
      if (active && Date.now() - shownAt.current > 600) setActive(false);
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, bump, { passive: true });
    return () => { for (const e of events) window.removeEventListener(e, bump); };
  }, [active]);

  useEffect(() => {
    if (!cfg.enabled) { setActive(false); return; }
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastInput.current;
      if (!active && isPlaying && idle >= cfg.idleMinutes * 60_000) {
        shownAt.current = Date.now();
        setActive(true);
      }
      if (active && !isPlaying) setActive(false);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [cfg.enabled, cfg.idleMinutes, isPlaying, active]);

  if (!active) return null;
  return (
    <Overlay layer="screensaver">
      <div className="screensaver" role="presentation">
        {currentTrack?.artworkUrl && <div className="screensaver__backdrop" style={{ backgroundImage: `url("${currentTrack.artworkUrl}")` }} />}
        <StageCanvas mode={cfg.mode} className="screensaver__canvas" />
        {cfg.showTrackInfo && currentTrack && (
          <div className="screensaver__info">
            <strong>{currentTrack.title}</strong>
            <span>{currentTrack.artist}</span>
          </div>
        )}
      </div>
    </Overlay>
  );
}
