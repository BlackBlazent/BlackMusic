import { useEffect, type RefObject } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { readSpectrum } from "@/lib/audio/audioEngine";

export type CoverEffect = "off" | "vibrate" | "zoom" | "rotate";

/**
 * Dynamic Cover Art Effects — the cover vibrates, zooms or rotates slowly with the rhythm.
 * Writes transforms straight to the element (no React renders at 60 fps). Toggled in Settings → Personalization.
 */
export function useStageEffects(ref: RefObject<HTMLElement>, effect: CoverEffect) {
  const { audioElement, isPlaying } = usePlayback();
  useEffect(() => {
    const el = ref.current;
    if (!el || effect === "off") {
      if (el) el.style.transform = "";
      return;
    }
    let raf = 0;
    let angle = 0;
    let smooth = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const sp = readSpectrum(audioElement, isPlaying);
      smooth += (sp.bass - smooth) * 0.35;
      if (effect === "zoom") el.style.transform = `scale(${1 + smooth * 0.09})`;
      else if (effect === "vibrate") el.style.transform = `translate(${(Math.random() - 0.5) * smooth * 7}px, ${(Math.random() - 0.5) * smooth * 7}px)`;
      else {
        angle += isPlaying ? 0.12 + smooth * 0.5 : 0;
        el.style.transform = `rotate(${angle}deg) scale(${1 + smooth * 0.03})`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, [ref, effect, audioElement, isPlaying]);
}
