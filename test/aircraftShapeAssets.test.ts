import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const PUBLIC = path.join(process.cwd(), "public");
const SHAPES_DIR = path.join(PUBLIC, "aircraft-shapes");
const MODELS_DIR = path.join(PUBLIC, "aircraft-models");

const svgFiles = readdirSync(SHAPES_DIR).filter((f) => f.endsWith(".svg"));
const rootTag = (file: string) => /<svg\b[^>]*>/.exec(readFileSync(path.join(SHAPES_DIR, file), "utf8"))?.[0] ?? "";

test("every shipped aircraft shape is authored in-repo or generated from a model", () => {
  const unlicensed = svgFiles.filter((file) => {
    const tag = rootTag(file);
    return !/\sdata-author="[^"]+"/.test(tag) && !/\sdata-generated="true"/.test(tag);
  });
  assert.deepEqual(unlicensed, [], "shapes with neither data-author nor data-generated may be third-party");
});

test("every 3D model has a 2D shape", () => {
  const manifest: { type: string }[] = JSON.parse(readFileSync(path.join(MODELS_DIR, "manifest.json"), "utf8"));
  const missing = [...new Set(manifest.map((m) => m.type))].filter((type) => !svgFiles.includes(`${type}.svg`));
  assert.deepEqual(missing, []);
});

test("shape manifest lists exactly the shipped shapes", () => {
  const manifest: string[] = JSON.parse(readFileSync(path.join(SHAPES_DIR, "manifest.json"), "utf8"));
  assert.deepEqual([...manifest].sort(), svgFiles.map((f) => f.replace(/\.svg$/, "")).sort());
});

test("third-party silhouette sets and licenses are gone", () => {
  assert.equal(existsSync(path.join(PUBLIC, "aircraft-silhouettes")), false);
  assert.equal(existsSync(path.join(SHAPES_DIR, "LICENSE")), false);
});
