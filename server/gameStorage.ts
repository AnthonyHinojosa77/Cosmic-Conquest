import { createHash } from "crypto";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { players, bountyClaims, playerItems, clueFinds, showdowns, replayReceipts, duelShots, bountyAttempts, caseRuns, type Player } from "../shared/schema.js";
import {
  DEFAULT_SUIT,
  ownsSuit,
  shopItem,
  suitForItem,
  BOUNTIES,
  STAR_MAP_SIZE,
  isBountyUnlocked,
  shotLands,
  type Bounty,
  type PlayerProfile,
  type LeaderboardEntry,
  type StarMapStatus,
  type ItemId,
  type ShopItemId,
  type SuitId,
  type WireEntry,
} from "../shared/game.js";
import { db, type Db } from "./storage.js";

// Stable per visitor, so the name shown before their first action is the one that gets saved.
function defaultCallsign(visitorId: string): string {
  const n = parseInt(createHash("sha256").update(visitorId).digest("hex").slice(0, 8), 16);
  return `Hunter #${1000 + (n % 9000)}`;
}

function parseOwned(raw: string): ShopItemId[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is ShopItemId => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// Helpers take the transaction they are called from (`q`), so reads inside a
// transaction see its own writes and never open a second connection.
async function completedBounties(visitorId: string, q: Db = db): Promise<string[]> {
  const rows = await q.select({ bountyId: bountyClaims.bountyId })
    .from(bountyClaims)
    .where(eq(bountyClaims.visitorId, visitorId))
    .all();
  return rows.map((r) => r.bountyId);
}

// Bounties with any recorded progress: a clue found, a showdown started or a claim.
async function startedBounties(visitorId: string, q: Db = db): Promise<string[]> {
  const ids = new Set<string>();
  for (const table of [clueFinds, showdowns, bountyClaims]) {
    const rows = await q.selectDistinct({ bountyId: table.bountyId }).from(table).where(eq(table.visitorId, visitorId)).all();
    for (const r of rows) ids.add(r.bountyId);
  }
  return Array.from(ids);
}

async function cleanBounties(visitorId: string, q: Db = db): Promise<string[]> {
  const rows = await q.select({ bountyId: bountyAttempts.bountyId })
    .from(bountyAttempts)
    .where(and(eq(bountyAttempts.visitorId, visitorId), eq(bountyAttempts.cleanClaimed, 1)))
    .all();
  return rows.map((r) => r.bountyId);
}

// The satchel. Closing the Saturn case always leaves the Brass Orrery Key in it,
// including for hunters who collected that bounty before the key existed.
async function itemsOf(visitorId: string, q: Db = db, completed?: readonly string[]): Promise<ItemId[]> {
  const rows = await q.select({ itemId: playerItems.itemId })
    .from(playerItems)
    .where(eq(playerItems.visitorId, visitorId))
    .all();
  const items = rows.map((r) => r.itemId as ItemId);
  const done = completed ?? (await completedBounties(visitorId, q));
  if (done.includes("saturn-orrery") && !items.includes("orrery-key")) items.push("orrery-key");
  return items;
}

async function progressFields(visitorId: string, q: Db = db) {
  const completed = await completedBounties(visitorId, q);
  return {
    completedBounties: completed,
    startedBounties: await startedBounties(visitorId, q),
    cleanBounties: await cleanBounties(visitorId, q),
    items: await itemsOf(visitorId, q, completed),
  };
}

async function toProfile(player: Player, q: Db = db): Promise<PlayerProfile> {
  return {
    callsign: player.callsign,
    credits: player.credits,
    suit: player.suit as SuitId,
    owned: parseOwned(player.owned),
    ...(await progressFields(player.visitorId, q)),
  };
}

function findPlayer(visitorId: string, q: Db = db): Promise<Player | undefined> {
  return q.select().from(players).where(eq(players.visitorId, visitorId)).get();
}

// Players are created lazily on their first write, so browsing never adds rows.
async function ensurePlayer(visitorId: string, q: Db = db): Promise<Player> {
  return (await findPlayer(visitorId, q)) ?? q.insert(players).values({
    visitorId,
    callsign: defaultCallsign(visitorId),
    credits: 0,
    suit: DEFAULT_SUIT,
    owned: "[]",
    createdAt: new Date().toISOString(),
  }).returning().get();
}

export async function getProfile(visitorId: string): Promise<PlayerProfile> {
  const player = await findPlayer(visitorId);
  if (player) return toProfile(player);
  return { callsign: defaultCallsign(visitorId), credits: 0, suit: DEFAULT_SUIT, owned: [], ...(await progressFields(visitorId)) };
}

// Contracts open in order; a bounty already started or collected stays open.
export async function canAccessBounty(visitorId: string, bounty: Bounty): Promise<boolean> {
  if (!bounty.requires?.length) return true;
  return isBountyUnlocked(bounty, await completedBounties(visitorId), await startedBounties(visitorId));
}

export type UpdateResult = { status: "ok"; profile: PlayerProfile } | { status: "suit_not_owned" };

export function updateProfile(visitorId: string, changes: { callsign?: string; suit?: SuitId }): Promise<UpdateResult> {
  return db.transaction(async (tx) => {
    const player = await ensurePlayer(visitorId, tx);
    const owned = parseOwned(player.owned);
    if (changes.suit && !ownsSuit(owned, changes.suit)) {
      return { status: "suit_not_owned" as const };
    }
    const updated = await tx.update(players)
      .set({
        ...(changes.callsign !== undefined ? { callsign: changes.callsign } : {}),
        ...(changes.suit !== undefined ? { suit: changes.suit } : {}),
      })
      .where(eq(players.id, player.id))
      .returning()
      .get();
    return { status: "ok" as const, profile: await toProfile(updated, tx) };
  });
}

export type ClaimResult = { status: "ok"; profile: PlayerProfile } | { status: "already_claimed" };

export function claimBounty(visitorId: string, bountyId: string, reward: number): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const player = await ensurePlayer(visitorId, tx);
    if ((await completedBounties(visitorId, tx)).includes(bountyId)) return { status: "already_claimed" as const };
    const now = new Date().toISOString();
    await tx.insert(bountyClaims).values({ visitorId, bountyId, reward, createdAt: now }).run();
    // Clean Case: collected without a single wrong accusation. Settled once, here.
    const wrong = (await tx.select({ n: bountyAttempts.wrongAccusations })
      .from(bountyAttempts)
      .where(and(eq(bountyAttempts.visitorId, visitorId), eq(bountyAttempts.bountyId, bountyId)))
      .get())?.n ?? 0;
    const cleanClaimed = wrong === 0 ? 1 : 0;
    await tx.insert(bountyAttempts)
      .values({ visitorId, bountyId, wrongAccusations: wrong, cleanClaimed, updatedAt: now })
      .onConflictDoUpdate({ target: [bountyAttempts.visitorId, bountyAttempts.bountyId], set: { cleanClaimed, updatedAt: now } })
      .run();
    const updated = await tx.update(players)
      .set({ credits: sql`${players.credits} + ${reward}` })
      .where(eq(players.id, player.id))
      .returning()
      .get();
    return { status: "ok" as const, profile: await toProfile(updated, tx) };
  });
}

export type BuyResult =
  | { status: "ok"; profile: PlayerProfile }
  | { status: "not_found" }
  | { status: "already_owned" }
  | { status: "insufficient_credits" };

export async function buyItem(visitorId: string, itemId: string): Promise<BuyResult> {
  const item = shopItem(itemId);
  if (!item) return { status: "not_found" };
  return db.transaction(async (tx) => {
    const player = await ensurePlayer(visitorId, tx);
    const owned = parseOwned(player.owned);
    if (owned.includes(item.id)) return { status: "already_owned" as const };
    if (player.credits < item.price) return { status: "insufficient_credits" as const };
    const suit = suitForItem(item.id);
    const updated = await tx.update(players)
      .set({
        credits: player.credits - item.price,
        owned: JSON.stringify([...owned, item.id]),
        // Put on a newly bought suit right away
        ...(suit ? { suit } : {}),
      })
      .where(eq(players.id, player.id))
      .returning()
      .get();
    return { status: "ok" as const, profile: await toProfile(updated, tx) };
  });
}

// A wrong accusation before the bounty is collected costs the Clean Case seal.
export async function recordWrongAccusation(visitorId: string, bountyId: string): Promise<void> {
  await db.transaction(async (tx) => {
    if ((await completedBounties(visitorId, tx)).includes(bountyId)) return;
    const now = new Date().toISOString();
    await tx.insert(bountyAttempts)
      .values({ visitorId, bountyId, wrongAccusations: 1, updatedAt: now })
      .onConflictDoUpdate({
        target: [bountyAttempts.visitorId, bountyAttempts.bountyId],
        set: { wrongAccusations: sql`${bountyAttempts.wrongAccusations} + 1`, updatedAt: now },
      })
      .run();
  });
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  // Clean cases come from a correlated subquery so the claims join (and its sum) isn't multiplied.
  const cleanCount = sql<number>`(select count(*) from ${bountyAttempts} where ${bountyAttempts.visitorId} = ${players.visitorId} and ${bountyAttempts.cleanClaimed} = 1)`;
  const rows = await db.select({
    callsign: players.callsign,
    owned: players.owned,
    earned: sql<number>`sum(${bountyClaims.reward})`,
    bounties: sql<number>`count(${bountyClaims.id})`,
    cleanCount,
  })
    .from(bountyClaims)
    .innerJoin(players, eq(players.visitorId, bountyClaims.visitorId))
    .groupBy(players.id)
    .orderBy(desc(sql`sum(${bountyClaims.reward})`), desc(cleanCount), sql`min(${bountyClaims.createdAt})`)
    .limit(limit)
    .all();
  return rows.map(({ callsign, owned, earned, bounties, cleanCount }) => ({
    callsign,
    earned,
    bounties,
    cleanCount,
    starred: parseOwned(owned).includes("guild-star"),
  }));
}

// The latest case closures with the hunter's callsign (callsigns are already public on the leaderboard).
export async function getWire(limit = 6): Promise<WireEntry[]> {
  const clean = sql<number>`(select count(*) from ${bountyAttempts} where ${bountyAttempts.visitorId} = ${bountyClaims.visitorId} and ${bountyAttempts.bountyId} = ${bountyClaims.bountyId} and ${bountyAttempts.cleanClaimed} = 1)`;
  const rows = await db.select({ callsign: players.callsign, bountyId: bountyClaims.bountyId, clean })
    .from(bountyClaims)
    .innerJoin(players, eq(players.visitorId, bountyClaims.visitorId))
    .where(sql`${bountyClaims.reward} > 0`)
    .orderBy(desc(bountyClaims.createdAt), desc(bountyClaims.id))
    .limit(limit)
    .all();
  return rows.map((r) => ({ callsign: r.callsign, bountyId: r.bountyId, clean: r.clean > 0 }));
}

export async function getStarMap(): Promise<StarMapStatus> {
  const withFragment = BOUNTIES.filter((b) => b.fragment);
  const ids = withFragment.map((b) => b.id);
  if (ids.length === 0) return { total: STAR_MAP_SIZE, fragments: [], searchers: 0 };
  // One read transaction so the per-fragment counts and the searcher total agree.
  return db.transaction(async (tx) => {
    // One claim per hunter per bounty (unique index), so count(*) is distinct hunters.
    const perBounty = await tx.select({ bountyId: bountyClaims.bountyId, hunters: sql<number>`count(*)` })
      .from(bountyClaims)
      .where(inArray(bountyClaims.bountyId, ids))
      .groupBy(bountyClaims.bountyId)
      .all();
    const counts = new Map(perBounty.map((r) => [r.bountyId, r.hunters]));
    const total = await tx.select({ n: sql<number>`count(distinct ${bountyClaims.visitorId})` })
      .from(bountyClaims)
      .where(inArray(bountyClaims.bountyId, ids))
      .get();
    return {
      total: STAR_MAP_SIZE,
      fragments: withFragment.map((b) => ({ id: b.fragment!.id, hunters: counts.get(b.id) ?? 0 })),
      searchers: total?.n ?? 0,
    };
  });
}

// Put an item in the hunter's satchel (idempotent). Doesn't create a player row.
export async function grantItem(visitorId: string, itemId: ItemId): Promise<void> {
  await db.insert(playerItems)
    .values({ visitorId, itemId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}

export async function hasItem(visitorId: string, itemId: ItemId): Promise<boolean> {
  return (await itemsOf(visitorId)).includes(itemId);
}

// --- Bounty progress (the server is the referee) ---------------------------

export async function recordClue(visitorId: string, bountyId: string, clueId: string): Promise<void> {
  await db.insert(clueFinds)
    .values({ visitorId, bountyId, clueId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}

// A collected case can be investigated again. The payout and the Clean Case seal stay put.
export async function replayInvestigation(visitorId: string, bountyId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await completedBounties(visitorId, tx)).includes(bountyId)) return false;
    await tx.delete(clueFinds)
      .where(and(eq(clueFinds.visitorId, visitorId), eq(clueFinds.bountyId, bountyId)))
      .run();
    await tx.delete(showdowns)
      .where(and(eq(showdowns.visitorId, visitorId), eq(showdowns.bountyId, bountyId)))
      .run();
    await tx.delete(replayReceipts)
      .where(and(eq(replayReceipts.visitorId, visitorId), eq(replayReceipts.bountyId, bountyId)))
      .run();
    await tx.delete(duelShots)
      .where(and(eq(duelShots.visitorId, visitorId), eq(duelShots.bountyId, bountyId)))
      .run();
    await tx.insert(caseRuns)
      .values({ visitorId, bountyId, runs: 1 })
      .onConflictDoUpdate({ target: [caseRuns.visitorId, caseRuns.bountyId], set: { runs: sql`${caseRuns.runs} + 1`, strikes: 0 } })
      .run();
    return true;
  });
}

export async function foundClues(visitorId: string, bountyId: string): Promise<string[]> {
  const rows = await db.select({ clueId: clueFinds.clueId })
    .from(clueFinds)
    .where(and(eq(clueFinds.visitorId, visitorId), eq(clueFinds.bountyId, bountyId)))
    .all();
  return rows.map((r) => r.clueId);
}

// (Re)start the showdown clock after a correct accusation.
export async function startShowdown(visitorId: string, bountyId: string): Promise<void> {
  const startedAt = new Date().toISOString();
  await db.insert(showdowns)
    .values({ visitorId, bountyId, startedAt })
    .onConflictDoUpdate({ target: [showdowns.visitorId, showdowns.bountyId], set: { startedAt } })
    .run();
}

export async function showdownStartedAt(visitorId: string, bountyId: string): Promise<number | null> {
  const row = await db.select({ startedAt: showdowns.startedAt })
    .from(showdowns)
    .where(and(eq(showdowns.visitorId, visitorId), eq(showdowns.bountyId, bountyId)))
    .get();
  return row ? Date.parse(row.startedAt) : null;
}

// True when the saved duel started after this bounty was collected. That is a replay
// the hunter has not closed. The original duel started before the claim.
// The replay duel is finished. The original claim, credits, and seal stay.
// The receipt lets a lost "already collected" response be retried after the row is gone.
export async function closeShowdown(visitorId: string, bountyId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(showdowns)
      .where(and(eq(showdowns.visitorId, visitorId), eq(showdowns.bountyId, bountyId)))
      .run();
    await tx.insert(replayReceipts)
      .values({ visitorId, bountyId })
      .onConflictDoNothing()
      .run();
    await tx.delete(duelShots)
      .where(and(eq(duelShots.visitorId, visitorId), eq(duelShots.bountyId, bountyId)))
      .run();
  });
}

export async function beginDraw(visitorId: string, bountyId: string): Promise<void> {
  const drawAt = new Date().toISOString();
  await db.insert(duelShots)
    .values({ visitorId, bountyId, drawAt, won: 0 })
    .onConflictDoUpdate({
      target: [duelShots.visitorId, duelShots.bountyId],
      set: { drawAt, won: 0 },
    })
    .run();
}

export async function showdownWon(visitorId: string, bountyId: string): Promise<boolean> {
  const row = await db.select({ won: duelShots.won })
    .from(duelShots)
    .where(and(eq(duelShots.visitorId, visitorId), eq(duelShots.bountyId, bountyId)))
    .get();
  return row?.won === 1;
}

export async function resolveShot(
  visitorId: string,
  bountyId: string,
  windowMs: number,
  graceMs: number,
  floorMs = 0,
): Promise<{ won: boolean; elapsed: number | null }> {
  const row = await db.select({ drawAt: duelShots.drawAt, won: duelShots.won })
    .from(duelShots)
    .where(and(eq(duelShots.visitorId, visitorId), eq(duelShots.bountyId, bountyId)))
    .get();
  if (!row) return { won: false, elapsed: null };
  if (row.won === 1) return { won: true, elapsed: null };
  const elapsed = Date.now() - Date.parse(row.drawAt);
  if (shotLands(elapsed, windowMs, graceMs, floorMs)) {
    await db.update(duelShots)
      .set({ won: 1 })
      .where(and(eq(duelShots.visitorId, visitorId), eq(duelShots.bountyId, bountyId)))
      .run();
    return { won: true, elapsed };
  }
  await db.delete(duelShots)
    .where(and(eq(duelShots.visitorId, visitorId), eq(duelShots.bountyId, bountyId)))
    .run();
  return { won: false, elapsed };
}

// A wrong name on a replay. Returns the strikes so far in this run.
export async function recordReplayStrike(visitorId: string, bountyId: string): Promise<number> {
  const row = await db.insert(caseRuns)
    .values({ visitorId, bountyId, runs: 0, strikes: 1 })
    .onConflictDoUpdate({ target: [caseRuns.visitorId, caseRuns.bountyId], set: { strikes: sql`${caseRuns.strikes} + 1` } })
    .returning({ strikes: caseRuns.strikes })
    .get();
  return row.strikes;
}

// 0 for a hunter's first run of a case; one more for each replay.
export async function caseRun(visitorId: string, bountyId: string): Promise<number> {
  const row = await db.select({ runs: caseRuns.runs })
    .from(caseRuns)
    .where(and(eq(caseRuns.visitorId, visitorId), eq(caseRuns.bountyId, bountyId)))
    .get();
  return row?.runs ?? 0;
}

export async function hasReplayReceipt(visitorId: string, bountyId: string): Promise<boolean> {
  const row = await db.select({ bountyId: replayReceipts.bountyId })
    .from(replayReceipts)
    .where(and(eq(replayReceipts.visitorId, visitorId), eq(replayReceipts.bountyId, bountyId)))
    .get();
  return !!row;
}

export async function replayDuelOpen(visitorId: string, bountyId: string): Promise<boolean> {
  const started = await showdownStartedAt(visitorId, bountyId);
  if (started === null) return false;
  const claim = await db.select({ createdAt: bountyClaims.createdAt })
    .from(bountyClaims)
    .where(and(eq(bountyClaims.visitorId, visitorId), eq(bountyClaims.bountyId, bountyId)))
    .get();
  return !!claim && started > Date.parse(claim.createdAt);
}
