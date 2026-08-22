import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("request", (req) => {
  if (req.url().includes("/data/")) {
    console.log("MAIN REQ:", req.url());
  }
});
page.on("response", async (res) => {
  if (res.url().includes("/data/")) {
    console.log("MAIN RES:", res.status(), res.url());
  }
});
page.on("console", (msg) => {
  if (/fail|error/i.test(msg.text())) console.log("CONSOLE:", msg.type(), msg.text());
});

let workerRequestUrls = [];
page.on("worker", (worker) => {
  console.log("WORKER SPAWNED");
});

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(8000);

const geo = await page.evaluate(() => {
  const map = window.__map;
  const airports = map.getSource("airports");
  const bases = map.getSource("military-bases");
  return {
    airportsLoaded: airports && airports.loaded ? airports.loaded() : "n/a",
    basesLoaded: bases && bases.loaded ? bases.loaded() : "n/a",
    airportsFeatureCountRendered: map.queryRenderedFeatures({ layers: ["airports-circle"] }).length,
  };
});
console.log("GEO:", JSON.stringify(geo));
await browser.close();
