// Phone-emulation QA rig for Cosmic Conquest.
// Usage: BASE=http://localhost:5090 OUT=shots/before node screens.mjs [shots|film|pages|all]
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE || "http://localhost:5090";
const OUT = process.env.OUT || "shots/run";
const MODE = process.argv[2] || "all";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
fs.mkdirSync(OUT, { recursive: true });

const PHONE = {
  viewport: { width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};
const DESKTOP = { viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, ua: undefined };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, { cookie, method = "GET", body } = {}) {
  const res = await fetch(BASE + pathname, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  return { res, cookie: set ? set.split(";")[0] : cookie, json: await res.json().catch(() => null) };
}

// A hunter who has found every Neptune clue and named Coralie (so the briefing
// offers "Back to the showdown").
async function solvedHunter() {
  let { cookie } = await api("/api/player");
  for (const c of ["berth", "chamber", "sonar", "beacon", "stage-door"]) {
    await api(`/api/bounties/neptune-deep/clues/${c}/search`, { cookie, method: "POST", body: {} });
  }
  await api("/api/bounties/neptune-deep/clues/chart/unlock", { cookie, method: "POST", body: { code: "C3" } });
  await api("/api/bounties/neptune-deep/accuse", { cookie, method: "POST", body: { suspect: "coralie" } });
  return cookie;
}

async function openPage(browser, device, cookie) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(device.viewport);
  if (device.ua) await page.setUserAgent(device.ua);
  // Skip the first-visit broadcast so scenes are visible
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem("cc_sterling_broadcast_heard", "1"); } catch {}
  });
  if (cookie) {
    const [name, value] = cookie.split("=");
    await page.setCookie({ name, value, url: BASE });
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { ctx, page, errors };
}

async function clickText(page, re) {
  const ok = await page.evaluate((src) => {
    const r = new RegExp(src, "i");
    const b = [...document.querySelectorAll("button, a")].find((x) => r.test(x.textContent || "") || r.test(x.getAttribute("aria-label") || ""));
    if (b) b.click();
    return !!b;
  }, re.source);
  if (!ok) throw new Error("no button matching " + re);
}

async function metrics(page) {
  return page.evaluate(() => {
    const scene = document.querySelector("[data-testid^='scene-']");
    const r = scene?.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      docScrollWidth: document.documentElement.scrollWidth,
      sceneBox: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null,
      sceneShareOfScreen: r ? +((Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.min(r.width, innerWidth) / (innerWidth * innerHeight)).toFixed(2) : null,
      hotspots: [...document.querySelectorAll(".hotspot")].map((h) => {
        const b = h.getBoundingClientRect();
        return { label: h.getAttribute("aria-label"), w: Math.round(b.width), h: Math.round(b.height) };
      }),
    };
  });
}

async function shots(browser) {
  const report = {};
  const solved = await solvedHunter();
  for (const [name, device] of [["phone", PHONE], ["desktop", DESKTOP]]) {
    const snap = async (page, label) => {
      await page.screenshot({ path: path.join(OUT, `${name}-${label}.png`) });
      report[`${name}-${label}`] = await metrics(page);
    };
    const { ctx, page, errors } = await openPage(browser, device);
    await page.goto(`${BASE}/#/bounties`, { waitUntil: "networkidle0" });
    await sleep(600);
    await snap(page, "01-office");
    await page.goto(`${BASE}/#/bounty/neptune-deep`, { waitUntil: "networkidle0" });
    await sleep(500);
    await snap(page, "02-briefing");
    await clickText(page, /take the job/);
    await sleep(1500);
    await snap(page, "03-scene-pen");
    await page.evaluate(() => document.querySelector("[data-testid='hotspot-clue-berth']")?.click());
    await sleep(1500);
    await snap(page, "04-clue-open");
    await clickText(page, /glass promenade/);
    await sleep(1500);
    await snap(page, "05-scene-promenade");
    report[`${name}-errors`] = errors;
    await ctx.close();

    const s = await openPage(browser, device, solved);
    await s.page.goto(`${BASE}/#/bounty/neptune-deep`, { waitUntil: "networkidle0" });
    await sleep(500);
    await clickText(s.page, /take the job/);
    await sleep(1200);
    await clickText(s.page, /name your suspect/);
    await sleep(1200);
    await snap(s.page, "06-accuse");
    await s.page.goto(`${BASE}/#/bounties`, { waitUntil: "networkidle0" });
    await s.page.goto(`${BASE}/#/bounty/neptune-deep`, { waitUntil: "networkidle0" });
    await sleep(500);
    await clickText(s.page, /back to the showdown/);
    await sleep(1500);
    await snap(s.page, "07-showdown");
    report[`${name}-solved-errors`] = s.errors;
    await s.ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 1).slice(0, 4000));
}

// Loading filmstrip on a throttled phone connection, cold cache.
async function film(browser) {
  const { ctx, page } = await openPage(browser, PHONE);
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  // Roughly a mediocre 4G/3G cell connection: 1.6 Mbps down, 150 ms RTT
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200_000, uploadThroughput: 90_000 });
  const frames = [];
  const t0 = Date.now();
  await page.goto(`${BASE}/#/bounty/neptune-deep`, { waitUntil: "domcontentloaded" });
  // Take the job as soon as the button exists, then film the scene arriving
  for (let i = 0; i < 80; i++) {
    const has = await page.evaluate(() => !![...document.querySelectorAll("button")].find((b) => /take the job/i.test(b.textContent || "")));
    if (has) break;
    await sleep(100);
  }
  const tJob = Date.now() - t0;
  await clickText(page, /take the job/);
  const tClick = Date.now();
  for (let i = 0; i < 24; i++) {
    const f = path.join(OUT, `film-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: f });
    frames.push({ f, ms: Date.now() - tClick });
    await sleep(250);
  }
  fs.writeFileSync(path.join(OUT, "film.json"), JSON.stringify({ tJobButtonMs: tJob, frames }, null, 2));
  console.log("film frames:", frames.length, "job button after", tJob, "ms");
  await ctx.close();
}


// Every other screen that shows a scene, plus the "Look closer" state.
async function pages(browser) {
  const report = {};
  // An invited hunter for Aurelia: three claims written straight into the test database
  let { cookie } = await api("/api/player");
  await api("/api/player", { cookie, method: "PATCH", body: { callsign: "QA Hunter" } });
  const vid = cookie.split("=")[1];
  const { execSync } = await import("child_process");
  const db = process.env.QA_DB;
  if (db) {
    for (const b of ["heart-of-luna", "red-sands", "venus-fog"]) {
      execSync(`sqlite3 "${db}" "INSERT OR IGNORE INTO bounty_claims (visitor_id, bounty_id, reward, created_at) VALUES ('${vid}', '${b}', 500, '2026-09-30T00:00:00Z');"`);
    }
  }
  for (const [name, device] of [["phone", PHONE], ["desktop", DESKTOP]]) {
    const { ctx, page, errors } = await openPage(browser, device, cookie);
    const snap = async (label) => {
      await page.screenshot({ path: path.join(OUT, `${name}-p-${label}.png`) });
      report[`${name}-${label}`] = await metrics(page);
    };
    for (const [label, hash, wait] of [["hub", "/", 1500], ["voyages", "/voyages", 1500], ["expo", "/expo", 1500], ["diner", "/diner", 1500], ["office", "/bounties", 1500], ["aurelia", "/aurelia", 2500]]) {
      await page.goto(`${BASE}/#${hash}`, { waitUntil: "networkidle0" });
      await sleep(wait);
      await snap(label);
    }
    // Aurelia: open a spot (sheet), then "Look closer"
    await page.evaluate(() => document.querySelector("[data-testid^='hotspot-aurelia-']")?.click());
    await sleep(900);
    await snap("aurelia-sheet");
    await page.evaluate(() => document.querySelector("[data-testid='button-close-sheet']")?.click());
    await page.evaluate(() => document.querySelector("[data-testid='button-look-closer']")?.click());
    await sleep(500);
    await snap("aurelia-look-closer");
    report[`${name}-errors`] = errors;
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "pages.json"), JSON.stringify(report, null, 2));
  for (const [k, v] of Object.entries(report)) {
    if (k.endsWith("errors")) console.log(k, v.slice(0, 3));
    else console.log(k, "scene", v.sceneBox, "share", v.sceneShareOfScreen, "scrollW", v.docScrollWidth);
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: path.resolve("chrome-profile"),
  args: ["--no-first-run", "--no-default-browser-check", "--disable-gpu-sandbox"],
});
try {
  if (MODE === "shots" || MODE === "all") await shots(browser);
  if (MODE === "film" || MODE === "all") await film(browser);
  if (MODE === "pages" || MODE === "all") await pages(browser);
} finally {
  await browser.close();
}
