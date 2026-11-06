import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.TEND_URL ?? "http://127.0.0.1:5173/";
const OUT = process.env.TEND_SHOTS ?? join(process.cwd(), "docs", "shots");
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter((value) => Boolean(value));
const CHROME = CANDIDATES.find((value) => existsSync(value));
if (!CHROME) {
  throw new Error("Set CHROME_PATH to a Chrome or Chromium binary.");
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

const shot = async (name, selector) => {
  const path = join(OUT, `${name}.png`);
  if (selector) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.locator(selector).screenshot({ path });
  } else {
    await page.waitForTimeout(700);
    await page.screenshot({ path });
  }
  console.log(path);
};

const settle = async () => {
  await page.addStyleTag({
    content: ".masthead{position:static!important}.hero *{animation:none!important}",
  });
  await page.waitForTimeout(800);
};

await page.goto(URL, { waitUntil: "networkidle" });
await settle();
await shot("01-hero");
await shot("02-room", "#room");
await shot("03-room-full", "#room");
await shot("04-brief", "#brief-sheet");
await shot("10-switch-off", "#switch");
await page.getByRole("switch", { name: "Family room power" }).click();
await page.waitForTimeout(400);
await shot("11-switch-on", "#switch");

const peerReply = page.locator(".msg").filter({ has: page.locator(".payload__toggle") }).last();
await peerReply.locator(".payload__toggle").click();
await page.waitForTimeout(400);
await peerReply.screenshot({ path: join(OUT, "06-payload.png") });
console.log(join(OUT, "06-payload.png"));

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL, { waitUntil: "networkidle" });
await settle();
await shot("07-mobile-hero");
await shot("08-mobile-room", "#room");
await shot("09-mobile-brief", "#brief-sheet");

console.log(JSON.stringify({ title: await page.title(), errors }, null, 2));
await browser.close();
