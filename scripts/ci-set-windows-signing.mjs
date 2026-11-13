#!/usr/bin/env node
/**
 * FIX-07 (3.0.0) — CI helper. Writes the Windows code-signing settings into src-tauri/tauri.conf.json for this CI run only.
 * Input (env): WINDOWS_CERTIFICATE_THUMBPRINT (required). Optional: WINDOWS_TIMESTAMP_URL.
 * This is OS code signing (SmartScreen / store trust). It is NOT the Tauri updater key (TAURI_SIGNING_PRIVATE_KEY).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const thumbprint = (process.env.WINDOWS_CERTIFICATE_THUMBPRINT || "").trim();
if (!thumbprint) {
  console.error("WINDOWS_CERTIFICATE_THUMBPRINT is empty — refusing to write a signing config.");
  process.exit(1);
}
const file = join(process.cwd(), "src-tauri", "tauri.conf.json");
const conf = JSON.parse(readFileSync(file, "utf8"));
conf.bundle ??= {};
conf.bundle.windows ??= {};
conf.bundle.windows.certificateThumbprint = thumbprint;
conf.bundle.windows.digestAlgorithm = "sha256";
conf.bundle.windows.timestampUrl = process.env.WINDOWS_TIMESTAMP_URL || "http://timestamp.digicert.com";
writeFileSync(file, JSON.stringify(conf, null, 2) + "\n");
console.log("Windows signing configured (thumbprint set, sha256, timestamped).");
