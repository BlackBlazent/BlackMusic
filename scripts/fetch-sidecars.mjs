#!/usr/bin/env node
/**
 * BlackMusic 2.2.0 — prepares the bundled tools Tauri expects before `tauri dev` / `tauri build`:
 *
 *   src-tauri/binaries/yt-dlp-<target-triple>[.exe]        standalone (PyInstaller) yt-dlp, downloaded from its GitHub releases
 *   src-tauri/binaries/whisper-cli-<target-triple>[.exe]   whisper.cpp CLI — built from source by scripts/build-whisper.mjs
 *   src-tauri/binaries/open_explorer-<triple>              Windows-only helper; a no-op stand-in elsewhere
 *   src-tauri/resources/models/ggml-tiny.bin               the built-in whisper model (~75 MB)
 *
 * Usage:  node scripts/fetch-sidecars.mjs [--if-missing] [--target <triple>] [--all]
 *   --if-missing  skip anything that already exists (used by the tauri:dev / tauri:build scripts)
 *   --target      cross-target triple (defaults to the host)
 *   --all         fetch yt-dlp for Windows, Linux and both macOS triples (handy for committing release assets)
 *
 * Every download is optional: if it fails (offline machine) a tiny placeholder is written so the build still passes,
 * and Settings → Plugins & Tools shows the tool as "missing" with the option to import a binary.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, statSync, writeFileSync, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = join(root, "src-tauri", "binaries");
const models = join(root, "src-tauri", "resources", "models");
const args = process.argv.slice(2);
const ifMissing = args.includes("--if-missing");
const all = args.includes("--all");
const targetArg = args.includes("--target") ? args[args.indexOf("--target") + 1] : process.env.TAURI_TARGET || "";

const hostTriple = () => {
  const out = spawnSync("rustc", ["-vV"], { encoding: "utf8" }).stdout ?? "";
  return /host: (\S+)/.exec(out)?.[1] ?? "";
};
const target = targetArg || hostTriple();
if (!target) {
  console.warn("[sidecars] Could not detect the Rust target triple (is rustc installed?). Pass --target <triple>.");
  process.exit(0);
}

const isWin = (t) => t.includes("windows");
const ext = (t) => (isWin(t) ? ".exe" : "");
const STUB_BYTES = 2048; // anything smaller than this is a placeholder, not a real tool

mkdirSync(bin, { recursive: true });
mkdirSync(models, { recursive: true });

const real = (p) => existsSync(p) && statSync(p).size > STUB_BYTES;
const placeholder = (p, why) => {
  if (existsSync(p)) return;
  writeFileSync(p, isWin(p) ? "" : `#!/bin/sh\necho "${why}" >&2\nexit 1\n`);
  try { chmodSync(p, 0o755); } catch { /* windows */ }
  console.warn(`[sidecars] placeholder written: ${p} (${why})`);
};

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "BlackMusic-build" } });
  if (!res.ok || !res.body) throw new Error(`${url} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  try { chmodSync(dest, 0o755); } catch { /* windows */ }
}

const YTDLP = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const ytdlpAsset = (t) => (isWin(t) ? "yt-dlp.exe" : t.includes("apple") ? "yt-dlp_macos" : t.includes("aarch64") ? "yt-dlp_linux_aarch64" : "yt-dlp_linux");

async function ensureYtDlp(t) {
  const dest = join(bin, `yt-dlp-${t}${ext(t)}`);
  if (real(dest) && ifMissing) return;
  try {
    console.log(`[sidecars] yt-dlp for ${t} …`);
    await download(`${YTDLP}/${ytdlpAsset(t)}`, dest);
  } catch (e) {
    console.warn(`[sidecars] yt-dlp download failed: ${e.message}`);
    placeholder(dest, "yt-dlp is not bundled in this build — import it in Settings → Plugins & Tools");
  }
}

async function ensureModel() {
  const dest = join(models, "ggml-tiny.bin");
  if (real(dest)) return;
  try {
    console.log("[sidecars] whisper tiny model …");
    await download("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin", dest);
  } catch (e) {
    console.warn(`[sidecars] model download failed: ${e.message} — download ggml-tiny.bin manually or use Settings → Plugins & Tools → Import model.`);
  }
}

const targets = all ? ["x86_64-pc-windows-msvc", "x86_64-unknown-linux-gnu", "x86_64-apple-darwin", "aarch64-apple-darwin"] : [target];
for (const t of targets) await ensureYtDlp(t);

// whisper-cli: built from source (no portable prebuilt exists for every OS). Placeholder keeps the Tauri build green.
const whisper = join(bin, `whisper-cli-${target}${ext(target)}`);
if (!real(whisper)) {
  if (process.env.BUILD_WHISPER === "1") {
    spawnSync("node", [join(root, "scripts", "build-whisper.mjs"), "--target", target], { stdio: "inherit" });
  }
  placeholder(whisper, "whisper.cpp is not bundled — run `node scripts/build-whisper.mjs` or import whisper-cli in Settings → Plugins & Tools");
}

// 2.2.0 fix: the official whisper.cpp Windows zip is a SHARED build — whisper-cli.exe cannot start without
// whisper.dll / ggml*.dll, and Tauri only copies the sidecar .exe next to the app. src-tauri/tauri.windows.conf.json
// bundles these four DLLs into <resources>/whisper-libs and tools.rs puts that folder on the child's PATH.
// A static build (scripts/build-whisper.mjs) doesn't need them, so missing ones get empty placeholders (ignored at runtime)
// instead of breaking the bundle step.
if (isWin(target)) {
  for (const dll of ["whisper.dll", "ggml.dll", "ggml-base.dll", "ggml-cpu.dll"]) {
    const p = join(bin, dll);
    if (!existsSync(p)) {
      writeFileSync(p, "");
      console.warn(`[sidecars] ${dll} not found — placeholder written (fine for a static whisper-cli; copy the real DLLs here for a shared build).`);
    }
  }
}

// open_explorer: only used on Windows; every other triple just needs a file to exist.
const openExplorer = join(bin, `open_explorer-${target}${ext(target)}`);
if (!existsSync(openExplorer)) placeholder(openExplorer, "open_explorer is Windows-only");

await ensureModel();
console.log("[sidecars] done.");
