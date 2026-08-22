import { chromium } from "playwright";

const browser = await chromium.launch();
const results = {};

async function withContext(opts, fn) {
  const context = await browser.newContext(opts);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await fn(page);
  await context.close();
  return consoleErrors;
}

// 1. Default (geolocation denied by default in headless / no permission granted)
let errors = await withContext({ viewport: { width: 1280, height: 800 } }, async (page) => {
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const canvas = await page.$("canvas.maplibregl-canvas");
  results.canvasPresent = !!canvas;
  const box = canvas ? await canvas.boundingBox() : null;
  results.canvasBox = box;
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-adamsiegel-Workspace-SquawkMap3D/7b277f16-d308-4969-a93f-09e304e63acd/scratchpad/screenshot-default.png" });

  // drag rotate: right-click-drag to check pitch/bearing change works (no crash)
  await page.mouse.move(640, 400);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(740, 300, { steps: 10 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(500);

  // theme toggle
  const themeButton = await page.getByRole("button", { name: /mode/i }).first();
  results.themeButtonText = await themeButton.textContent();
  await themeButton.click();
  await page.waitForTimeout(2000);
  results.themeButtonTextAfter = await themeButton.textContent();
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-adamsiegel-Workspace-SquawkMap3D/7b277f16-d308-4969-a93f-09e304e63acd/scratchpad/screenshot-theme-toggled.png" });

  // pilot mode toggle
  const pilotButton = await page.getByRole("button", { name: "Pilot mode" });
  await pilotButton.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-adamsiegel-Workspace-SquawkMap3D/7b277f16-d308-4969-a93f-09e304e63acd/scratchpad/screenshot-pilot-mode.png" });
  await pilotButton.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-adamsiegel-Workspace-SquawkMap3D/7b277f16-d308-4969-a93f-09e304e63acd/scratchpad/screenshot-pilot-mode-off.png" });
});
results.consoleErrorsDefault = errors;

browser2loop: {
  // dark color scheme
  errors = await withContext({ colorScheme: "dark" }, async (page) => {
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const themeButton = await page.getByRole("button", { name: /mode/i }).first();
    results.darkOsThemeButtonText = await themeButton.textContent();
    await page.screenshot({ path: "/private/tmp/claude-501/-Users-adamsiegel-Workspace-SquawkMap3D/7b277f16-d308-4969-a93f-09e304e63acd/scratchpad/screenshot-os-dark.png" });
  });
  results.consoleErrorsDark = errors;
}

// geolocation granted
errors = await withContext({ permissions: ["geolocation"], geolocation: { latitude: 40.7128, longitude: -74.006 } }, async (page) => {
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-adamsiegel-Workspace-SquawkMap3D/7b277f16-d308-4969-a93f-09e304e63acd/scratchpad/screenshot-geolocation.png" });
});
results.consoleErrorsGeo = errors;

console.log(JSON.stringify(results, null, 2));
await browser.close();
