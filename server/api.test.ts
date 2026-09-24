import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

const dbDir = mkdtempSync(path.join(tmpdir(), "retrofuturism-test-"));
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
