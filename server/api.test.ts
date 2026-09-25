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

  // Wrong and right accusations
  const wrong = await post("/api/bounties/heart-of-luna/accuse", { suspect: "vela" }, cookie);
  assert.deepEqual(await wrong.json(), { correct: false });
  const right = await (await post("/api/bounties/heart-of-luna/accuse", { suspect: "cookie" }, cookie)).json();
  assert.equal(right.correct, true);
  assert.match(right.showdown.opponent, /Cookie/); // revealed only after a correct accusation

  // Claims: wrong suspect refused, right one paid exactly once
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "gearhart" }, cookie)).status, 422);
  const paid = await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie);
  assert.equal(paid.status, 200);
  const afterClaim = await paid.json();
  assert.equal(afterClaim.credits, 500);
  assert.deepEqual(afterClaim.completedBounties, ["heart-of-luna"]);
  assert.equal((await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie)).status, 409);

  // Unavailable / unknown bounties
  assert.equal((await post("/api/bounties/red-sands/claim", { suspect: "x" }, cookie)).status, 404);
  assert.equal((await post("/api/bounties/nope/accuse", { suspect: "x" }, cookie)).status, 404);

  // The name shown before the first action is the one that got saved
  assert.equal(afterClaim.callsign, fresh.callsign);
  assert.match(fresh.callsign, /^Hunter #\d{4}$/);

  // Empty updates are rejected (and don't create anything)
  assert.equal((await send("PATCH", "/api/player", {}, cookie)).status, 400);

  // Can't wear a suit you don't own
  assert.equal((await send("PATCH", "/api/player", { suit: "gold" }, cookie)).status, 403);

  // Shop: buy, can't double-buy; unknown and coming-soon items can't be bought
  const gun = await post("/api/shop/raygun/buy", {}, cookie);
  assert.equal(gun.status, 200);
  assert.equal((await gun.json()).credits, 200);
  assert.equal((await post("/api/shop/raygun/buy", {}, cookie)).status, 409);
  assert.equal((await post("/api/shop/moon-boots/buy", {}, cookie)).status, 404);
  assert.equal((await post("/api/shop/suit-red/buy", {}, cookie)).status, 404);

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
  await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie); // 500 credits
  const results = await Promise.all([1, 2, 3].map(() => post("/api/shop/raygun/buy", {}, cookie)));
  const profile = await (await fetch(base + "/api/player", { headers: { Cookie: cookie } })).json();
  assert.equal(results.filter((r) => r.status === 200).length, 1); // bought once
  assert.equal(profile.credits, 200);
  assert.deepEqual(profile.owned, ["raygun"]);
});

test("game: the culprit is not in the shared (browser) bounty data", async () => {
  const { BOUNTIES } = await import("@shared/game");
  const shipped = JSON.stringify(BOUNTIES);
  assert.equal(/spatula blaster|lock-up|never take me alive/.test(shipped), false);
});

test("game: star map counts hunters per fragment, once each", async () => {
  const lunar = (m: { fragments: { id: string; hunters: number }[] }) =>
    m.fragments.find((f) => f.id === "lunar-quadrant")!.hunters;
  const before = await (await fetch(base + "/api/star-map")).json();
  assert.equal(before.total, 12);

  const cookie = cookieOf(await fetch(base + "/api/player"));
  await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie);
  await post("/api/bounties/heart-of-luna/claim", { suspect: "cookie" }, cookie); // 409, not counted twice

  const after = await (await fetch(base + "/api/star-map")).json();
  assert.equal(lunar(after), lunar(before) + 1);
  assert.equal(after.searchers, before.searchers + 1);
  assert.deepEqual(Object.keys(after).sort(), ["fragments", "searchers", "total"]);
});
