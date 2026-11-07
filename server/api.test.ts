import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

const dbDir = mkdtempSync(path.join(tmpdir(), "cosmic-conquest-test-"));
process.env.DATABASE_PATH = path.join(dbDir, "test.db");
process.env.AUDIO_DIR = path.join(dbDir, "voice");
for (const f of ["briefing/red-sands/line.mp3", "testimony/saturn-orrery/tuttle--night.mp3", "clue/red-sands/telegram.mp3", "taunt/red-sands/line.mp3", "aurora/broadcast/line.mp3", "aurelia/tower/lilies.mp3", "testimony/saturn-orrery/ashgrove--money.mp3", "breakthrough/saturn-orrery/breakthrough-1.mp3"]) {
  mkdirSync(path.dirname(path.join(dbDir, "voice", f)), { recursive: true });
  writeFileSync(path.join(dbDir, "voice", f), "fake mp3");
}
process.env.SHOWDOWN_MIN_MS = "800"; // shorter than the real 1.5 s, long enough to test reliably

let server: Server;
let base: string;
let resetLimits: () => void;

before(async () => {
  // Import after DATABASE_PATH is set so storage opens the temp database.
  const { registerRoutes } = await import("./routes.js");
  const app = express();
  app.use(express.json());
  server = createServer(app);
  registerRoutes(app);
  // The suite plays many more bounties than one visitor would in 15 minutes.
  const { gameLimiter, clueLimiter } = await import("./middleware.js");
  resetLimits = () => {
    for (const limiter of [gameLimiter, clueLimiter]) limiter.resetKey("127.0.0.1");
  };
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => resetLimits?.());

after(async () => {
  server.close();
  // Windows will not delete a database file that is still open.
  (await import("./storage.js")).closeDb();
  await rm(dbDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function post(url: string, body: unknown, cookie?: string) {
  return fetch(base + url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const visitorOf = (cookie: string) => cookie.split("=")[1];

// Contracts open in order: mark every earlier contract as collected (no reward, so
// credit checks stay about the bounty under test).
async function unlock(bountyId: string, cookie: string) {
  const { bountyById } = await import("../shared/game.js");
  const { claimBounty } = await import("./gameStorage.js");
  for (const id of bountyById(bountyId)?.requires ?? []) {
    await unlock(id, cookie);
    await claimBounty(visitorOf(cookie), id, 0);
  }
}

// Play a bounty the honest way: search every spot, decode coded clues, name the suspect.
async function investigate(bountyId: string, cookie: string) {
  await unlock(bountyId, cookie);
  const { CLUES } = await import("./bounties.js");
  const clues = Object.entries(CLUES[bountyId]);
  for (const [clueId] of clues) await post(`/api/bounties/${bountyId}/clues/${clueId}/search`, {}, cookie);
  // Puzzles last, once everything they depend on is found
  for (const [clueId, clue] of clues) {
    const url = `/api/bounties/${bountyId}/clues/${clueId}`;
    const res = clue.key !== undefined ? await post(`${url}/decode`, { key: clue.key }, cookie)
      : clue.code !== undefined ? await post(`${url}/unlock`, { code: clue.code }, cookie)
      : null;
    if (res) assert.equal((await res.json()).correct, true, `${bountyId}/${clueId}`);
  }
  // Catch every lie with the first clue that exposes it
  const { TESTIMONY } = await import("./bounties.js");
  for (const [suspect, topics] of Object.entries(TESTIMONY[bountyId] ?? {})) {
    for (const [topic, said] of Object.entries(topics)) {
      if (!said.breakthrough) continue;
      const res = await post(`/api/bounties/${bountyId}/suspects/${suspect}/ask/${topic}/present`, { clue: said.caughtBy![0] }, cookie);
      assert.equal((await res.json()).correct, true, `${bountyId}/${suspect}/${topic}`);
    }
  }
}

// The first piece of evidence that proves the case (server-only answer key).
async function proofFor(bountyId: string): Promise<string> {
  const { BOUNTY_SOLUTIONS } = await import("./bounties.js");
  return BOUNTY_SOLUTIONS[bountyId].proof[0];
}

async function solve(bountyId: string, suspect: string, cookie: string) {
  await investigate(bountyId, cookie);
  await post(`/api/bounties/${bountyId}/accuse`, { suspect, proof: await proofFor(bountyId) }, cookie);
  await wait(850); // the showdown
  return post(`/api/bounties/${bountyId}/claim`, { suspect }, cookie);
}

function cookieOf(res: Response): string {
  const raw = res.headers.get("set-cookie");
  assert.ok(raw, "expected a visitor cookie");
  return raw.split(";")[0];
}

test("server sets createdAt and ignores client-supplied value", async () => {
  const res = await post("/api/postcards", {
    visitorName: "Tester",
    destination: "Mars",
    message: "Hello",
    createdAt: "1970-01-01T00:00:00.000Z",
  });
  assert.equal(res.status, 201);
  const card = await res.json();
  assert.notEqual(card.createdAt, "1970-01-01T00:00:00.000Z");
  assert.ok(Date.now() - Date.parse(card.createdAt) < 60_000);
});

test("visitor log never exposes visitor IDs (they are vote cookies)", async () => {
  const res = await post("/api/visitors", {
    visitorId: "spoofed",
    visitorName: "Explorer #1234",
    world: "Astro Diner",
    action: "arrived at",
  });
  assert.equal(res.status, 201);
  assert.equal("visitorId" in (await res.json()), false);

  const list = await (await fetch(base + "/api/visitors")).json();
  assert.ok(list.length > 0);
  for (const row of list) assert.equal("visitorId" in row, false);
});

test("one vote per visitor cookie; body visitorId is ignored", async () => {
  const created = await post("/api/predictions", { visitorName: "T", prediction: "Jetpacks" });
  const { id } = await created.json();

  const first = await post(`/api/predictions/${id}/vote`, {});
  assert.equal(first.status, 200);
  assert.equal((await first.json()).votes, 1);
  const cookie = cookieOf(first);

  const again = await post(`/api/predictions/${id}/vote`, { visitorId: "someone-else" }, cookie);
  assert.equal(again.status, 409);

  const other = await post(`/api/predictions/${id}/vote`, {});
  assert.equal(other.status, 200);
  assert.equal((await other.json()).votes, 2);
});

test("voting on a missing item is 404; malformed id is 400", async () => {
  assert.equal((await post("/api/menu-items/999999/vote", {})).status, 404);
  assert.equal((await post("/api/menu-items/12abc/vote", {})).status, 400);
});

test("rejects over-length input", async () => {
  const res = await post("/api/menu-items", {
    visitorName: "T",
    dishName: "x".repeat(101),
    description: "d",
  });
  assert.equal(res.status, 400);
});

test("a malformed visitor cookie is replaced, not a 500", async () => {
  const res = await fetch(base + "/api/postcards", { headers: { Cookie: "rf_vid=%E0%A4%A" } });
  assert.equal(res.status, 200);
  assert.match(cookieOf(res), /^rf_vid=[0-9a-f-]{36}$/);
});

function send(method: string, url: string, body: unknown, cookie?: string) {
  return fetch(base + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

test("game: full bounty loop — accuse, claim once, buy, equip, leaderboard", async () => {
  // A new visitor gets a default profile without creating anything
  const start = await fetch(base + "/api/player");
  const cookie = cookieOf(start);
  const fresh = await start.json();
  assert.equal(fresh.credits, 0);
  assert.equal(fresh.suit, "silver");
  assert.equal("visitorId" in fresh, false);

  // Can't accuse before finding clues, or collect before accusing
  assert.equal((await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie", proof: "dome" }, cookie)).status, 409);
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie)).status, 409);
  await investigate("heart-of-luna", cookie);

  // Wrong and right accusations
  const wrong = await post("/api/bounties/heart-of-luna/accuse", { suspect: "vela", proof: "dome" }, cookie);
  assert.deepEqual(await wrong.json(), { correct: false });
  const right = await (await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie", proof: "dome" }, cookie)).json();
  assert.equal(right.correct, true);
  assert.match(right.showdown.opponent, /Cookie/); // revealed only after a correct accusation

  // Claims: wrong suspect refused, right one paid exactly once
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "gearhart" }, cookie)).status, 422);
  // Too soon after naming him: the showdown can't be over yet
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie)).status, 409);
  await wait(850);
  const paid = await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie);
  assert.equal(paid.status, 200);
  const afterClaim = await paid.json();
  assert.equal(afterClaim.credits, 500);
  assert.deepEqual(afterClaim.completedBounties, ["heart-of-luna"]);
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie)).status, 409);

  // Unavailable / unknown bounties
  assert.equal((await post("/api/bounties/nope/claim", { suspect: "x" }, cookie)).status, 404);
  assert.equal((await post("/api/bounties/nope/accuse", { suspect: "x", proof: "y" }, cookie)).status, 404);

  // The name shown before the first action is the one that got saved
  assert.equal(afterClaim.callsign, fresh.callsign);
  assert.match(fresh.callsign, /^Hunter #\d{4}$/);

  // Empty updates are rejected (and don't create anything)
  assert.equal((await send("PATCH", "/api/player", {}, cookie)).status, 400);

  // Can't wear a suit you don't own
  assert.equal((await send("PATCH", "/api/player", { suit: "gold" }, cookie)).status, 403);

  // Shop: buy, can't double-buy; unknown items can't be bought
  const gun = await post("/api/shop/raygun/buy", {}, cookie);
  assert.equal(gun.status, 200);
  assert.equal((await gun.json()).credits, 200);
  assert.equal((await post("/api/shop/raygun/buy", {}, cookie)).status, 409);
  assert.equal((await post("/api/shop/moon-boots/buy", {}, cookie)).status, 404);

  // Suits: buying one puts it on; can't afford the gold one after that
  const red = await (await post("/api/shop/suit-red/buy", {}, cookie)).json();
  assert.equal(red.credits, 50);
  assert.equal(red.suit, "red");
  assert.equal((await post("/api/shop/suit-gold/buy", {}, cookie)).status, 402);

  // Switch between owned suits
  assert.equal((await (await send("PATCH", "/api/player", { suit: "silver" }, cookie)).json()).suit, "silver");
  assert.equal((await (await send("PATCH", "/api/player", { suit: "red" }, cookie)).json()).suit, "red");

  // Can't afford anything with no credits
  const broke = cookieOf(await fetch(base + "/api/player"));
  assert.equal((await post("/api/shop/raygun/buy", {}, broke)).status, 402);

  // Callsign + the free suit
  const renamed = await send("PATCH", "/api/player", { callsign: "  Spike  ", suit: "silver" }, cookie);
  const renamedProfile = await renamed.json();
  assert.equal(renamedProfile.callsign, "Spike");
  assert.equal(renamedProfile.suit, "silver");
  assert.equal((await send("PATCH", "/api/player", { callsign: "x".repeat(25) }, cookie)).status, 400);

  // Leaderboard shows the hunter, never their visitor id
  const board = await (await fetch(base + "/api/leaderboard")).json();
  const entry = board.find((e: { callsign: string }) => e.callsign === "Spike");
  // (one wrong accusation before collecting: no Clean Case)
  assert.deepEqual(entry, { callsign: "Spike", earned: 500, bounties: 1, cleanCount: 0, starred: false });
});

test("game: a buying spree never spends more than the balance", async () => {
  const start = await fetch(base + "/api/player");
  const cookie = cookieOf(start);
  await solve("heart-of-luna", "cookie", cookie); // 500 credits
  const results = await Promise.all([1, 2, 3].map(() => post("/api/shop/raygun/buy", {}, cookie)));
  const profile = await (await fetch(base + "/api/player", { headers: { Cookie: cookie } })).json();
  assert.equal(results.filter((r) => r.status === 200).length, 1); // bought once
  assert.equal(profile.credits, 200);
  assert.deepEqual(profile.owned, ["raygun"]);
});

test("game: the culprit is not in the shared (browser) bounty data", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const shipped = JSON.stringify(BOUNTIES);
  assert.equal(/spatula blaster|lock-up|never take me alive|stamp-blaster|properly filed|Nobody catches|Venus lock-up|understand them|Titan lock-up|dives deepest|harpoon|coralie-showdown/.test(shipped), false);
});

test("game: star map counts hunters per fragment, once each", async () => {
  const lunar = (m: { fragments: { id: string; hunters: number }[] }) =>
    m.fragments.find((f) => f.id === "lunar-quadrant")!.hunters;
  const before = await (await fetch(base + "/api/star-map")).json();
  assert.equal(before.total, 12);

  const cookie = cookieOf(await fetch(base + "/api/player"));
  await solve("heart-of-luna", "cookie", cookie);
  await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie); // 409, not counted twice

  const after = await (await fetch(base + "/api/star-map")).json();
  assert.equal(lunar(after), lunar(before) + 1);
  assert.equal(after.searchers, before.searchers + 1);
  assert.deepEqual(Object.keys(after).sort(), ["fragments", "searchers", "total"]);
});

test("game: star map fragments have unique ids and numbers within the map", async () => {
  const { MAP_FRAGMENTS, STAR_MAP_SIZE } = await import("../shared/game.js");
  const numbers = MAP_FRAGMENTS.map((f) => f.number);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.equal(new Set(MAP_FRAGMENTS.map((f) => f.id)).size, MAP_FRAGMENTS.length);
  for (const n of numbers) assert.ok(Number.isInteger(n) && n >= 1 && n <= STAR_MAP_SIZE);
});

test("game: Mars bounty pays 800 to the right suspect and turns up fragment II", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  await investigate("red-sands", cookie);
  assert.deepEqual(await (await post("/api/bounties/red-sands/accuse", { suspect: "venn", proof: "crates" }, cookie)).json(), { correct: false });
  // (clues first, then the accusations)
  const right = await (await post("/api/bounties/red-sands/accuse", { suspect: "quill", proof: "telegram" }, cookie)).json();
  assert.equal(right.showdown.scene, "./game/showdown-street-mars.webp");
  const resumed = await (await fetch(base + "/api/bounties/red-sands/progress", { headers: { Cookie: cookie } })).json();
  assert.equal(resumed.accused.suspect, "quill"); // lets a refresh go back to the duel
  await wait(850);
  const paid = await (await post("/api/bounties/red-sands/claim", { suspect: "quill" }, cookie)).json();
  assert.equal(paid.credits, 800);
  const map = await (await fetch(base + "/api/star-map")).json();
  assert.ok(map.fragments.find((f: { id: string; hunters: number }) => f.id === "martian-quadrant").hunters >= 1);
});

test("game: clues come from the server; the ring comes from searching; the telegram needs the right key", async () => {
  const { shiftLetters } = await import("../shared/game.js");
  const start = await fetch(base + "/api/player");
  const cookie = cookieOf(start);
  assert.deepEqual((await start.json()).items, []);
  await unlock("red-sands", cookie);
  const decode = (key: number) => post("/api/bounties/red-sands/clues/telegram/decode", { key }, cookie);

  // No ring yet: can't decode, and searching the telegram only shows the code
  assert.equal((await decode(2)).status, 403);
  const coded = await (await post("/api/bounties/red-sands/clues/telegram/search", {}, cookie)).json();
  assert.ok(coded.coded && coded.text === undefined);
  assert.match(shiftLetters(coded.coded, -2), /CANNED SUNSHINE/);

  // Searching Sprinkles hands over the ring (once)
  const sprinkles = await (await post("/api/bounties/red-sands/clues/sprinkles/search", {}, cookie)).json();
  assert.match(sprinkles.text, /decoder ring/);
  await post("/api/bounties/red-sands/clues/sprinkles/search", {}, cookie);
  assert.deepEqual((await (await fetch(base + "/api/player", { headers: { Cookie: cookie } })).json()).items, ["decoder-ring"]);

  // Wrong key, then the right one
  assert.deepEqual(await (await decode(3)).json(), { correct: false });
  const right = await (await decode(2)).json();
  assert.equal(right.correct, true);
  assert.match(right.text, /CANNED SUNSHINE/);

  // Progress survives a refresh
  const progress = await (await fetch(base + "/api/bounties/red-sands/progress", { headers: { Cookie: cookie } })).json();
  assert.deepEqual(Object.keys(progress.found).sort(), ["sprinkles", "telegram"]);
  assert.equal(progress.accused, undefined);

  // Unknown spots and bounties
  assert.equal((await post("/api/bounties/red-sands/clues/nope/search", {}, cookie)).status, 404);
  assert.equal((await post("/api/bounties/nope/clues/pad/search", {}, cookie)).status, 404);
});

test("game: no clue text or puzzle answer ships to the browser", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const { CLUES } = await import("./bounties.js");
  const shipped = JSON.stringify(BOUNTIES);
  for (const clues of Object.values(CLUES)) {
    for (const { text } of Object.values(clues)) assert.equal(shipped.includes(text), false, text.slice(0, 40));
  }
  const { TESTIMONY } = await import("./bounties.js");
  for (const suspects of Object.values(TESTIMONY)) {
    for (const topics of Object.values(suspects)) {
      for (const said of Object.values(topics)) {
        assert.equal(shipped.includes(said.text), false, said.text.slice(0, 40));
        if (said.breakthrough) assert.equal(shipped.includes(said.breakthrough.text), false);
      }
    }
  }
  assert.equal(/caughtBy/.test(shipped), false);
  assert.equal(/"key"|"code"|"needs"/.test(shipped), false);
  const { shiftLetters } = await import("../shared/game.js");
  const tele = CLUES["red-sands"].telegram;
  assert.equal(shipped.includes(shiftLetters(tele.text, tele.key!).slice(0, 20)), false, "coded text ships");
});

test("game: every hotspot has server clue text, and coded clues have a key", async () => {
  const { BOUNTIES, onChart } = await import("../shared/game.js");
  const { CLUES, TESTIMONY } = await import("./bounties.js");
  for (const b of BOUNTIES.filter((b) => b.interviews)) {
    const clueIds = b.locations!.flatMap((l) => l.clues.map((c) => c.id));
    const said = TESTIMONY[b.id] ?? {};
    const shared = b.interviews!.flatMap((i) => i.topics.map((t) => `${i.suspect}/${t.id}`)).sort();
    const server = Object.entries(said).flatMap(([s, ts]) => Object.keys(ts).map((t) => `${s}/${t}`)).sort();
    assert.deepEqual(shared, server, `${b.id} topics`);
    for (const i of b.interviews!) for (const t of i.topics) if (t.after) assert.ok(clueIds.includes(t.after), `${b.id} after ${t.after}`);
    const lies = Object.values(said).flatMap((ts) => Object.values(ts)).filter((x) => x.breakthrough);
    assert.deepEqual(lies.map((l) => l.breakthrough!.id).sort(), [...(b.breakthroughs ?? [])].sort(), `${b.id} breakthroughs`);
    for (const id of b.breakthroughs ?? []) assert.ok(!clueIds.includes(id), `${b.id}: ${id} clashes with a clue id`);
    for (const l of lies) {
      for (const c of l.caughtBy!) assert.ok(clueIds.includes(c), `${b.id} caughtBy ${c}`);
    }
  }
  for (const b of BOUNTIES.filter((b) => b.locations)) {
    const shared = b.locations!.flatMap((l) => l.clues);
    assert.deepEqual(shared.map((c) => c.id).sort(), Object.keys(CLUES[b.id] ?? {}).sort(), b.id);
    for (const c of shared) {
      assert.equal(Boolean(c.cipher), CLUES[b.id][c.id].key !== undefined, `${b.id}/${c.id} cipher`);
      assert.equal(Boolean(c.lock || c.chart), CLUES[b.id][c.id].code !== undefined, `${b.id}/${c.id} lock or chart`);
      if (c.lock) assert.equal(c.lock.dials, CLUES[b.id][c.id].code!.length, `${b.id}/${c.id} dials`);
      if (c.chart) {
        assert.ok(onChart(c.chart, CLUES[b.id][c.id].code!), `${b.id}/${c.id} square`);
        for (const cell of [...c.chart.deep, ...c.chart.lit, ...c.chart.marks.map((m) => m.cell)]) {
          assert.ok(onChart(c.chart, cell), `${b.id}/${c.id} ${cell}`);
        }
      }
      for (const need of CLUES[b.id][c.id].needs ?? []) assert.ok(CLUES[b.id][need], `${b.id}/${c.id} needs ${need}`);
    }
  }
});

test("game: hunter rank and the telegram cipher", async () => {
  const { hunterRank, shiftLetters, bountyById } = await import("../shared/game.js");
  assert.equal(hunterRank(0).title, "Greenhorn");
  assert.deepEqual(hunterRank(1), { title: "Deputy", next: { title: "Marshal", needed: 1 } });
  assert.equal(hunterRank(99).next, undefined);
  assert.equal(shiftLetters(shiftLetters("RAIN-MAKERS, Q.", 2), -2), "RAIN-MAKERS, Q.");
  assert.equal(shiftLetters("XYZ", 2), "ZAB");
  const { CLUES } = await import("./bounties.js");
  assert.ok(bountyById("red-sands")!.locations!.flatMap((l) => l.clues).some((c) => c.cipher));
  const tele = CLUES["red-sands"].telegram;
  assert.equal(shiftLetters(shiftLetters(tele.text, tele.key!), -tele.key!), tele.text);
});

test("game: Venus locker opens only with all three scraps found and the right combination", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  await unlock("venus-fog", cookie);
  const tryCode = (code: string) => post("/api/bounties/venus-fog/clues/locker/unlock", { code }, cookie);
  const search = (id: string) => post(`/api/bounties/venus-fog/clues/${id}/search`, {}, cookie);

  assert.deepEqual(await (await search("locker")).json(), { locked: true });
  assert.equal((await tryCode("418")).status, 409); // no scraps yet
  await search("case");
  await search("keys");
  assert.equal((await tryCode("418")).status, 409); // still missing one
  await search("orchids");
  assert.equal((await tryCode("12a")).status, 400);
  assert.deepEqual(await (await tryCode("841")).json(), { correct: false });
  const open = await (await tryCode("418")).json();
  assert.equal(open.correct, true);
  assert.match(open.text, /Star of Venus/);
});

test("game: Venus bounty pays 1200 and turns up fragment III", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const paid = await solve("venus-fog", "vance", cookie);
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).credits, 1200);
  const map = await (await fetch(base + "/api/star-map")).json();
  assert.ok(map.fragments.find((f: { id: string; hunters: number }) => f.id === "venusian-quadrant").hunters >= 1);
});

test("game: questioning suspects: topics unlock with clues, and the right clue catches a lie", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const ask = (s: string, t: string) => post(`/api/bounties/saturn-orrery/suspects/${s}/ask/${t}`, {}, cookie);
  const present = (s: string, t: string, clue: string) =>
    post(`/api/bounties/saturn-orrery/suspects/${s}/ask/${t}/present`, { clue }, cookie);
  const search = (c: string) => post(`/api/bounties/saturn-orrery/clues/${c}/search`, {}, cookie);
  await unlock("saturn-orrery", cookie);

  assert.match((await (await ask("tuttle", "night")).json()).text, /telescope/);
  assert.equal((await ask("ashgrove", "money")).status, 409); // needs the guestbook first
  assert.equal((await ask("tuttle", "nope")).status, 404);
  assert.equal((await present("tuttle", "night", "telescope")).status, 409); // clue not found yet

  await search("telescope");
  await search("orrery");
  assert.deepEqual(await (await present("tuttle", "night", "orrery")).json(), { correct: false });
  assert.deepEqual(await (await present("tuttle", "the-key", "telescope")).json(), { correct: false }); // not a lie
  const caught = await (await present("tuttle", "night", "telescope")).json();
  assert.equal(caught.correct, true);
  assert.match(caught.text, /stepped out/);

  const progress = await (await fetch(base + "/api/bounties/saturn-orrery/progress", { headers: { Cookie: cookie } })).json();
  assert.ok(progress.found[caught.id].includes("stepped out"));
  assert.deepEqual(progress.caught, { "tuttle/night": caught.id }); // survives leaving the tab or reloading

  // Still can't accuse without every clue and both breakthroughs
  assert.equal((await post("/api/bounties/saturn-orrery/accuse", { suspect: "tuttle", proof: "telescope" }, cookie)).status, 409);
});

test("game: Saturn bounty pays 1600 and turns up fragment IV", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const paid = await solve("saturn-orrery", "tuttle", cookie);
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).credits, 1600);
});

test("game: Neptune's diving bell needs all three chart clues, then the right square", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  await unlock("neptune-deep", cookie);
  const dive = (code: string) => post("/api/bounties/neptune-deep/clues/chart/unlock", { code }, cookie);
  const search = (id: string) => post(`/api/bounties/neptune-deep/clues/${id}/search`, {}, cookie);

  assert.deepEqual(await (await search("chart")).json(), { locked: true });
  assert.equal((await dive("C3")).status, 409); // no chart clues yet
  await search("sonar");
  await search("chamber");
  assert.equal((await dive("C3")).status, 409); // still missing the Beacon
  await search("beacon");
  for (const bad of ["G1", "A6", "c3", "C03", "A0", "418", ""]) assert.equal((await dive(bad)).status, 400, bad);
  assert.equal((await post("/api/bounties/venus-fog/clues/locker/unlock", { code: "C3" }, cookie)).status, 400); // a lock takes numbers
  for (const wrong of ["B3", "D3", "D2"]) assert.deepEqual(await (await dive(wrong)).json(), { correct: false }, wrong);
  const found = await (await dive("C3")).json();
  assert.equal(found.correct, true);
  assert.match(found.text, /C\.F\./);

  const progress = await (await fetch(base + "/api/bounties/neptune-deep/progress", { headers: { Cookie: cookie } })).json();
  assert.equal(progress.found.chart, found.text); // the dive survives a refresh
  assert.equal((await post("/api/bounties/neptune-deep/accuse", { suspect: "coralie", proof: "chart" }, cookie)).status, 409); // berth and stage door still unsearched
});

test("game: the chart clues point to exactly one square", async () => {
  const { bountyById, chartCell } = await import("../shared/game.js");
  const chart = bountyById("neptune-deep")!.locations!.flatMap((l) => l.clues).find((c) => c.chart)!.chart!;
  const arch = chart.marks.find((m) => m.icon === "arch")!.cell;
  const squares: string[] = [];
  for (let c = 1; c <= chart.cols; c++) for (let r = 1; r <= chart.rows; r++) squares.push(chartCell(c, r));
  const east = (s: string) => s[1] === arch[1] && s[0] > arch[0]; // sonar: due east of the Coral Arch, same row
  const deep = (s: string) => chart.deep.includes(s); // Rusty: only the Deep is deep enough
  const dark = (s: string) => !chart.lit.includes(s); // the Beacon keeper: nothing came into the light
  assert.deepEqual(squares.filter((s) => east(s) && deep(s) && dark(s)), ["C3"]);
  // Every clue matters: any two of them still leave more than one square
  for (const [a, b] of [[east, deep], [east, dark], [deep, dark]]) {
    assert.ok(squares.filter((s) => a(s) && b(s)).length > 1);
  }
});

test("game: Neptune bounty pays 2000 and turns up fragment V", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  await investigate("neptune-deep", cookie);
  assert.deepEqual(await (await post("/api/bounties/neptune-deep/accuse", { suspect: "rusty", proof: "chamber" }, cookie)).json(), { correct: false });
  // The right suspect with evidence that doesn't name her is still turned away
  assert.deepEqual(await (await post("/api/bounties/neptune-deep/accuse", { suspect: "coralie", proof: "sonar" }, cookie)).json(), { correct: false });
  const right = await (await post("/api/bounties/neptune-deep/accuse", { suspect: "coralie", proof: "stage-door" }, cookie)).json();
  assert.equal(right.showdown.scene, "./game/showdown-promenade-neptune.webp");
  await wait(850);
  const paid = await post("/api/bounties/neptune-deep/claim", { suspect: "coralie" }, cookie);
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).credits, 2000);
  const map = await (await fetch(base + "/api/star-map")).json();
  assert.equal(map.fragments.find((f: { id: string; hunters: number }) => f.id === "neptunian-quadrant").hunters, 1);
});

test("game: bounties that aren't released yet can't be played", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const venus = BOUNTIES.find((b) => b.id === "venus-fog")!;
  const cookie = cookieOf(await fetch(base + "/api/player"));
  venus.available = false;
  try {
    for (const [url, body] of [
      ["/api/bounties/venus-fog/clues/case/search", {}],
      ["/api/bounties/venus-fog/clues/locker/unlock", { code: "418" }],
      ["/api/bounties/venus-fog/accuse", { suspect: "vance", proof: "locker" }],
      ["/api/bounties/venus-fog/claim", { suspect: "vance" }],
    ] as const) {
      assert.equal((await post(url, body, cookie)).status, 404, url);
    }
    assert.equal((await fetch(base + "/api/bounties/venus-fog/progress", { headers: { Cookie: cookie } })).status, 404);
  } finally {
    venus.available = true;
  }
});

test("game: Aurelia admits only hunters with all three star map pieces", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const visit = () => fetch(base + "/api/aurelia", { headers: { Cookie: cookie } });

  const refused = await visit();
  assert.equal(refused.status, 403);
  assert.deepEqual(await refused.json(), { error: "Your name isn't on the list", have: 0, needed: 3 });

  await solve("heart-of-luna", "cookie", cookie);
  await solve("red-sands", "quill", cookie);
  assert.equal((await visit()).status, 403); // two of three isn't enough
  await solve("venus-fog", "vance", cookie);

  const city = await (await visit()).json();
  assert.deepEqual(city.map((l: { id: string }) => l.id), ["plaza", "guild", "tower"]);
  const callsign = (await (await fetch(base + "/api/player", { headers: { Cookie: cookie } })).json()).callsign;
  const registrar = city[1].spots.find((s: { id: string }) => s.id === "registrar");
  assert.ok(registrar.text.includes(callsign) && registrar.text.includes("Marshal"));
  const trophies = city[1].spots.find((s: { id: string }) => s.id === "trophies");
  assert.match(trophies.text, /Heart of Luna.*Rain-Maker.*Star of Venus/);
});

test("voice lines are only served when the hunter may read the same text", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const hear = async (p: string) => (await fetch(`${base}/api/voice/${p}`, { headers: { Cookie: cookie } })).status;

  assert.equal(await hear("aurora/broadcast"), 200);
  assert.equal(await hear("clue/red-sands/telegram"), 404); // not decoded yet
  assert.equal(await hear("taunt/red-sands"), 404); // culprit not named yet
  assert.equal(await hear("aurelia/tower/lilies"), 404); // not invited
  assert.equal(await hear("clue/red-sands/..%2F..%2Fdata"), 404);

  await investigate("red-sands", cookie);
  assert.equal(await hear("clue/red-sands/telegram"), 200);
  await post("/api/bounties/red-sands/accuse", { suspect: "quill", proof: "crates" }, cookie);
  assert.equal(await hear("taunt/red-sands"), 200);
  await unlock("saturn-orrery", cookie);

  // Questioning: a topic's line once it can be asked; a caught lie once it's caught
  assert.equal(await hear("testimony/saturn-orrery/ashgrove--money"), 404);
  assert.equal(await hear("breakthrough/saturn-orrery/breakthrough-1"), 404);
  await post("/api/bounties/saturn-orrery/clues/guestbook/search", {}, cookie);
  assert.equal(await hear("testimony/saturn-orrery/ashgrove--money"), 200);
  assert.equal(await hear("breakthrough/saturn-orrery/breakthrough-1"), 404);
  await post("/api/bounties/saturn-orrery/suspects/ashgrove/ask/money/present", { clue: "guestbook" }, cookie);
  assert.equal(await hear("breakthrough/saturn-orrery/breakthrough-1"), 200);
});

test("every scene and portrait has a loading placeholder, and none gives a culprit away", async () => {
  const placeholders: Record<string, { src: string; color: string; ratio: number }> = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "..", "client", "src", "generated", "placeholders.json"), "utf-8"),
  );
  const { BOUNTIES } = await import("../shared/game.js");
  const { aureliaFor } = await import("./aurelia.js");
  const shown = [
    ...BOUNTIES.flatMap((b) => [...(b.locations ?? []).map((l) => l.image), ...(b.suspects ?? []).map((s) => s.portrait)]),
    ...aureliaFor("QA", []).map((l) => l.image),
    "./game/bounty-office-no-hero.webp",
    "./game/aurelia-gates.webp",
    "./scenes/hub-cover.webp",
  ];
  for (const src of shown) {
    assert.ok(existsSync(path.join(import.meta.dirname, "..", "client", "public", src)), `${src} exists`);
    assert.ok(placeholders[src]?.src.startsWith("data:image/webp;base64,"), `${src} has a placeholder (run script/art/placeholders.py)`);
  }
  // The file ships to the browser: villain cutouts are named after the culprit
  assert.deepEqual(Object.keys(placeholders).filter((k) => k.endsWith("-showdown.webp")), []);
});

test("a villain's showdown picture is only served after the right accusation, and never as a public file", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  // No public file may be named after a suspect (asking for each would reveal the culprit)
  for (const b of BOUNTIES) {
    for (const s of b.suspects ?? []) {
      assert.equal(existsSync(path.join(import.meta.dirname, "..", "client", "public", "game", `${s.id}-showdown.webp`)), false, `${s.id}-showdown.webp is public`);
    }
  }
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const see = async (p: string) => (await fetch(`${base}/api/art/showdown/${p}`, { headers: { Cookie: cookie } })).status;
  assert.equal(await see("red-sands"), 404); // nobody named yet
  assert.equal(await see("no-such-case"), 404);
  await investigate("red-sands", cookie);
  const wrong = await post("/api/bounties/red-sands/accuse", { suspect: "dusty", proof: "crates" }, cookie);
  assert.equal((await wrong.json()).correct, false);
  assert.equal(await see("red-sands"), 404); // a wrong guess shows nothing
  const right = await (await post("/api/bounties/red-sands/accuse", { suspect: "quill", proof: "crates" }, cookie)).json();
  assert.equal(right.showdown.image, "/api/art/showdown/red-sands");
  const res = await fetch(`${base}/api/art/showdown/red-sands`, { headers: { Cookie: cookie } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");
});

// --- Case integrity --------------------------------------------------------------

test("integrity: every live bounty has a solution whose suspect and proof exist", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const { BOUNTY_SOLUTIONS } = await import("./bounties.js");
  for (const b of BOUNTIES.filter((b) => b.available)) {
    const sol = BOUNTY_SOLUTIONS[b.id];
    assert.ok(sol, `${b.id} has no solution`);
    assert.ok(b.suspects?.some((s) => s.id === sol.suspect), `${b.id}: ${sol.suspect} isn't a suspect`);
    const ids = [...(b.locations ?? []).flatMap((l) => l.clues.map((c) => c.id)), ...(b.breakthroughs ?? [])];
    assert.ok(sol.proof.length > 0, `${b.id} has no proof`);
    for (const p of sol.proof) assert.ok(ids.includes(p), `${b.id}: proof ${p} isn't a clue or breakthrough`);
  }
});

test("integrity: the answer key never ships in shared/game.ts", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const { BOUNTY_SOLUTIONS } = await import("./bounties.js");
  const source = readFileSync(path.join(import.meta.dirname, "..", "shared", "game.ts"), "utf8");
  assert.equal(source.includes("BOUNTY_SOLUTIONS"), false);
  const shipped = JSON.stringify(BOUNTIES);
  assert.equal(/"proof"/.test(shipped), false);
  for (const sol of Object.values(BOUNTY_SOLUTIONS)) {
    const asJson = JSON.stringify(sol.proof);
    const asSource = `[${sol.proof.map((p) => JSON.stringify(p)).join(", ")}]`;
    assert.equal(source.includes(asJson) || source.includes(asSource), false, asJson);
  }
});

test("integrity: every live bounty has a trophy in Aurelia", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const { TROPHIES } = await import("./aurelia.js");
  for (const b of BOUNTIES.filter((b) => b.available)) assert.ok(TROPHIES[b.id], `${b.id} has no trophy`);
});

test("integrity: every image the game names exists, public or gated", async () => {
  const { BOUNTIES } = await import("../shared/game.js");
  const { BOUNTY_SOLUTIONS } = await import("./bounties.js");
  const { aureliaFor } = await import("./aurelia.js");
  const text = JSON.stringify([BOUNTIES, BOUNTY_SOLUTIONS, aureliaFor("X", [], true, [])]) + " ./game/showdown-street.webp";
  // Ordinary art is a public file
  const images = Array.from(new Set(text.match(/\.\/[\w./-]+\.webp/g) ?? []));
  assert.ok(images.length > 20);
  for (const img of images) assert.ok(existsSync(path.join(import.meta.dirname, "..", "client", "public", img)), img);
  // Villain showdown art is served from art/showdown/<bounty id>.webp, never public
  for (const b of BOUNTIES.filter((b) => b.available)) {
    const image = BOUNTY_SOLUTIONS[b.id].showdown.image;
    assert.equal(image, `/api/art/showdown/${b.id}`, `${b.id} showdown art isn't gated`);
    assert.ok(existsSync(path.join(import.meta.dirname, "..", "art", "showdown", `${b.id}.webp`)), `art/showdown/${b.id}.webp`);
  }
});

test("integrity: contract prerequisites name real bounties and never loop", async () => {
  const { BOUNTIES, bountyById } = await import("../shared/game.js");
  const state = new Map<string, "visiting" | "done">();
  const visit = (id: string) => {
    assert.notEqual(state.get(id), "visiting", `prerequisite loop through ${id}`);
    if (state.get(id) === "done") return;
    state.set(id, "visiting");
    for (const req of bountyById(id)!.requires ?? []) {
      assert.ok(bountyById(req), `${id} requires unknown ${req}`);
      visit(req);
    }
    state.set(id, "done");
  };
  for (const b of BOUNTIES) visit(b.id);
});

// --- Accusations ------------------------------------------------------------------

test("accusing: a wrong suspect and a right suspect with weak proof get the same answer", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const accuse = (suspect: string, proof: string) => post("/api/bounties/heart-of-luna/accuse", { suspect, proof }, cookie);
  for (const c of ["dome", "robot", "mixer", "videophone"]) await post(`/api/bounties/heart-of-luna/clues/${c}/search`, {}, cookie);

  // Evidence you haven't found is refused outright
  const unfound = await accuse("cookie", "servo");
  assert.equal(unfound.status, 409);
  assert.deepEqual(await unfound.json(), { error: "You haven't found that clue" });

  const wrongSuspect = await accuse("vela", "dome");
  const weakProof = await accuse("cookie", "videophone"); // Madame Vela's alibi doesn't prove anything about Cookie
  assert.equal(wrongSuspect.status, 200);
  assert.equal(weakProof.status, 200);
  assert.deepEqual(await wrongSuspect.json(), { correct: false });
  assert.deepEqual(await weakProof.json(), { correct: false });
  assert.equal((await accuse("cookie", "x".repeat(41))).status, 400);

  const right = await (await accuse("cookie", "robot")).json();
  assert.equal(right.correct, true);
});

test("claiming before naming the culprit is refused the same way for any suspect", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  await investigate("heart-of-luna", cookie);
  const right = await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie);
  const wrong = await post("/api/bounties/heart-of-luna/claim", { suspect: "gearhart" }, cookie);
  assert.equal(right.status, 409);
  assert.equal(wrong.status, 409);
  assert.deepEqual(await right.json(), await wrong.json());
});

// --- Clean Case ---------------------------------------------------------------------

test("Clean Case: earned with no wrong accusations, lost with one, kept through replays, and breaks leaderboard ties", async () => {
  const { claimBounty } = await import("./gameStorage.js");
  const profile = async (cookie: string) => (await fetch(base + "/api/player", { headers: { Cookie: cookie } })).json();

  // Two hunters with the same big head start, so the tie is at the top of the board
  const sloppy = cookieOf(await fetch(base + "/api/player"));
  const clean = cookieOf(await fetch(base + "/api/player"));
  for (const c of [sloppy, clean]) await claimBounty(visitorOf(c), "tie-test", 100000);

  // The sloppy hunter guesses wrong once, then collects first
  await investigate("heart-of-luna", sloppy);
  assert.deepEqual(await (await post("/api/bounties/heart-of-luna/accuse", { suspect: "gearhart", proof: "dome" }, sloppy)).json(), { correct: false });
  await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie", proof: "dome" }, sloppy);
  await wait(850);
  const sloppyPaid = await (await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, sloppy)).json();
  assert.equal(sloppyPaid.cleanBounties.includes("heart-of-luna"), false);

  // The clean hunter gets it first time; the claim's own response already shows the seal
  const paid = await solve("heart-of-luna", "cookie", clean);
  assert.equal(paid.status, 200);
  assert.ok((await paid.json()).cleanBounties.includes("heart-of-luna"));

  // Replays after collecting never change the seal either way
  await post("/api/bounties/heart-of-luna/accuse", { suspect: "vela", proof: "dome" }, clean);
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, clean)).status, 409);
  assert.ok((await profile(clean)).cleanBounties.includes("heart-of-luna"));
  await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie", proof: "dome" }, sloppy);
  assert.equal((await profile(sloppy)).cleanBounties.includes("heart-of-luna"), false);

  // Same credits: the Clean Case wins the tie even though the other hunter collected first
  const board = await (await fetch(base + "/api/leaderboard")).json();
  const name = async (c: string) => (await profile(c)).callsign;
  const rows = board.slice(0, 2);
  assert.deepEqual(rows.map((r: { callsign: string }) => r.callsign), [await name(clean), await name(sloppy)]);
  assert.equal(rows[0].earned, rows[1].earned);
  assert.equal(rows[0].cleanCount, 2); // the head start counts as clean, plus this case
  assert.equal(rows[1].cleanCount, 1);
});

// --- Contract order ------------------------------------------------------------------

test("contracts open in order, and hunters who already started one keep it", async () => {
  const { claimBounty, recordClue } = await import("./gameStorage.js");
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const hear = async (p: string) => (await fetch(`${base}/api/voice/${p}`, { headers: { Cookie: cookie } })).status;

  const fresh = await (await fetch(base + "/api/player", { headers: { Cookie: cookie } })).json();
  assert.deepEqual(fresh.startedBounties, []);
  for (const [url, body] of [
    ["/api/bounties/red-sands/clues/pad/search", {}],
    ["/api/bounties/red-sands/accuse", { suspect: "quill", proof: "crates" }],
    ["/api/bounties/red-sands/claim", { suspect: "quill" }],
    ["/api/bounties/saturn-orrery/suspects/tuttle/ask/night", {}],
  ] as const) {
    const res = await post(url, body, cookie);
    assert.equal(res.status, 403, url);
    assert.deepEqual(await res.json(), { error: "Complete earlier contracts first" });
  }
  assert.equal((await fetch(base + "/api/bounties/red-sands/progress", { headers: { Cookie: cookie } })).status, 403);
  assert.equal(await hear("briefing/red-sands"), 404);
  assert.equal(await hear("testimony/saturn-orrery/tuttle--night"), 404);
  // The first contract is always open
  assert.equal((await post("/api/bounties/heart-of-luna/clues/dome/search", {}, cookie)).status, 200);

  // Collecting the Moon job opens Mars and Venus, not Saturn
  await claimBounty(visitorOf(cookie), "heart-of-luna", 0);
  assert.equal((await post("/api/bounties/red-sands/clues/pad/search", {}, cookie)).status, 200);
  assert.equal(await hear("briefing/red-sands"), 200);
  assert.equal((await post("/api/bounties/saturn-orrery/clues/orrery/search", {}, cookie)).status, 403);
  assert.equal((await post("/api/bounties/neptune-deep/clues/berth/search", {}, cookie)).status, 403);

  // The Golden Submarine waits for the Saturn case
  await unlock("neptune-deep", cookie);
  assert.equal((await post("/api/bounties/neptune-deep/clues/berth/search", {}, cookie)).status, 200);

  // A hunter with Saturn progress from before the order existed keeps playing it
  const veteran = cookieOf(await fetch(base + "/api/player"));
  await recordClue(visitorOf(veteran), "saturn-orrery", "telescope");
  const vet = await (await fetch(base + "/api/player", { headers: { Cookie: veteran } })).json();
  assert.deepEqual(vet.startedBounties, ["saturn-orrery"]);
  assert.equal((await post("/api/bounties/saturn-orrery/clues/orrery/search", {}, veteran)).status, 200);
  assert.equal((await fetch(`${base}/api/voice/testimony/saturn-orrery/tuttle--night`, { headers: { Cookie: veteran } })).status, 200);
});

// --- Outfitters, satchel and Aurelia ------------------------------------------------------

test("shop: the Guild Gold Star and Hair-Trigger Holster, and the draw window they buy", async () => {
  const { drawWindowMs, shopItem, BOUNTIES, SHOP_ITEMS } = await import("../shared/game.js");
  const { claimBounty } = await import("./gameStorage.js");
  assert.equal(drawWindowMs([]), 500);
  assert.equal(drawWindowMs(["raygun"]), 750);
  assert.equal(drawWindowMs(["holster"]), 650);
  assert.equal(drawWindowMs(["raygun", "holster", "suit-red"]), 900);
  assert.equal(shopItem("guild-star")?.price, 1200);
  assert.equal(shopItem("holster")?.price, 2000);
  // The five live contracts pay 6,100 CR in all: enough for the whole Outfitters
  const paid = BOUNTIES.filter((b) => b.available).reduce((sum, b) => sum + b.reward, 0);
  assert.equal(paid, 6100);
  assert.ok(SHOP_ITEMS.reduce((sum, i) => sum + i.price, 0) <= paid);

  const cookie = cookieOf(await fetch(base + "/api/player"));
  await claimBounty(visitorOf(cookie), "shop-test", 3200);
  const star = await post("/api/shop/guild-star/buy", {}, cookie);
  assert.equal(star.status, 200);
  assert.equal((await star.json()).credits, 2000);
  const holster = await (await post("/api/shop/holster/buy", {}, cookie)).json();
  assert.equal(holster.credits, 0);
  assert.deepEqual(holster.owned, ["guild-star", "holster"]);
  assert.equal(drawWindowMs(holster.owned), 650);

  const board = await (await fetch(base + "/api/leaderboard")).json();
  const me = board.find((e: { callsign: string }) => e.callsign === holster.callsign);
  assert.equal(me.starred, true);
});

test("satchel: the Brass Orrery Key comes from the orrery, and from any Saturn claim", async () => {
  const { claimBounty } = await import("./gameStorage.js");
  const items = async (c: string) => (await (await fetch(base + "/api/player", { headers: { Cookie: c } })).json()).items;

  const searcher = cookieOf(await fetch(base + "/api/player"));
  await unlock("saturn-orrery", searcher);
  assert.equal((await items(searcher)).includes("orrery-key"), false);
  await post("/api/bounties/saturn-orrery/clues/orrery/search", {}, searcher);
  assert.deepEqual(await items(searcher), ["orrery-key"]);

  // A hunter who collected Saturn before the key existed has it too
  const veteran = cookieOf(await fetch(base + "/api/player"));
  await claimBounty(visitorOf(veteran), "saturn-orrery", 0);
  assert.deepEqual(await items(veteran), ["orrery-key"]);
});

test("Aurelia: the Outer Rim Dispatch only reads with a decoder ring; clean trophies are marked", async () => {
  const { claimBounty, grantItem } = await import("./gameStorage.js");
  const cookie = cookieOf(await fetch(base + "/api/player"));
  for (const id of ["heart-of-luna", "red-sands", "venus-fog"]) await claimBounty(visitorOf(cookie), id, 0);
  const guild = async () => (await (await fetch(base + "/api/aurelia", { headers: { Cookie: cookie } })).json())[1];

  const before = await guild();
  const dispatch = before.spots.find((s: { id: string }) => s.id === "dispatch");
  assert.ok(dispatch);
  assert.match(dispatch.text, /decoder ring/);
  assert.equal(dispatch.text.includes("OUTER RIM EXPEDITION"), false);
  assert.match(before.spots.find((s: { id: string }) => s.id === "trophies").text, /Heart of Luna \(★ Clean Case\)/);

  await grantItem(visitorOf(cookie), "decoder-ring");
  const after = (await guild()).spots.find((s: { id: string }) => s.id === "dispatch");
  assert.match(after.text, /OUTER RIM EXPEDITION — TITAN & EUROPA CHARTERS SEALED BY ORDER OF STERLING ATOMIC\./);
});
