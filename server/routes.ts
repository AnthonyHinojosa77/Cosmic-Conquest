import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPostcardSchema, insertPredictionSchema, insertMenuItemSchema, insertVisitorSchema, type Visitor, type PublicVisitor } from "@shared/schema";
import { apiLimiter, writeLimiter, visitorIdentity } from "./middleware";
import { registerGameRoutes } from "./gameRoutes";
import { registerVoiceRoutes } from "./voice";

// visitorId is the visitor's rf_vid cookie value; never expose it publicly.
function publicVisitor({ visitorId: _visitorId, ...rest }: Visitor): PublicVisitor {
  return rest;
}

function parseItemId(raw: string | string[]): number | null {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Apply general API rate limiting to all /api routes
  app.use("/api", apiLimiter);
  app.use("/api", visitorIdentity);

  // === POSTCARDS (Space Tourism) ===
  app.get("/api/postcards", (_req, res) => {
    const postcards = storage.getPostcards();
    res.json(postcards);
  });

  app.post("/api/postcards", writeLimiter, (req, res) => {
    const parsed = insertPostcardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const postcard = storage.createPostcard(parsed.data);
    res.status(201).json(postcard);
  });

  // === PREDICTIONS (World's Fair) ===
  app.get("/api/predictions", (_req, res) => {
    const predictions = storage.getPredictions();
    res.json(predictions);
  });

  app.post("/api/predictions", writeLimiter, (req, res) => {
    const parsed = insertPredictionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const prediction = storage.createPrediction(parsed.data);
    res.status(201).json(prediction);
  });

  app.post("/api/predictions/:id/vote", writeLimiter, (req, res) => {
    const id = parseItemId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid ID" });
    const result = storage.votePrediction(id, req.visitorId!);
    if (result.status === "not_found") return res.status(404).json({ error: "Not found" });
    if (result.status === "duplicate") return res.status(409).json({ error: "Already voted" });
    res.json(result.item);
  });

  // === MENU ITEMS (Astro Diner) ===
  app.get("/api/menu-items", (_req, res) => {
    const items = storage.getMenuItems();
    res.json(items);
  });

  app.post("/api/menu-items", writeLimiter, (req, res) => {
    const parsed = insertMenuItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const item = storage.createMenuItem(parsed.data);
    res.status(201).json(item);
  });

  app.post("/api/menu-items/:id/vote", writeLimiter, (req, res) => {
    const id = parseItemId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid ID" });
    const result = storage.voteMenuItem(id, req.visitorId!);
    if (result.status === "not_found") return res.status(404).json({ error: "Not found" });
    if (result.status === "duplicate") return res.status(409).json({ error: "Already voted" });
    res.json(result.item);
  });

  // === VISITORS ===
  app.get("/api/visitors", (req, res) => {
    const world = req.query.world as string | undefined;
    const visitors = storage.getRecentVisitors(world);
    res.json(visitors.map(publicVisitor));
  });

  app.post("/api/visitors", writeLimiter, (req, res) => {
    const parsed = insertVisitorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const visitor = storage.logVisitor(parsed.data, req.visitorId!);
    res.status(201).json(publicVisitor(visitor));
  });

  registerGameRoutes(app);
  registerVoiceRoutes(app);

  return httpServer;
}
