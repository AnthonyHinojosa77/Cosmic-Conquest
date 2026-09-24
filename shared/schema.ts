import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Postcards from Space Tourism world
export const postcards = sqliteTable("postcards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorName: text("visitor_name").notNull(),
  destination: text("destination").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertPostcardSchema = createInsertSchema(postcards).omit({ id: true, createdAt: true }).extend({
  visitorName: z.string().min(1).max(50),
  destination: z.string().min(1).max(50),
  message: z.string().min(1).max(500),
});
export type InsertPostcard = z.infer<typeof insertPostcardSchema>;
export type Postcard = typeof postcards.$inferSelect;

// Time Capsule predictions from World's Fair
export const predictions = sqliteTable("predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorName: text("visitor_name").notNull(),
  prediction: text("prediction").notNull(),
  votes: integer("votes").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const insertPredictionSchema = createInsertSchema(predictions).omit({ id: true, votes: true, createdAt: true }).extend({
  visitorName: z.string().min(1).max(50),
  prediction: z.string().min(1).max(500),
});
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;

// Community menu items from Astro Diner
export const menuItems = sqliteTable("menu_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorName: text("visitor_name").notNull(),
  dishName: text("dish_name").notNull(),
  description: text("description").notNull(),
  votes: integer("votes").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true, votes: true, createdAt: true }).extend({
  visitorName: z.string().min(1).max(50),
  dishName: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
});
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

// Visitor log — tracks who visited which world
export const visitors = sqliteTable("visitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: text("visitor_id").notNull(),
  visitorName: text("visitor_name").notNull(),
  world: text("world").notNull(),
  action: text("action").notNull(),
  createdAt: text("created_at").notNull(),
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({ id: true, visitorId: true, createdAt: true }).extend({
  visitorName: z.string().min(1).max(50),
  world: z.string().min(1).max(50),
  action: z.string().min(1).max(50),
});
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;
// What the API returns: visitorId is the visitor's vote cookie and stays server-side.
export type PublicVisitor = Omit<Visitor, "visitorId">;

// Vote tracking — prevents duplicate votes per visitor
export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: text("visitor_id").notNull(),
  itemType: text("item_type").notNull(), // "prediction" | "menuItem"
  itemId: integer("item_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("votes_visitor_item_unique").on(table.visitorId, table.itemType, table.itemId),
]);

export const insertVoteSchema = createInsertSchema(votes).omit({ id: true }).extend({
  visitorId: z.string().min(1),
  itemType: z.enum(["prediction", "menuItem"]),
  itemId: z.number().int().positive(),
});
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
