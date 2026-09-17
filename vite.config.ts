import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// BlackMusic renderer config.
// Tauri serves the app itself in dev, so we keep Vite's own server config
// aligned with what `tauri.conf.json` expects (fixed port, strict mode).
export default defineConfig({
  plugins: [react()],
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