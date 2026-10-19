#!/usr/bin/env node
/**
 * Builds whisper.cpp's `whisper-cli` as ONE static executable and installs it as the Tauri sidecar
 *   src-tauri/binaries/whisper-cli-<target-triple>[.exe]
 *
 * whisper.cpp publishes no portable prebuilt CLI for Linux/macOS (and the Windows zip ships loose DLLs, which a
 * single-file sidecar can't carry), so it is compiled statically here. Needs: git, cmake, a C/C++ toolchain.
 *
 *   node scripts/build-whisper.mjs [--target <triple>] [--tag v1.7.5]
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const get = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const tag = get("--tag", "v1.7.5");
const host = /host: (\S+)/.exec(spawnSync("rustc", ["-vV"], { encoding: "utf8" }).stdout ?? "")?.[1] ?? "";
const target = get("--target", host);
const win = target.includes("windows");
const work = join(root, ".cache", "whisper.cpp");

const run = (cmd, a, opts = {}) => {
  console.log(`> ${cmd} ${a.join(" ")}`);
  const r = spawnSync(cmd, a, { stdio: "inherit", shell: win, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
};

mkdirSync(join(root, ".cache"), { recursive: true });
if (!existsSync(work)) run("git", ["clone", "--depth", "1", "--branch", tag, "https://github.com/ggml-org/whisper.cpp", work]);

const cmakeArgs = ["-B", "build", "-DBUILD_SHARED_LIBS=OFF", "-DWHISPER_BUILD_EXAMPLES=ON", "-DWHISPER_BUILD_TESTS=OFF", "-DCMAKE_BUILD_TYPE=Release"];
if (target.includes("apple")) cmakeArgs.push(`-DCMAKE_OSX_ARCHITECTURES=${target.startsWith("aarch64") ? "arm64" : "x86_64"}`);
if (win) cmakeArgs.push("-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded");
run("cmake", cmakeArgs, { cwd: work });
run("cmake", ["--build", "build", "--config", "Release", "--target", "whisper-cli", "-j"], { cwd: work });

const candidates = [join(work, "build", "bin", "Release", "whisper-cli.exe"), join(work, "build", "bin", "whisper-cli.exe"), join(work, "build", "bin", "whisper-cli")];
const built = candidates.find(existsSync);
if (!built) throw new Error("whisper-cli was not produced — check the CMake output above.");
const dest = join(root, "src-tauri", "binaries", `whisper-cli-${target}${win ? ".exe" : ""}`);
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(built, dest);
try { chmodSync(dest, 0o755); } catch { /* windows */ }
console.log(`whisper-cli installed -> ${dest}`);
