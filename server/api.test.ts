import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

const dbDir = mkdtempSync(path.join(tmpdir(), "cosmic-conquest-test-"));
process.env.DATABASE_PATH = path.join(dbDir, "test.db");
process.env.SHOWDOWN_MIN_MS = "800"; // shorter than the real 1.5 s, long enough to test reliably

let server: Server;
let base: string;

before(async () => {
  // Import after DATABASE_PATH is set so storage opens the temp database.
  const { registerRoutes } = await import("./routes");
  const app = express();
  app.use(express.json());
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  rmSync(dbDir, { recursive: true, force: true });
});

function post(url: string, body: unknown, cookie?: string) {
  return fetch(base + url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Play a bounty the honest way: search every spot, decode coded clues, name the suspect.
async function investigate(bountyId: string, cookie: string) {
  const { CLUES } = await import("./bounties");
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
}

async function solve(bountyId: string, suspect: string, cookie: string) {
  await investigate(bountyId, cookie);
  await post(`/api/bounties/${bountyId}/accuse`, { suspect }, cookie);
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
  assert.equal((await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie" }, cookie)).status, 409);
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie)).status, 409);
  await investigate("heart-of-luna", cookie);

  // Wrong and right accusations
  const wrong = await post("/api/bounties/heart-of-luna/accuse", { suspect: "vela" }, cookie);
  assert.deepEqual(await wrong.json(), { correct: false });
  const right = await (await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie" }, cookie)).json();
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
  assert.equal((await post("/api/bounties/nope/accuse", { suspect: "x" }, cookie)).status, 404);

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
  assert.deepEqual(entry, { callsign: "Spike", earned: 500, bounties: 1 });
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
  const { BOUNTIES } = await import("@shared/game");
  const shipped = JSON.stringify(BOUNTIES);
  assert.equal(/spatula blaster|lock-up|never take me alive|stamp-blaster|properly filed|Nobody catches|Venus lock-up/.test(shipped), false);
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
  const { MAP_FRAGMENTS, STAR_MAP_SIZE } = await import("@shared/game");
  const numbers = MAP_FRAGMENTS.map((f) => f.number);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.equal(new Set(MAP_FRAGMENTS.map((f) => f.id)).size, MAP_FRAGMENTS.length);
  for (const n of numbers) assert.ok(Number.isInteger(n) && n >= 1 && n <= STAR_MAP_SIZE);
});

test("game: Mars bounty pays 800 to the right suspect and turns up fragment II", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  await investigate("red-sands", cookie);
  assert.deepEqual(await (await post("/api/bounties/red-sands/accuse", { suspect: "venn" }, cookie)).json(), { correct: false });
  // (clues first, then the accusations)
  const right = await (await post("/api/bounties/red-sands/accuse", { suspect: "quill" }, cookie)).json();
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
  const { shiftLetters } = await import("@shared/game");
  const start = await fetch(base + "/api/player");
  const cookie = cookieOf(start);
  assert.deepEqual((await start.json()).items, []);
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
  const { BOUNTIES } = await import("@shared/game");
  const { CLUES } = await import("./bounties");
  const shipped = JSON.stringify(BOUNTIES);
  for (const clues of Object.values(CLUES)) {
    for (const { text } of Object.values(clues)) assert.equal(shipped.includes(text), false, text.slice(0, 40));
  }
  assert.equal(/"key"|"code"|"needs"/.test(shipped), false);
  const { shiftLetters } = await import("@shared/game");
  const tele = CLUES["red-sands"].telegram;
  assert.equal(shipped.includes(shiftLetters(tele.text, tele.key!).slice(0, 20)), false, "coded text ships");
});

test("game: every hotspot has server clue text, and coded clues have a key", async () => {
  const { BOUNTIES } = await import("@shared/game");
  const { CLUES } = await import("./bounties");
  for (const b of BOUNTIES.filter((b) => b.locations)) {
    const shared = b.locations!.flatMap((l) => l.clues);
    assert.deepEqual(shared.map((c) => c.id).sort(), Object.keys(CLUES[b.id] ?? {}).sort(), b.id);
    for (const c of shared) {
      assert.equal(Boolean(c.cipher), CLUES[b.id][c.id].key !== undefined, `${b.id}/${c.id} cipher`);
      assert.equal(Boolean(c.lock), CLUES[b.id][c.id].code !== undefined, `${b.id}/${c.id} lock`);
      if (c.lock) {
        assert.equal(c.lock.dials, CLUES[b.id][c.id].code!.length, `${b.id}/${c.id} dials`);
        for (const need of CLUES[b.id][c.id].needs ?? []) assert.ok(CLUES[b.id][need], `${b.id}/${c.id} needs ${need}`);
      }
    }
  }
});

test("game: hunter rank and the telegram cipher", async () => {
  const { hunterRank, shiftLetters, bountyById } = await import("@shared/game");
  assert.equal(hunterRank(0).title, "Greenhorn");
  assert.deepEqual(hunterRank(1), { title: "Deputy", next: { title: "Marshal", needed: 1 } });
  assert.equal(hunterRank(99).next, undefined);
  assert.equal(shiftLetters(shiftLetters("RAIN-MAKERS, Q.", 2), -2), "RAIN-MAKERS, Q.");
  assert.equal(shiftLetters("XYZ", 2), "ZAB");
  const { CLUES } = await import("./bounties");
  assert.ok(bountyById("red-sands")!.locations!.flatMap((l) => l.clues).some((c) => c.cipher));
  const tele = CLUES["red-sands"].telegram;
  assert.equal(shiftLetters(shiftLetters(tele.text, tele.key!), -tele.key!), tele.text);
});

test("game: Venus locker opens only with all three scraps found and the right combination", async () => {
  const cookie = cookieOf(await fetch(base + "/api/player"));
  const unlock = (code: string) => post("/api/bounties/venus-fog/clues/locker/unlock", { code }, cookie);
  const search = (id: string) => post(`/api/bounties/venus-fog/clues/${id}/search`, {}, cookie);

  assert.deepEqual(await (await search("locker")).json(), { locked: true });
  assert.equal((await unlock("418")).status, 409); // no scraps yet
  await search("case");
  await search("keys");
  assert.equal((await unlock("418")).status, 409); // still missing one
  await search("orchids");
  assert.equal((await unlock("12a")).status, 400);
  assert.deepEqual(await (await unlock("841")).json(), { correct: false });
  const open = await (await unlock("418")).json();
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

test("game: bounties that aren't released yet can't be played", async () => {
  const { BOUNTIES } = await import("@shared/game");
  const venus = BOUNTIES.find((b) => b.id === "venus-fog")!;
  const cookie = cookieOf(await fetch(base + "/api/player"));
  venus.available = false;
  try {
    for (const [url, body] of [
      ["/api/bounties/venus-fog/clues/case/search", {}],
      ["/api/bounties/venus-fog/clues/locker/unlock", { code: "418" }],
      ["/api/bounties/venus-fog/accuse", { suspect: "vance" }],
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
