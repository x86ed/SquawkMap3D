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
await page.waitForTimeout(6000);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/smoke-debug.png" });
const html = await page.evaluate(() => document.body.innerHTML.slice(0, 3000));
console.log(html);
const layers = await page.evaluate(() => {
  const map = window.__map;
  return map ? map.getStyle().layers.map((l) => l.id) : "no __map";
});
console.log("LAYERS:", layers);
await browser.close();
