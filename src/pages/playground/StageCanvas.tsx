import { useEffect, useRef } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { readSpectrum } from "@/lib/audio/audioEngine";
import { drawVisualizer, type VizMode } from "@/lib/audio/visualizers";

/** Music-reactive canvas (Bars / Waves / Particles / Liquid). Sized by its container, so it never affects layout. */
export function StageCanvas({ mode, className, accent = "#ff0030" }: { mode: VizMode; className?: string; accent?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { audioElement, isPlaying } = usePlayback();
  const playing = useRef(isPlaying);
  playing.current = isPlaying;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.floor(r.width * dpr));
      el.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const r = el.getBoundingClientRect();
      drawVisualizer(ctx, mode, readSpectrum(audioElement, playing.current), r.width, r.height, accent, dt);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [audioElement, mode, accent]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
