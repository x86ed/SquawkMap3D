#!/usr/bin/env node
// Copies the 4x3 SVG flag set from the `flag-icons` npm package into
// public/flags/, so airport popups can reference flags by a static URL
// (files under node_modules/ aren't served by Next.js). Re-run after
// bumping the `flag-icons` dependency.

import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "flag-icons",
  "flags",
  "4x3",
);
const OUTPUT_DIR = path.join(__dirname, "..", "public", "flags");

mkdirSync(OUTPUT_DIR, { recursive: true });

let count = 0;
for (const entry of readdirSync(SOURCE_DIR)) {
  if (!entry.endsWith(".svg")) continue;
  cpSync(path.join(SOURCE_DIR, entry), path.join(OUTPUT_DIR, entry));
  count++;
}

console.log(`Copied ${count} flag SVGs to ${OUTPUT_DIR}`);
