import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("PAGEERROR:", String(err)));

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const map = window.__map;
  const style = map.style;
  const sc = style?.sourceCaches?.["maptiler_planet"] ?? style?._sourceCaches?.["maptiler_planet"];
  const out = {
    styleLoaded: style?.loaded ? style.loaded() : "n/a",
    mapLoaded: map.loaded(),
    areTilesLoaded: map.areTilesLoaded ? map.areTilesLoaded() : "n/a",
    sourceCacheKeys: style?._sourceCaches ? Object.keys(style._sourceCaches) : (style?.sourceCaches ? Object.keys(style.sourceCaches) : "none"),
  };
  if (sc) {
    out.scLoaded = sc.loaded();
    out.scTileCount = sc._tiles ? Object.keys(sc._tiles).length : "n/a";
    out.scCoveringTiles = sc.getVisibleCoordinates ? sc.getVisibleCoordinates().length : "n/a";
  }
  return out;
});
console.log("INFO:", JSON.stringify(info, null, 2));
await browser.close();
