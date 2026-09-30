import {
  type Postcard, type InsertPostcard, postcards,
  type Prediction, type InsertPrediction, predictions,
  type MenuItem, type InsertMenuItem, menuItems,
  type Visitor, type InsertVisitor, visitors,
  type Vote, type InsertVote, votes,
} from "../shared/schema";
import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { eq, desc, sql, and } from "drizzle-orm";

// Where the data lives. On a hosting platform without a disk (Vercel) it is a
// hosted libSQL/Turso database, named by DATABASE_URL (or the Vercel Turso
// integration's TURSO_DATABASE_URL); otherwise a local SQLite file, so `npm start`
// and the tests need no network.
const remoteUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

// The default client entry loads the native SQLite build (a platform-specific
// binary) even when only a remote URL is used; serverless bundlers can't trace
// that binary, so importing it there crashes the function. Hosted databases
// therefore go through the pure-JS web client over HTTPS, and only a local file
// loads the native one. Both are loaded on first use (see dbReady), so the choice
// is made at runtime and neither module is touched at startup. On Vercel with no
// URL configured, requests fail with a clear error instead of the function failing
// to start.
const useRemote = !!remoteUrl || !!process.env.VERCEL;
let client: Client | undefined;
let database: LibSQLDatabase | undefined;

async function connect(): Promise<void> {
  const [{ createClient }, { drizzle }] = useRemote
    ? await Promise.all([import("@libsql/client/web"), import("drizzle-orm/libsql/web")])
    : await Promise.all([import("@libsql/client"), import("drizzle-orm/libsql")]);
  if (useRemote && !remoteUrl) {
    console.error("No DATABASE_URL or TURSO_DATABASE_URL is set; every database call will fail until one is.");
  }
  client = useRemote
    ? createClient({ url: (remoteUrl ?? "https://database-not-configured.invalid").replace(/^libsql:\/\//, "https://"), authToken })
    : createClient({ url: `file:${process.env.DATABASE_PATH || "data.db"}` });
  database = drizzle(client);
}

// The database handle the rest of the server uses. It stands in for the real one,
// which exists once dbReady() has resolved (every /api request waits for that).
export const db: LibSQLDatabase = new Proxy({} as LibSQLDatabase, {
  get(_target, prop) {
    if (!database) throw new Error("Database used before dbReady() resolved");
    const value = Reflect.get(database, prop, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
// A query runner: the database itself, or the transaction a caller is already in.
export type Db = Pick<LibSQLDatabase, "select" | "insert" | "update" | "delete">;

// Create any missing tables on first use so databases created before a schema
// addition (e.g. `votes`) keep working without a manual `npm run db:push`.
// Keep in sync with shared/schema.ts (DDL matches what drizzle-kit push emits).
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS \`postcards\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_name\` text NOT NULL,
    \`destination\` text NOT NULL,
    \`message\` text NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`predictions\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_name\` text NOT NULL,
    \`prediction\` text NOT NULL,
    \`votes\` integer DEFAULT 0 NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`menu_items\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_name\` text NOT NULL,
    \`dish_name\` text NOT NULL,
    \`description\` text NOT NULL,
    \`votes\` integer DEFAULT 0 NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`visitors\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`visitor_name\` text NOT NULL,
    \`world\` text NOT NULL,
    \`action\` text NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`votes\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`item_type\` text NOT NULL,
    \`item_id\` integer NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE TABLE IF NOT EXISTS \`players\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`callsign\` text NOT NULL,
    \`credits\` integer DEFAULT 0 NOT NULL,
    \`suit\` text DEFAULT 'silver' NOT NULL,
    \`owned\` text DEFAULT '[]' NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS \`players_visitor_unique\` ON \`players\` (\`visitor_id\`);
  CREATE TABLE IF NOT EXISTS \`bounty_claims\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`bounty_id\` text NOT NULL,
    \`reward\` integer NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS \`bounty_claims_visitor_bounty_unique\` ON \`bounty_claims\` (\`visitor_id\`,\`bounty_id\`);
  CREATE TABLE IF NOT EXISTS \`player_items\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`item_id\` text NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS \`player_items_visitor_item_unique\` ON \`player_items\` (\`visitor_id\`,\`item_id\`);
  CREATE TABLE IF NOT EXISTS \`clue_finds\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`bounty_id\` text NOT NULL,
    \`clue_id\` text NOT NULL,
    \`created_at\` text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS \`clue_finds_visitor_bounty_clue_unique\` ON \`clue_finds\` (\`visitor_id\`,\`bounty_id\`,\`clue_id\`);
  CREATE TABLE IF NOT EXISTS \`showdowns\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`visitor_id\` text NOT NULL,
    \`bounty_id\` text NOT NULL,
    \`started_at\` text NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS \`showdowns_visitor_bounty_unique\` ON \`showdowns\` (\`visitor_id\`,\`bounty_id\`);
`;

let ready: Promise<void> | undefined;

// Resolves once the schema exists. Runs once per process (once per warm instance
// on serverless hosting); every request waits on it before touching the database.
export function dbReady(): Promise<void> {
  return (ready ??= (async () => {
    await connect();
    if (!useRemote) await client!.execute("PRAGMA journal_mode = WAL");
    await client!.executeMultiple(SCHEMA);
    // Enforce one vote per visitor per item at the database level. Kept separate so
    // a database holding duplicate rows from older code logs a warning instead of
    // failing to boot (the application-level check still applies).
    try {
      await client!.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS `votes_visitor_item_unique` ON `votes` (`visitor_id`,`item_type`,`item_id`)",
      );
    } catch (err) {
      console.warn("Could not create votes unique index (existing duplicate votes?):", err);
    }
  })());
}

// For the /health check: is the database answering?
export async function pingDb(): Promise<boolean> {
  try {
    await dbReady();
    await client!.execute("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

// On shutdown: close cleanly (a local file folds its write-ahead log back in).
export function closeDb(): void {
  client?.close();
}

export type VoteResult<T> =
  | { status: "ok"; item: T }
  | { status: "not_found" }
  | { status: "duplicate" };

export interface IStorage {
  // Postcards
  getPostcards(): Promise<Postcard[]>;
  createPostcard(postcard: InsertPostcard): Promise<Postcard>;

  // Predictions
  getPredictions(): Promise<Prediction[]>;
  createPrediction(prediction: InsertPrediction): Promise<Prediction>;
  votePrediction(id: number, visitorId: string): Promise<VoteResult<Prediction>>;

  // Menu items
  getMenuItems(): Promise<MenuItem[]>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  voteMenuItem(id: number, visitorId: string): Promise<VoteResult<MenuItem>>;

  // Visitors
  getRecentVisitors(world?: string): Promise<Visitor[]>;
  logVisitor(visitor: InsertVisitor, visitorId: string): Promise<Visitor>;

  // Votes
  hasVoted(visitorId: string, itemType: string, itemId: number): Promise<boolean>;
  recordVote(vote: InsertVote): Promise<Vote>;
}

export class DatabaseStorage implements IStorage {
  getPostcards(): Promise<Postcard[]> {
    return db.select().from(postcards).orderBy(desc(postcards.id)).all();
  }

  createPostcard(postcard: InsertPostcard): Promise<Postcard> {
    return db.insert(postcards).values({ ...postcard, createdAt: new Date().toISOString() }).returning().get();
  }

  getPredictions(): Promise<Prediction[]> {
    return db.select().from(predictions).orderBy(desc(predictions.votes)).all();
  }

  createPrediction(prediction: InsertPrediction): Promise<Prediction> {
    return db.insert(predictions).values({ ...prediction, createdAt: new Date().toISOString() }).returning().get();
  }

  votePrediction(id: number, visitorId: string): Promise<VoteResult<Prediction>> {
    return this.vote("prediction", id, visitorId, (tx) =>
      tx.update(predictions)
        .set({ votes: sql`${predictions.votes} + 1` })
        .where(eq(predictions.id, id))
        .returning()
        .get());
  }

  getMenuItems(): Promise<MenuItem[]> {
    return db.select().from(menuItems).orderBy(desc(menuItems.votes)).all();
  }

  createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    return db.insert(menuItems).values({ ...item, createdAt: new Date().toISOString() }).returning().get();
  }

  voteMenuItem(id: number, visitorId: string): Promise<VoteResult<MenuItem>> {
    return this.vote("menuItem", id, visitorId, (tx) =>
      tx.update(menuItems)
        .set({ votes: sql`${menuItems.votes} + 1` })
        .where(eq(menuItems.id, id))
        .returning()
        .get());
  }

  // One transaction: reject repeat voters, bump the counter (undefined if the
  // item doesn't exist), then record the vote. The unique index on votes backs
  // up the dedup check.
  private vote<T>(
    itemType: InsertVote["itemType"],
    itemId: number,
    visitorId: string,
    increment: (tx: Db) => Promise<T | undefined>,
  ): Promise<VoteResult<T>> {
    return db.transaction(async (tx) => {
      if (await this.hasVoted(visitorId, itemType, itemId, tx)) return { status: "duplicate" as const };
      const item = await increment(tx);
      if (!item) return { status: "not_found" as const };
      await this.recordVote({ visitorId, itemType, itemId, createdAt: new Date().toISOString() }, tx);
      return { status: "ok" as const, item };
    });
  }

  getRecentVisitors(world?: string): Promise<Visitor[]> {
    if (world) {
      return db.select().from(visitors)
        .where(eq(visitors.world, world))
        .orderBy(desc(visitors.id))
        .limit(20)
        .all();
    }
    return db.select().from(visitors)
      .orderBy(desc(visitors.id))
      .limit(20)
      .all();
  }

  logVisitor(visitor: InsertVisitor, visitorId: string): Promise<Visitor> {
    return db.insert(visitors).values({ ...visitor, visitorId, createdAt: new Date().toISOString() }).returning().get();
  }

  async hasVoted(visitorId: string, itemType: string, itemId: number, q: Db = db): Promise<boolean> {
    const result = await q.select().from(votes)
      .where(and(eq(votes.visitorId, visitorId), eq(votes.itemType, itemType), eq(votes.itemId, itemId)))
      .get();
    return !!result;
  }

  recordVote(vote: InsertVote, q: Db = db): Promise<Vote> {
    return q.insert(votes).values(vote).returning().get();
  }
}

export const storage = new DatabaseStorage();
