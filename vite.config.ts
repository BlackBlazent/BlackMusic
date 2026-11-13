import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// IMP-09: for Android/iOS builds (Tauri sets TAURI_ENV_PLATFORM), the yt-dlp runner is replaced by a stub at BUILD time, so the
// code never reaches the mobile bundle. Hiding a button is not enough for store review; the implementation itself is left out.
const mobileBuild = process.env.TAURI_ENV_PLATFORM === "android" || process.env.TAURI_ENV_PLATFORM === "ios";
const mobileStubs = {
  name: "blackmusic-mobile-stubs",
  enforce: "pre" as const,
  resolveId(source: string) {
    if (mobileBuild && source === "@/lib/tools/ytdlpRunner") return path.resolve(__dirname, "./src/lib/tools/ytdlpRunner.mobile.ts");
    return null;
  },
};

// BlackMusic renderer config.
// Tauri serves the app itself in dev, so we keep Vite's own server config
// aligned with what `tauri.conf.json` expects (fixed port, strict mode).
export default defineConfig({
  plugins: [mobileStubs, react()],
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  envPrefix: ["VITE_", "TAURI_"],

  build: {
    target:
      process.env.TAURI_ENV_PLATFORM === "windows"
        ? "chrome105"
        : "es2022",
    outDir: "dist",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});