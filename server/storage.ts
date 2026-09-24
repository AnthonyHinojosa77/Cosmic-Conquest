import {
  type Postcard, type InsertPostcard, postcards,
  type Prediction, type InsertPrediction, predictions,
  type MenuItem, type InsertMenuItem, menuItems,
  type Visitor, type InsertVisitor, visitors,
  type Vote, type InsertVote, votes,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, sql, and } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export type VoteResult<T> =
  | { status: "ok"; item: T }
  | { status: "not_found" }
  | { status: "duplicate" };

export interface IStorage {
  // Postcards
  getPostcards(): Postcard[];
  createPostcard(postcard: InsertPostcard): Postcard;

  // Predictions
  getPredictions(): Prediction[];
  createPrediction(prediction: InsertPrediction): Prediction;
  votePrediction(id: number, visitorId: string): VoteResult<Prediction>;

  // Menu items
  getMenuItems(): MenuItem[];
  createMenuItem(item: InsertMenuItem): MenuItem;
  voteMenuItem(id: number, visitorId: string): VoteResult<MenuItem>;

  // Visitors
  getRecentVisitors(world?: string): Visitor[];
  logVisitor(visitor: InsertVisitor): Visitor;

  // Votes
  hasVoted(visitorId: string, itemType: string, itemId: number): boolean;
  recordVote(vote: InsertVote): Vote;
}

export class DatabaseStorage implements IStorage {
  getPostcards(): Postcard[] {
    return db.select().from(postcards).orderBy(desc(postcards.id)).all();
  }

  createPostcard(postcard: InsertPostcard): Postcard {
    return db.insert(postcards).values(postcard).returning().get();
  }

  getPredictions(): Prediction[] {
    return db.select().from(predictions).orderBy(desc(predictions.votes)).all();
  }

  createPrediction(prediction: InsertPrediction): Prediction {
    return db.insert(predictions).values(prediction).returning().get();
  }

  votePrediction(id: number, visitorId: string): VoteResult<Prediction> {
    return db.transaction(() => {
      const existing = db.select().from(predictions).where(eq(predictions.id, id)).get();
      if (!existing) return { status: "not_found" as const };
      if (this.hasVoted(visitorId, "prediction", id)) return { status: "duplicate" as const };
      this.recordVote({ visitorId, itemType: "prediction", itemId: id, createdAt: new Date().toISOString() });
      const item = db.update(predictions)
        .set({ votes: sql`${predictions.votes} + 1` })
        .where(eq(predictions.id, id))
        .returning()
        .get();
      return { status: "ok" as const, item };
    });
  }

  getMenuItems(): MenuItem[] {
    return db.select().from(menuItems).orderBy(desc(menuItems.votes)).all();
  }

  createMenuItem(item: InsertMenuItem): MenuItem {
    return db.insert(menuItems).values(item).returning().get();
  }

  voteMenuItem(id: number, visitorId: string): VoteResult<MenuItem> {
    return db.transaction(() => {
      const existing = db.select().from(menuItems).where(eq(menuItems.id, id)).get();
      if (!existing) return { status: "not_found" as const };
      if (this.hasVoted(visitorId, "menuItem", id)) return { status: "duplicate" as const };
      this.recordVote({ visitorId, itemType: "menuItem", itemId: id, createdAt: new Date().toISOString() });
      const item = db.update(menuItems)
        .set({ votes: sql`${menuItems.votes} + 1` })
        .where(eq(menuItems.id, id))
        .returning()
        .get();
      return { status: "ok" as const, item };
    });
  }

  getRecentVisitors(world?: string): Visitor[] {
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

  logVisitor(visitor: InsertVisitor): Visitor {
    return db.insert(visitors).values(visitor).returning().get();
  }

  hasVoted(visitorId: string, itemType: string, itemId: number): boolean {
    const result = db.select().from(votes)
      .where(and(eq(votes.visitorId, visitorId), eq(votes.itemType, itemType), eq(votes.itemId, itemId)))
      .get();
    return !!result;
  }

  recordVote(vote: InsertVote): Vote {
    return db.insert(votes).values(vote).returning().get();
  }
}

export const storage = new DatabaseStorage();
