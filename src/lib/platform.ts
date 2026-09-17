/**
 * The renderer is written to run two ways:
 *  - inside the Tauri shell (production, `pnpm tauri:dev` / `pnpm tauri:build`)
 *  - in a plain browser tab (`pnpm dev`) for fast UI iteration on layout/CSS
 *
 * Anything that touches the filesystem, native menus, or the Tauri store must
 * check `isTauri()` first and fall back to a browser-safe equivalent.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
