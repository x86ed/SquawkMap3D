import { chromium } from "playwright";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(3000);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/final-1-initial.png" });

// drag-rotate
await page.mouse.move(640, 400);
await page.mouse.down({ button: "right" });
await page.mouse.move(780, 250, { steps: 15 });
await page.mouse.up({ button: "right" });
await page.waitForTimeout(500);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/final-2-rotated.png" });

const themeButton = page.getByRole("button", { name: /mode/i }).first();
await themeButton.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/final-3-theme-toggled.png" });

const pilotButton = page.getByRole("button", { name: "Pilot mode" });
await pilotButton.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/final-4-pilot-on.png" });

await pilotButton.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "/Users/adamsiegel/Workspace/SquawkMap3D/final-5-pilot-off.png" });

console.log("PAGE ERRORS:", JSON.stringify(errors));
await browser.close();
