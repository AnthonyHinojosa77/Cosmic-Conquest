import type { Express } from "express";
import { z } from "zod";
import { updatePlayerSchema } from "@shared/schema";
import { bountyById, itemAvailable } from "@shared/game";
import { gameLimiter } from "./middleware";
import { BOUNTY_SOLUTIONS } from "./bounties";
import { getProfile, updateProfile, claimBounty, buyItem, getLeaderboard, getStarMap, findItem } from "./gameStorage";

const accusationSchema = z.object({ suspect: z.string().min(1).max(50) });

export function registerGameRoutes(app: Express) {
  app.get("/api/player", (req, res) => {
    res.json(getProfile(req.visitorId!));
  });

  app.patch("/api/player", gameLimiter, (req, res) => {
    const parsed = updatePlayerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const result = updateProfile(req.visitorId!, parsed.data);
    if (result.status === "suit_not_owned") return res.status(403).json({ error: "You don't own that suit yet" });
    res.json(result.profile);
  });

  // Check an accusation without paying out (lets the client move on to the showdown).
  app.post("/api/bounties/:id/accuse", gameLimiter, (req, res) => {
    const bounty = bountyById(String(req.params.id));
    if (!bounty?.available) return res.status(404).json({ error: "No such bounty" });
    const parsed = accusationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const solution = BOUNTY_SOLUTIONS[bounty.id];
    if (solution?.suspect !== parsed.data.suspect) return res.json({ correct: false });
    res.json({ correct: true, showdown: solution.showdown, outro: solution.outro });
  });

  // Pay out a bounty once per player, only for the correct suspect.
  app.post("/api/bounties/:id/claim", gameLimiter, (req, res) => {
    const bounty = bountyById(String(req.params.id));
    if (!bounty?.available) return res.status(404).json({ error: "No such bounty" });
    const parsed = accusationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    if (BOUNTY_SOLUTIONS[bounty.id]?.suspect !== parsed.data.suspect) {
      return res.status(422).json({ error: "Wrong suspect" });
    }
    const result = claimBounty(req.visitorId!, bounty.id, bounty.reward);
    if (result.status === "already_claimed") return res.status(409).json({ error: "Bounty already collected" });
    res.json(result.profile);
  });

  app.post("/api/shop/:itemId/buy", gameLimiter, (req, res) => {
    const result = buyItem(req.visitorId!, String(req.params.itemId));
    if (result.status === "not_found") return res.status(404).json({ error: "No such item" });
    if (result.status === "already_owned") return res.status(409).json({ error: "You already own that" });
    if (result.status === "insufficient_credits") return res.status(402).json({ error: "Not enough credits" });
    res.json(result.profile);
  });

  app.get("/api/leaderboard", (_req, res) => {
    res.json(getLeaderboard());
  });

  // Honor system, like clues: any item a live bounty hands out can be picked up.
  app.post("/api/items/:itemId/find", gameLimiter, (req, res) => {
    const itemId = String(req.params.itemId);
    if (!itemAvailable(itemId)) return res.status(404).json({ error: "No such item" });
    res.json(findItem(req.visitorId!, itemId));
  });

  app.get("/api/star-map", (_req, res) => {
    res.json(getStarMap());
  });
}
