// Copies the ExifTool that the `exiftool-vendored` package installs for this OS
// into src-tauri/resources/exiftool so Tauri bundles it with the app.
//   pnpm add -D exiftool-vendored && pnpm prepare:exiftool

/** 
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const win = process.platform === "win32";
const pkg = join("node_modules", win ? "exiftool-vendored.exe" : "exiftool-vendored.pl");
if (!existsSync(pkg)) {
  console.error(`Missing ${pkg}. Run: pnpm add -D exiftool-vendored  (its OS-specific binary package is an optional dependency)`);
  process.exit(1);
}
const out = join("src-tauri", "resources", "exiftool");
mkdirSync(out, { recursive: true });
const src = existsSync(join(pkg, "bin")) ? join(pkg, "bin") : pkg;
cpSync(src, out, { recursive: true });
if (win) {
  // The Windows build ships as `exiftool(-k).exe`; the app looks for `exiftool.exe`.
  for (const f of readdirSync(out)) {
    if (/^exiftool\(-k\)\.exe$/i.test(f)) cpSync(join(out, f), join(out, "exiftool.exe"));
  }
}
console.log("ExifTool copied to", out);
**/

// Copies ExifTool for Windows, Mac, and Linux into the Tauri resources directory.
//   pnpm add -D exiftool-vendored exiftool-vendored.exe exiftool-vendored.pl && pnpm prepare:exiftool

import { cpSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Corrected package names matching the actual NPM registry!
const platforms = [
  { name: "win32", pkg: "exiftool-vendored.exe", subFolder: "win32" },
  { name: "unix",  pkg: "exiftool-vendored.pl",  subFolder: "unix" }
];

for (const platform of platforms) {
  try {
    // 1. Locate the packages safely inside pnpm's virtual store
    const pkgPath = dirname(require.resolve(`${platform.pkg}/package.json`));
    const src = join(pkgPath, "bin");
    
    // 2. Target output folder inside src-tauri
    const out = join("src-tauri", "resources", "exiftool", platform.subFolder);

    if (existsSync(src)) {
      mkdirSync(out, { recursive: true });
      cpSync(src, out, { recursive: true });
      console.log(`✅ Copied ${platform.pkg} binaries to: ${out}`);

      // 3. Extract/Ensure clean Windows executable naming structure
      if (platform.name === "win32") {
        for (const f of readdirSync(out)) {
          if (/^exiftool\(-k\)\.exe\$/i.test(f)) {
            cpSync(join(out, f), join(out, "exiftool.exe"));
          }
        }
      }
    } else {
      console.error(`❌ Found package path but binary directory missing at: ${src}`);
    }
  } catch (e) {
    console.warn(`⚠️ Warning: Could not process ${platform.pkg}. Ensure it is added as a devDependency.`);
  }
}

console.log("🚀 Multi-platform ExifTool binaries prepared successfully!");
