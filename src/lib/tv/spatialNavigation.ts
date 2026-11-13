/**
 * FEAT-15 golden rule — a TV remote is a D-pad: Up / Down / Left / Right / Enter, no mouse, no touch.
 * A small dependency-free spatial navigation: on an arrow key, focus moves to the nearest focusable element in that direction.
 * (Written in-house instead of adding a package; the TV reference suggested Norigin Spatial Navigation, whose name/maintenance
 * was unverified.) Active only in TV mode, so phones and desktops behave exactly as before.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [role="tab"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"])';
type Dir = "left" | "right" | "up" | "down";

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
};

/** The element that currently owns the screen: an open dialog/floating window if there is one, otherwise the whole page. */
const scope = (): ParentNode => document.querySelector<HTMLElement>('[role="dialog"]:last-of-type, .bm-float:last-of-type') ?? document;

export function pickNext(from: HTMLElement, dir: Dir, candidates: HTMLElement[]): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
  let best: { el: HTMLElement; score: number } | null = null;
  for (const el of candidates) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = c.x - ac.x;
    const dy = c.y - ac.y;
    const ahead = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    if (ahead <= 1) continue; // must really be in that direction
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = ahead + across * 2.2; // prefer elements lined up with the current one
    if (!best || score < best.score) best = { el, score };
  }
  return best?.el ?? null;
}

export function installSpatialNavigation(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const dir: Dir | null = e.key === "ArrowLeft" ? "left" : e.key === "ArrowRight" ? "right" : e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : null;
    const active = document.activeElement as HTMLElement | null;
    if (!dir) {
      if (e.key === "Enter" && active && active !== document.body && !(active instanceof HTMLInputElement && active.type === "text")) {
        if (active.matches("button, [role='tab'], [role='radio'], [role='switch'], a[href]")) return; // browsers already click these on Enter
        active.click();
      }
      return;
    }
    // Let text fields and sliders keep their own arrow-key behaviour, except Up/Down out of a text field.
    if (active instanceof HTMLInputElement && (active.type === "range" || (active.type !== "checkbox" && active.type !== "radio" && (dir === "left" || dir === "right")))) return;
    if (active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement) return;

    const all = [...scope().querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
    if (all.length === 0) return;
    const from = active && active !== document.body && all.includes(active) ? active : null;
    const next = from ? pickNext(from, dir, all) : all[0];
    if (next) {
      e.preventDefault();
      next.focus({ preventScroll: false });
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}

/** TV browsers/WebViews identify themselves; `?tv=1` forces it for testing on a desktop. */
export function detectTv(): boolean {
  const ua = navigator.userAgent;
  return /Android TV|AFTM|AFTT|AFTS|AFTB|BRAVIA|SmartTV|SMART-TV|Tizen|Web0S|webOS|HbbTV|CrKey|GoogleTV|Leanback/i.test(ua) || new URLSearchParams(location.search).get("tv") === "1";
}
