import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("requestfailed", (req) => {
  console.log("FAILED:", req.url(), req.failure()?.errorText);
});
page.on("response", (res) => {
  if (res.url().includes("maptiler") || res.url().includes("chartbundle")) {
    console.log("RESPONSE:", res.status(), res.url());
  }
});
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(8000);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/smoke-debug.png" });
const info = await page.evaluate(() => {
  const map = window.__map;
  if (!map) return "no __map";
  return {
    layers: map.getStyle().layers.map((l) => l.id),
    loaded: map.loaded(),
    center: map.getCenter(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    sources: Object.keys(map.getStyle().sources),
    terrain: map.getTerrain(),
  };
});
console.log("INFO:", JSON.stringify(info, null, 2));
await browser.close();
