// FEAT-15 — lets the tvOS app import shared, framework-free logic from the main project's src/ without moving any file.
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, "node_modules"), path.resolve(workspaceRoot, "node_modules")],
    // `import { ... } from "main-src/lib/sync/transferPolicy"` — only import PURE TypeScript (no DOM, no Tauri, no React Router).
    extraNodeModules: { "main-src": path.resolve(workspaceRoot, "src") },
  },
});
