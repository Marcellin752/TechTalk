/**
 * Takes screenshots of the main screens into docs/screens/, in light and dark, so the design
 * can be seen (by people and by AI assistants) without running the app.
 *
 *   # the app must be running (npm run dev), with a signed-in-able account:
 *   SHOT_EMAIL=you@example.com SHOT_PASSWORD=... npm run design:screens --workspace=apps/frontend
 *
 * Needs Chrome: set CHROME_PATH if it is not /usr/bin/google-chrome. SHOT_URL defaults to http://localhost:5173.
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.SHOT_URL || "http://localhost:5173";
const out = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/screens");
const email = process.env.SHOT_EMAIL;
const password = process.env.SHOT_PASSWORD;
if (!email || !password) {
  console.error("Set SHOT_EMAIL and SHOT_PASSWORD.");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });

async function session(theme, viewport) {
  const ctx = await browser.newContext({ viewport, locale: "en-US", colorScheme: theme });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem("teachtalk_theme", t); localStorage.setItem("teachtalk_onboarding_skipped", "1"); } catch {}
  }, theme);
  return ctx;
}

async function signIn(page) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /Sign In →/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

const desktop = { width: 1360, height: 860 };
const phone = { width: 390, height: 844 };

// The login page is shown before signing in.
{
  const ctx = await session("light", desktop);
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, "login-light.png") });
  await ctx.close();
}

for (const theme of ["light", "dark"]) {
  const ctx = await session(theme, desktop);
  const page = await ctx.newPage();
  await signIn(page);
  const shots = [["home", "/"], ["path", "/path"], ["calendar", "/calendar"], ["campus", "/campus"], ["kairos", "/kairos"], ["design", "/design"]];
  if (theme === "light") shots.push(["admin", "/admin"]);
  for (const [name, path] of shots) {
    await page.goto(base + path);
    await page.waitForTimeout(1800);
    if (name === "kairos") {
      // Open the latest conversation so the chat is not empty.
      await page.locator("aside li button").first().click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    await page.screenshot({ path: join(out, `${name}-${theme}.png`) });
    console.log(`${name}-${theme}`);
  }
  await ctx.close();
}

{
  const ctx = await session("light", phone);
  const page = await ctx.newPage();
  await signIn(page);
  await page.goto(`${base}/calendar`);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(out, "calendar-phone.png") });
  console.log("calendar-phone");
  await ctx.close();
}

await browser.close();
