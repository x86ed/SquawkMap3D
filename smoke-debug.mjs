import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("requestfailed", (req) => {
  console.log("FAILED:", req.url(), req.failure()?.errorText);
});
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(6000);
await browser.close();
