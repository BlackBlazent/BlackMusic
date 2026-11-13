#!/usr/bin/env node
/**
 * Generates the README artwork: docs/assets/banners/*.svg and docs/assets/icons/*.svg.
 * Hand-written, self-contained SVG (no scripts, no external fonts/images, system font stacks only) in the One Dark palette,
 * so it renders on GitHub, where README images are sandboxed. Brand artwork only — NOT product screenshots.
 * Re-run:  node scripts/generate-readme-assets.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "docs", "assets");
mkdirSync(join(OUT, "banners"), { recursive: true });
mkdirSync(join(OUT, "icons"), { recursive: true });

const C = { bg: "#282c34", bg2: "#21252b", text: "#abb2bf", muted: "#5c6370", blue: "#61afef", green: "#98c379", yellow: "#e5c07b", purple: "#c678dd", red: "#e06c75", cyan: "#56b6c2" };
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Deterministic pseudo-random so every build of the artwork is identical. */
const rng = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

/** Equalizer bars along the right side, fading toward the text. */
function bars({ w, h, count, seed, accent }) {
  const r = rng(seed);
  const colors = [C.blue, C.cyan, C.green, C.purple, C.yellow];
  const gap = 14, bw = 8;
  const startX = w - count * (bw + gap) - 24;
  let out = "";
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const bh = Math.round((0.25 + r() * 0.6) * h * 0.62 * (0.55 + t * 0.45));
    const x = startX + i * (bw + gap);
    const y = Math.round(h / 2 - bh / 2);
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${i % 4 === 0 ? accent : colors[(i + seed) % colors.length]}" opacity="${(0.25 + t * 0.6).toFixed(2)}"/>`;
  }
  return out;
}

function svg({ w, h, title, desc, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.bg}"/><stop offset="1" stop-color="${C.bg2}"/></linearGradient>
<radialGradient id="glow" cx="0.82" cy="0.5" r="0.55"><stop offset="0" stop-color="${C.blue}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${C.text}" stroke-opacity="0.045" stroke-width="1"/></pattern>
</defs>
<rect width="${w}" height="${h}" rx="18" fill="url(#g)"/>
<rect width="${w}" height="${h}" rx="18" fill="url(#grid)"/>
<rect width="${w}" height="${h}" rx="18" fill="url(#glow)"/>
${body}
</svg>
`;
}

/** Section banner 1200x180: accent bar, big label, small brand line, optional status pill, equalizer. */
function banner({ file, label, accent, seed, desc, pill }) {
  const body = `${bars({ w: 1200, h: 180, count: 22, seed, accent })}
<rect x="48" y="44" width="8" height="92" rx="4" fill="${accent}"/>
<text x="80" y="104" font-family="${SANS}" font-size="64" font-weight="700" fill="${C.text}">${esc(label)}</text>
<text x="82" y="142" font-family="${MONO}" font-size="28" fill="${accent}">BlackMusic</text>
${pill ? `<rect x="${80 + label.length * 36 + 24}" y="62" width="${pill.length * 17 + 36}" height="40" rx="20" fill="${accent}" fill-opacity="0.16" stroke="${accent}" stroke-opacity="0.6"/><text x="${80 + label.length * 36 + 24 + 18}" y="89" font-family="${MONO}" font-size="22" fill="${accent}">${esc(pill)}</text>` : ""}`;
  writeFileSync(join(OUT, "banners", file), svg({ w: 1200, h: 180, title: `BlackMusic — ${label}`, desc, body }));
}

banner({ file: "features.svg", label: "Features", accent: C.blue, seed: 3, desc: "Banner artwork: the word Features with an equalizer graphic." });
banner({ file: "quick-start.svg", label: "Quick start", accent: C.green, seed: 11, desc: "Banner artwork: the words Quick start with an equalizer graphic." });
banner({ file: "downloads.svg", label: "Downloads", accent: C.yellow, seed: 19, desc: "Banner artwork: the word Downloads with an equalizer graphic." });
banner({ file: "platforms.svg", label: "Platforms", accent: C.purple, seed: 27, desc: "Banner artwork: the word Platforms with an equalizer graphic." });
banner({ file: "status.svg", label: "Status", accent: C.cyan, seed: 35, pill: "3.0.0 in progress", desc: "Banner artwork: the word Status with a pill reading 3.0.0 in progress, and an equalizer graphic." });
banner({ file: "contribute.svg", label: "Contribute", accent: C.red, seed: 43, desc: "Banner artwork: the word Contribute with an equalizer graphic." });

// Hero 1200x320
{
  const w = 1200, h = 320;
  const body = `${bars({ w, h, count: 14, seed: 7, accent: C.blue })}
<rect x="56" y="70" width="10" height="170" rx="5" fill="${C.blue}"/>
<text x="92" y="168" font-family="${SANS}" font-size="104" font-weight="800" fill="${C.text}">BlackMusic</text>
<text x="96" y="222" font-family="${MONO}" font-size="32" fill="${C.blue}">A modern home for your music collection</text>
<text x="96" y="268" font-family="${MONO}" font-size="28" fill="${C.muted}">desktop · mobile · your files</text>`;
  writeFileSync(join(OUT, "banners", "hero.svg"), svg({ w, h, title: "BlackMusic", desc: "Brand banner: BlackMusic, a modern home for your music collection, with an equalizer graphic.", body }));
}

// Icons 64x64 (shown at 28px): simple, high-contrast glyphs.
function icon(file, name, glyph, accent) {
  const body = `<rect width="64" height="64" rx="14" fill="${C.bg2}"/><g fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
  writeFileSync(join(OUT, "icons", file), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-labelledby="t"><title id="t">${esc(name)}</title>${body}</svg>\n`);
}
const note = `<path d="M26 44V18l20-4v26"/><circle cx="21" cy="44" r="6" fill="currentColor" stroke="none"/><circle cx="41" cy="40" r="6" stroke="none"/>`;
icon("features.svg", "Features", `<path d="M32 12l6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z"/>`, C.blue);
icon("quick-start.svg", "Quick start", `<path d="M22 14l28 18-28 18z"/>`, C.green);
icon("downloads.svg", "Downloads", `<path d="M32 12v28M20 30l12 12 12-12M14 52h36"/>`, C.yellow);
icon("platforms.svg", "Platforms", `<rect x="8" y="14" width="36" height="26" rx="3"/><path d="M18 50h16M26 40v10"/><rect x="48" y="26" width="10" height="20" rx="2"/>`, C.purple);
icon("status.svg", "Status", `<path d="M14 20l6 6 10-12M14 40l6 6 10-12M38 22h14M38 42h14"/>`, C.cyan);
icon("contribute.svg", "Contribute", `<circle cx="18" cy="16" r="5"/><circle cx="18" cy="48" r="5"/><circle cx="46" cy="28" r="5"/><path d="M18 21v22M46 33c0 8-10 8-22 12"/>`, C.red);
icon("general.svg", "General", `<path d="M26 44V18l20-4v26"/><circle cx="21" cy="44" r="5"/><circle cx="41" cy="40" r="5"/>`, C.blue);
console.log("README artwork written to docs/assets/.");
