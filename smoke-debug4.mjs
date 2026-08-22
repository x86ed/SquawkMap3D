import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("worker") || url.includes(".pbf") || req.resourceType() === "other") {
    console.log("REQ:", req.resourceType(), url.replace(/key=[^&]+/, "key=REDACTED"));
  }
});
page.on("requestfailed", (req) => {
  console.log("REQFAILED:", req.url(), req.failure()?.errorText);
});
page.on("console", (msg) => console.log("CONSOLE:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("PAGEERROR:", String(err)));
page.on("worker", (worker) => console.log("WORKER CREATED:", worker.url()));

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(8000);

const workers = await page.evaluate(() => {
  return {
    hasWorker: typeof Worker !== "undefined",
    hasWebGL2: !!document.createElement("canvas").getContext("webgl2"),
  };
});
console.log("ENV:", JSON.stringify(workers));
await browser.close();
