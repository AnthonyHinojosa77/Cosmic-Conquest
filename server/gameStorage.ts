import { createHash } from "crypto";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { players, bountyClaims, playerItems, clueFinds, showdowns, type Player } from "@shared/schema";
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
} from "@shared/game";
import { db } from "./storage";

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

function completedBounties(visitorId: string): string[] {
  return db.select({ bountyId: bountyClaims.bountyId })
    .from(bountyClaims)
    .where(eq(bountyClaims.visitorId, visitorId))
    .all()
    .map((r) => r.bountyId);
}

function itemsOf(visitorId: string): ItemId[] {
  return db.select({ itemId: playerItems.itemId })
    .from(playerItems)
    .where(eq(playerItems.visitorId, visitorId))
    .all()
    .map((r) => r.itemId as ItemId);
}

function toProfile(player: Player): PlayerProfile {
  return {
    callsign: player.callsign,
    credits: player.credits,
    suit: player.suit as SuitId,
    owned: parseOwned(player.owned),
    completedBounties: completedBounties(player.visitorId),
    items: itemsOf(player.visitorId),
  };
}

function findPlayer(visitorId: string): Player | undefined {
  return db.select().from(players).where(eq(players.visitorId, visitorId)).get();
}

// Players are created lazily on their first write, so browsing never adds rows.
function ensurePlayer(visitorId: string): Player {
  return findPlayer(visitorId) ?? db.insert(players).values({
    visitorId,
    callsign: defaultCallsign(visitorId),
    credits: 0,
    suit: DEFAULT_SUIT,
    owned: "[]",
    createdAt: new Date().toISOString(),
  }).returning().get();
}

export function getProfile(visitorId: string): PlayerProfile {
  const player = findPlayer(visitorId);
  if (player) return toProfile(player);
  return { callsign: defaultCallsign(visitorId), credits: 0, suit: DEFAULT_SUIT, owned: [], completedBounties: [], items: itemsOf(visitorId) };
}

export type UpdateResult = { status: "ok"; profile: PlayerProfile } | { status: "suit_not_owned" };

export function updateProfile(visitorId: string, changes: { callsign?: string; suit?: SuitId }): UpdateResult {
  return db.transaction(() => {
    const player = ensurePlayer(visitorId);
    const owned = parseOwned(player.owned);
    if (changes.suit && !ownsSuit(owned, changes.suit)) {
      return { status: "suit_not_owned" as const };
    }
    const updated = db.update(players)
      .set({
        ...(changes.callsign !== undefined ? { callsign: changes.callsign } : {}),
        ...(changes.suit !== undefined ? { suit: changes.suit } : {}),
      })
      .where(eq(players.id, player.id))
      .returning()
      .get();
    return { status: "ok" as const, profile: toProfile(updated) };
  });
}

export type ClaimResult = { status: "ok"; profile: PlayerProfile } | { status: "already_claimed" };

export function claimBounty(visitorId: string, bountyId: string, reward: number): ClaimResult {
  return db.transaction(() => {
    const player = ensurePlayer(visitorId);
    if (completedBounties(visitorId).includes(bountyId)) return { status: "already_claimed" as const };
    db.insert(bountyClaims).values({ visitorId, bountyId, reward, createdAt: new Date().toISOString() }).run();
    const updated = db.update(players)
      .set({ credits: sql`${players.credits} + ${reward}` })
      .where(eq(players.id, player.id))
      .returning()
      .get();
    return { status: "ok" as const, profile: toProfile(updated) };
  });
}

export type BuyResult =
  | { status: "ok"; profile: PlayerProfile }
  | { status: "not_found" }
  | { status: "already_owned" }
  | { status: "insufficient_credits" };

export function buyItem(visitorId: string, itemId: string): BuyResult {
  const item = shopItem(itemId);
  if (!item) return { status: "not_found" };
  return db.transaction(() => {
    const player = ensurePlayer(visitorId);
    const owned = parseOwned(player.owned);
    if (owned.includes(item.id)) return { status: "already_owned" as const };
    if (player.credits < item.price) return { status: "insufficient_credits" as const };
    const suit = suitForItem(item.id);
    const updated = db.update(players)
      .set({
        credits: player.credits - item.price,
        owned: JSON.stringify([...owned, item.id]),
        // Put on a newly bought suit right away
        ...(suit ? { suit } : {}),
      })
      .where(eq(players.id, player.id))
      .returning()
      .get();
    return { status: "ok" as const, profile: toProfile(updated) };
  });
}

export function getLeaderboard(limit = 10): LeaderboardEntry[] {
  return db.select({
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
    .all()
    .map(({ callsign, earned, bounties }) => ({ callsign, earned, bounties }));
}

export function getStarMap(): StarMapStatus {
  const withFragment = BOUNTIES.filter((b) => b.fragment);
  const ids = withFragment.map((b) => b.id);
  if (ids.length === 0) return { total: STAR_MAP_SIZE, fragments: [], searchers: 0 };
  // One read transaction so the per-fragment counts and the searcher total agree.
  return db.transaction(() => {
    // One claim per hunter per bounty (unique index), so count(*) is distinct hunters.
    const counts = new Map(
      db.select({ bountyId: bountyClaims.bountyId, hunters: sql<number>`count(*)` })
        .from(bountyClaims)
        .where(inArray(bountyClaims.bountyId, ids))
        .groupBy(bountyClaims.bountyId)
        .all()
        .map((r) => [r.bountyId, r.hunters]),
    );
    const searchers = db.select({ n: sql<number>`count(distinct ${bountyClaims.visitorId})` })
      .from(bountyClaims)
      .where(inArray(bountyClaims.bountyId, ids))
      .get()?.n ?? 0;
    return {
      total: STAR_MAP_SIZE,
      fragments: withFragment.map((b) => ({ id: b.fragment!.id, hunters: counts.get(b.id) ?? 0 })),
      searchers,
    };
  });
}

// Put an item in the hunter's satchel (idempotent). Doesn't create a player row.
export function grantItem(visitorId: string, itemId: ItemId) {
  db.insert(playerItems)
    .values({ visitorId, itemId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}

export function hasItem(visitorId: string, itemId: ItemId): boolean {
  return itemsOf(visitorId).includes(itemId);
}

// --- Bounty progress (the server is the referee) ---------------------------

export function recordClue(visitorId: string, bountyId: string, clueId: string) {
  db.insert(clueFinds)
    .values({ visitorId, bountyId, clueId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}

export function foundClues(visitorId: string, bountyId: string): string[] {
  return db.select({ clueId: clueFinds.clueId })
    .from(clueFinds)
    .where(and(eq(clueFinds.visitorId, visitorId), eq(clueFinds.bountyId, bountyId)))
    .all()
    .map((r) => r.clueId);
}

// (Re)start the showdown clock after a correct accusation.
export function startShowdown(visitorId: string, bountyId: string) {
  const startedAt = new Date().toISOString();
  db.insert(showdowns)
    .values({ visitorId, bountyId, startedAt })
    .onConflictDoUpdate({ target: [showdowns.visitorId, showdowns.bountyId], set: { startedAt } })
    .run();
}

export function showdownStartedAt(visitorId: string, bountyId: string): number | null {
  const row = db.select({ startedAt: showdowns.startedAt })
    .from(showdowns)
    .where(and(eq(showdowns.visitorId, visitorId), eq(showdowns.bountyId, bountyId)))
    .get();
  return row ? Date.parse(row.startedAt) : null;
}
