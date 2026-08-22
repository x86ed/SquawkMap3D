import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("request", (req) => {
  if (req.url().includes(".pbf")) {
    console.log("PBF REQUEST:", req.url().replace(/key=[^&]+/, "key=REDACTED"));
  }
});
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));

await page.goto("http://localhost:3000/standalone-test.html", { waitUntil: "load" });
await page.waitForTimeout(10000);
const loaded = await page.evaluate(() => window.__loaded);
console.log("loaded:", loaded);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/smoke-debug3.png" });
await browser.close();
