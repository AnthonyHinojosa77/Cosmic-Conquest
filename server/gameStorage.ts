import { createHash } from "crypto";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { players, bountyClaims, playerItems, clueFinds, showdowns, type Player } from "../shared/schema";
import {
  DEFAULT_SUIT,
  ownsSuit,
  shopItem,
  suitForItem,
  BOUNTIES,
  STAR_MAP_SIZE,
  type PlayerProfile,
  type LeaderboardEntry,
  type StarMapStatus,
  type ItemId,
  type ShopItemId,
  type SuitId,
} from "../shared/game";
import { db, type Db } from "./storage";

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

async function itemsOf(visitorId: string, q: Db = db): Promise<ItemId[]> {
  const rows = await q.select({ itemId: playerItems.itemId })
    .from(playerItems)
    .where(eq(playerItems.visitorId, visitorId))
    .all();
  return rows.map((r) => r.itemId as ItemId);
}

async function toProfile(player: Player, q: Db = db): Promise<PlayerProfile> {
  return {
    callsign: player.callsign,
    credits: player.credits,
    suit: player.suit as SuitId,
    owned: parseOwned(player.owned),
    completedBounties: await completedBounties(player.visitorId, q),
    items: await itemsOf(player.visitorId, q),
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
  return { callsign: defaultCallsign(visitorId), credits: 0, suit: DEFAULT_SUIT, owned: [], completedBounties: [], items: await itemsOf(visitorId) };
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
    await tx.insert(bountyClaims).values({ visitorId, bountyId, reward, createdAt: new Date().toISOString() }).run();
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

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await db.select({
    callsign: players.callsign,
    earned: sql<number>`sum(${bountyClaims.reward})`,
    bounties: sql<number>`count(${bountyClaims.id})`,
    firstClaim: sql<string>`min(${bountyClaims.createdAt})`,
  })
    .from(bountyClaims)
    .innerJoin(players, eq(players.visitorId, bountyClaims.visitorId))
    .groupBy(players.id)
    .orderBy(desc(sql`sum(${bountyClaims.reward})`), sql`min(${bountyClaims.createdAt})`)
    .limit(limit)
    .all();
  return rows.map(({ callsign, earned, bounties }) => ({ callsign, earned, bounties }));
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
