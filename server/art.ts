import type { Express } from "express";
import path from "path";
import fs from "fs";
import { liveBounty } from "./gameRoutes.js";
import { showdownStartedAt } from "./gameStorage.js";

// The villain's showdown pose shows who the culprit is, so, like the voice lines,
// it lives outside the public folder (art/showdown/<bounty id>.webp, named by case
// rather than by suspect) and is only served once the hunter has named the right
// suspect. A public file named after the suspect would let anyone find the culprit
// by asking for each suspect's picture and seeing which one exists.
const ART_DIR = path.resolve(process.env.ART_DIR ?? path.join(process.cwd(), "art"));

export function registerArtRoutes(app: Express) {
  app.get("/api/art/showdown/:bounty", async (req, res) => {
    const bounty = liveBounty(req.params.bounty);
    if (!bounty || (await showdownStartedAt(req.visitorId!, bounty.id)) === null) return res.status(404).end();
    const file = path.join(ART_DIR, "showdown", `${bounty.id}.webp`);
    if (!fs.existsSync(file)) return res.status(404).end();
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.sendFile(file);
  });
}
