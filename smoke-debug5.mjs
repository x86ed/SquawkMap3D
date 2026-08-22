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
  const styleKeys = Object.keys(style).filter((k) => /source/i.test(k));
  const src = map.getSource("maptiler_planet");
  const srcKeys = src ? Object.getOwnPropertyNames(Object.getPrototypeOf(src)).concat(Object.keys(src)) : [];
  return {
    styleKeys,
    srcExists: !!src,
    srcLoaded: src && src.loaded ? src.loaded() : "n/a",
    canvasSize: [map.getCanvas().width, map.getCanvas().height],
  };
});
console.log("INFO:", JSON.stringify(info, null, 2));
await browser.close();
