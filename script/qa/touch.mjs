// Interaction checks on a phone viewport: swipe pans, a swipe doesn't open a clue,
// tapping opens the clue card, dragging the card's header down closes it,
// "Look closer" outlines spots, edge arrow pans.
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:5090";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, userDataDir: "chrome-profile-i" });
const page = await browser.newPage();
await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem("cc_sterling_broadcast_heard", "1"); } catch {} });
const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${BASE}/#/bounty/neptune-deep`, { waitUntil: "networkidle0" });
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /take the job/i.test(b.textContent)).click());
await sleep(2500);
const scroll = () => page.evaluate(() => document.querySelector("[data-testid='scene-pen'] .scene-viewport").scrollLeft);
const s0 = await scroll();
// swipe left across the berth hotspot area
await page.touchscreen.touchStart(300, 450); for (let x = 300; x >= 120; x -= 20) { await page.touchscreen.touchMove(x, 452); await sleep(16); } await page.touchscreen.touchEnd();
await sleep(600);
const s1 = await scroll();
const sheetAfterSwipe = await page.$("[data-testid='panel-clue']");
// tap the berth hotspot
const box = await page.evaluate(() => { const r = document.querySelector("[data-testid='hotspot-clue-berth']").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.x > 0 && r.right < innerWidth }; });
await page.evaluate(() => document.querySelector("[data-testid='scene-pen'] .scene-viewport").scrollBy(-400, 0)); await sleep(300);
const box2 = await page.evaluate(() => { const r = document.querySelector("[data-testid='hotspot-clue-berth']").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.touchscreen.tap(Math.min(385, Math.max(8, box2.x)), box2.y);
await sleep(1200);
const sheetOpen = !!(await page.$("[data-testid='panel-clue']"));
// drag the card header down
const hdr = await page.evaluate(() => { const r = document.querySelector(".sheet-header").getBoundingClientRect(); return { x: r.x + 60, y: r.y + 20 }; });
await page.mouse.move(hdr.x, hdr.y); await page.mouse.down(); for (let d = 0; d <= 160; d += 20) { await page.mouse.move(hdr.x, hdr.y + d); await sleep(16); } await page.mouse.up();
await sleep(500);
const sheetClosed = !(await page.$("[data-testid='panel-clue']"));
// look closer
await page.evaluate(() => document.querySelector("[data-testid='button-look-closer']")?.click()); await sleep(300);
const looking = await page.evaluate(() => !!document.querySelector(".scene-canvas.is-looking"));
// edge arrow
const before = await scroll();
await page.evaluate(() => (document.querySelector("[data-testid='button-pan-right']") || document.querySelector("[data-testid='button-pan-left']"))?.click()); await sleep(900);
const after = await scroll();
console.log(JSON.stringify({ startScroll: s0, afterSwipe: s1, swipeMovedScene: s1 !== s0, clueOpenedBySwipe: !!sheetAfterSwipe, tapOpenedClue: sheetOpen, dragClosedCard: sheetClosed, lookCloserOutlines: looking, arrowPanned: after !== before, errors }, null, 1));
await browser.close();
