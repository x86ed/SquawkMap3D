import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("request", (req) => {
  if (req.url().includes(".pbf") || req.url().includes("maptiler_planet") || req.url().includes("v3/")) {
    console.log("REQUEST:", req.url().replace(/key=[^&]+/, "key=REDACTED"));
  }
});
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(3000);

// Direct test: create a bare maplibre map with no pitch/terrain and see if vector tiles load
await page.evaluate(async () => {
  const MapCtor = window.__map.constructor;
  const key = "9Vbc2rOrF2JVY7XSkyBH";
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;top:0;left:0;width:800px;height:600px;z-index:9999;";
  div.id = "test-map";
  document.body.appendChild(div);
  const map = new MapCtor({
    container: div,
    style: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${key}`,
    center: [-98.5795, 39.8283],
    zoom: 4,
  });
  window.__testMap = map;
  await new Promise((resolve) => map.on("load", resolve));
});
await page.waitForTimeout(6000);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/smoke-debug2.png" });
const loaded = await page.evaluate(() => window.__testMap.loaded());
console.log("test map loaded:", loaded);
await browser.close();
