import puppeteer from "puppeteer-core";
import fs from "fs";
fs.mkdirSync("shots", { recursive: true });
const BASE = process.env.BASE || "http://localhost:5090";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: "chrome-profile-p" });
const out = {};
// 1. establishing pan ends centred on the focus point
{
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
  await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("cc_sterling_broadcast_heard", "1"); } catch {} });
  const cdp = await page.createCDPSession(); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await page.goto(`${BASE}/#/voyages`, { waitUntil: "domcontentloaded" });
  const samples = [];
  for (let i = 0; i < 20; i++) { samples.push(await page.evaluate(() => { const v = document.querySelector(".scene-viewport"); return v ? Math.round(v.scrollLeft) : null; })); await sleep(200); }
  const final = await page.evaluate(() => { const v = document.querySelector(".scene-viewport"); const c = v.querySelector(".scene-canvas"); return { scroll: Math.round(v.scrollLeft), target: Math.round(0.5 * c.clientWidth - v.clientWidth / 2) }; });
  out.pan = { samples, ...final, endsOnTarget: Math.abs(final.scroll - final.target) <= 2 };
  await ctx.close();
}
// 2. phone on its side
{
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("cc_sterling_broadcast_heard", "1"); } catch {} });
  await page.goto(`${BASE}/#/bounty/neptune-deep`, { waitUntil: "networkidle0" });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /take the job/i.test(b.textContent)).click());
  await sleep(1800);
  out.landscape = await page.evaluate(() => { const r = document.querySelector("[data-testid='scene-pen'] .scene-canvas").getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), scrollW: document.documentElement.scrollWidth }; });
  await page.screenshot({ path: "shots/landscape-scene.png" });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
