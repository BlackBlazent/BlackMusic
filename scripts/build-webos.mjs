#!/usr/bin/env node
/**
 * FEAT-15 — LG webOS package. Tauri cannot target webOS (it needs a native binary); webOS runs a plain web app inside an `.ipk`.
 * This builds the Vite frontend, adds webos/appinfo.json + icons, and — if the LG `ares-package` CLI is installed — packages it.
 * Needs: `npm i -g @webos-tools/cli`. Not run or verified in the authoring environment.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("pnpm", ["build"]);
const out = join(process.cwd(), "dist-webos");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(process.cwd(), "dist"), out, { recursive: true });
copyFileSync(join(process.cwd(), "webos", "appinfo.json"), join(out, "appinfo.json"));
const icon = join(process.cwd(), "src-tauri", "icons", "128x128.png");
if (existsSync(icon)) { copyFileSync(icon, join(out, "icon.png")); copyFileSync(join(process.cwd(), "src-tauri", "icons", "icon.png"), join(out, "largeIcon.png")); }
const probe = spawnSync("ares-package", ["--version"], { shell: process.platform === "win32" });
if (probe.status !== 0) {
  console.log("dist-webos/ is ready. Install the LG CLI (npm i -g @webos-tools/cli), then run: ares-package dist-webos");
} else {
  run("ares-package", ["dist-webos", "-o", "dist-webos-ipk"]);
  console.log("webOS package written to dist-webos-ipk/. Install with: ares-install --device <tv> dist-webos-ipk/*.ipk");
}
