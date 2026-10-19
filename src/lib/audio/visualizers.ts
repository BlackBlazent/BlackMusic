import type { Spectrum } from "./audioEngine";

export type VizMode = "bars" | "waves" | "particles" | "liquid";
export const VIZ_MODES: { id: VizMode; label: string }[] = [
  { id: "bars", label: "Bars" },
  { id: "waves", label: "Waves" },
  { id: "particles", label: "Particles" },
  { id: "liquid", label: "Liquid" },
];

interface Particle { x: number; y: number; vx: number; vy: number; life: number; hue: number; size: number }
const state: { particles: Particle[]; phase: number; blobs: { a: number; s: number; r: number }[] } = {
  particles: [],
  phase: 0,
  blobs: Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, s: 0.3 + i * 0.07, r: 0.18 + (i % 3) * 0.05 })),
};

/** Draws one animation frame. `accent` is any CSS color; all modes react to the spectrum (real or synthetic). */
export function drawVisualizer(ctx: CanvasRenderingContext2D, mode: VizMode, sp: Spectrum, w: number, h: number, accent: string, dt = 0.016): void {
  ctx.clearRect(0, 0, w, h);
  state.phase += dt;

  if (mode === "bars") {
    const bars = Math.max(24, Math.floor(w / 14));
    const step = Math.floor((sp.freq.length * 0.7) / bars);
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      let v = 0;
      for (let j = 0; j < step; j++) v += sp.freq[i * step + j];
      v = v / step / 255;
      const bh = Math.max(2, v * h * 0.92);
      const grad = ctx.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, "rgba(255,255,255,0.9)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(i * bw + bw * 0.12, h - bh, bw * 0.76, bh, 3);
      ctx.fill();
    }
  } else if (mode === "waves") {
    for (let layer = 0; layer < 3; layer++) {
      ctx.beginPath();
      ctx.lineWidth = 3 - layer * 0.7;
      ctx.strokeStyle = layer === 0 ? accent : `rgba(255,255,255,${0.5 - layer * 0.18})`;
      const amp = (0.18 + sp.level * 0.9) * h * (1 - layer * 0.25);
      for (let x = 0; x <= w; x += 4) {
        const idx = Math.floor((x / w) * (sp.wave.length - 1));
        const wv = (sp.wave[idx] - 128) / 128;
        const y = h / 2 + (wv * amp) + Math.sin(x * 0.012 + state.phase * (2 + layer)) * amp * 0.25;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (mode === "particles") {
    const spawn = Math.floor(2 + sp.bass * 18);
    for (let i = 0; i < spawn && state.particles.length < 600; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp2 = 40 + sp.level * 260 * Math.random();
      state.particles.push({ x: w / 2, y: h / 2, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2, life: 1, hue: (state.phase * 40 + Math.random() * 60) % 360, size: 1.5 + Math.random() * 2.5 + sp.bass * 3 });
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.7;
      ctx.fillStyle = `hsla(${p.hue}, 90%, 62%, ${Math.max(0, p.life)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(0.2, p.life), 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // liquid: soft metaballs that swell with the bass
    ctx.save();
    ctx.filter = "blur(18px) contrast(18)";
    ctx.globalCompositeOperation = "lighter";
    state.blobs.forEach((b, i) => {
      b.a += dt * b.s * (0.6 + sp.level * 3);
      const r = Math.min(w, h) * (b.r + sp.bass * 0.22);
      const x = w / 2 + Math.cos(b.a + i) * w * 0.28;
      const y = h / 2 + Math.sin(b.a * 1.3 + i) * h * 0.26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, i % 2 ? accent : "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}
