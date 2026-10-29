import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("site exposes the hide, seek, and grading flow", async () => {
  const html = await read("dist/index.html");
  for (const required of ["polli-connect", "secretInput", "generateButton", "seekButton", "scoreRing", "offlineSpecimen"]) {
    assert.match(html, new RegExp(required));
  }
});

test("app uses Pollinations text and multimodal calls", async () => {
  const js = await read("dist/app.js");
  assert.match(js, /gen\.pollinations\.ai\/v1\/chat\/completions/);
  assert.match(js, /anthropic\/claude-fable-5\.1/);
  assert.match(js, /openai\/gpt-5\.4-nano/);
  assert.match(js, /image_url/);
  assert.match(js, /svgToPngDataUrl/);
});

test("no long-lived secret or localStorage is committed", async () => {
  const files = await Promise.all([read("dist/index.html"), read("dist/app.js"), read("dist/config.js"), read("README.md")]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /sk_[A-Za-z0-9_-]{10,}/);
  assert.doesNotMatch(source, /localStorage/);
});

test("hosting manifest points at the static build", async () => {
  const hosting = JSON.parse(await read(".openai/hosting.json"));
  assert.equal(hosting.project_id, "appgprj_6ae2dc28dcf881918c29c268ad29afc9");
  assert.equal(hosting.static.directory, "dist");
});

