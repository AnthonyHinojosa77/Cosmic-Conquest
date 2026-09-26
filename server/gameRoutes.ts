import type { Express } from "express";
import { z } from "zod";
import { updatePlayerSchema } from "@shared/schema";
import {
  bountyById,
  cluesNeeded,
  shiftLetters,
  invitedToAurelia,
  fragmentsFor,
  AURELIA_INVITE_FRAGMENTS,
  type Bounty,
  type BountyProgress,
  type ClueSearch,
} from "@shared/game";
import { aureliaFor } from "./aurelia";
import { gameLimiter, clueLimiter } from "./middleware";
import { BOUNTY_SOLUTIONS, CLUES, TESTIMONY } from "./bounties";
import {
  getProfile,
  updateProfile,
  claimBounty,
  buyItem,
  getLeaderboard,
  getStarMap,
  grantItem,
  hasItem,
  recordClue,
  foundClues,
  startShowdown,
  showdownStartedAt,
} from "./gameStorage";

const accusationSchema = z.object({ suspect: z.string().min(1).max(50) });
const decodeSchema = z.object({ key: z.number().int().min(0).max(25) });
const unlockSchema = z.object({ code: z.string().regex(/^[0-9]{1,6}$/) });
const presentSchema = z.object({ clue: z.string().min(1).max(50) });

// The quick-draw can't end sooner than the shortest possible wait for DRAW!.
// (SHOWDOWN_MIN_MS only exists so tests can shorten it; a bad value falls back.)
const envMin = Number(process.env.SHOWDOWN_MIN_MS);
const SHOWDOWN_MIN_MS = Number.isFinite(envMin) && envMin >= 0 ? envMin : 1500;

export function liveBounty(id: unknown): Bounty | undefined {
  const bounty = bountyById(String(id));
  return bounty?.available ? bounty : undefined;
}

export function clueOf(bounty: Bounty, clueId: string) {
  const clue = bounty.locations?.flatMap((l) => l.clues).find((c) => c.id === clueId);
  const secret = CLUES[bounty.id]?.[clueId];
  return clue && secret ? { clue, secret } : undefined;
}

// A topic the hunter may ask about right now, with what the suspect says.
function topicOf(found: string[], bounty: Bounty, suspect: string, topicId: string) {
  const topic = bounty.interviews?.find((i) => i.suspect === suspect)?.topics.find((t) => t.id === topicId);
  const said = TESTIMONY[bounty.id]?.[suspect]?.[topicId];
  if (!topic || !said) return { status: "missing" as const };
  if (topic.after && !found.includes(topic.after)) return { status: "locked" as const };
  return { status: "ok" as const, said };
}

// Text for everything a hunter has found: clues and breakthroughs (caught lies).
function textOf(bountyId: string, id: string): string | undefined {
  const clue = CLUES[bountyId]?.[id]?.text;
  if (clue) return clue;
  for (const topics of Object.values(TESTIMONY[bountyId] ?? {})) {
    for (const said of Object.values(topics)) if (said.breakthrough?.id === id) return said.breakthrough.text;
  }
  return undefined;
}

function progressOf(visitorId: string, bounty: Bounty): BountyProgress {
  const found: Record<string, string> = {};
  const ids = foundClues(visitorId, bounty.id);
  for (const id of ids) {
    const text = textOf(bounty.id, id);
    if (text) found[id] = text;
  }
  // Which statements were caught (only once caught, so this reveals nothing new)
  const caught: Record<string, string> = {};
  for (const [suspect, topics] of Object.entries(TESTIMONY[bounty.id] ?? {})) {
    for (const [topic, said] of Object.entries(topics)) {
      if (said.breakthrough && ids.includes(said.breakthrough.id)) caught[`${suspect}/${topic}`] = said.breakthrough.id;
    }
  }
  const solution = BOUNTY_SOLUTIONS[bounty.id];
  const accused = showdownStartedAt(visitorId, bounty.id) !== null;
  return {
    found,
    ...(Object.keys(caught).length ? { caught } : {}),
    ...(accused && solution
      ? { accused: { suspect: solution.suspect, showdown: solution.showdown, outro: solution.outro } }
      : {}),
  };
}

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

  // What this hunter has found so far (survives a page refresh).
  app.get("/api/bounties/:id/progress", (req, res) => {
    const bounty = liveBounty(req.params.id);
    if (!bounty) return res.status(404).json({ error: "No such bounty" });
    res.json(progressOf(req.visitorId!, bounty));
  });

  // Search a spot: the server records the find and hands over the clue (and any item).
  app.post("/api/bounties/:id/clues/:clueId/search", clueLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    const found = bounty && clueOf(bounty, String(req.params.clueId));
    if (!bounty || !found) return res.status(404).json({ error: "Nothing to find there" });
    const { clue, secret } = found;
    if (clue.grants) grantItem(req.visitorId!, clue.grants);
    if (clue.lock || secret.code !== undefined) {
      // Locked: it counts as found once opened.
      const result: ClueSearch = { locked: true };
      return res.json(result);
    }
    if (secret.key !== undefined) {
      // Coded: only the scrambled text; it counts as found once decoded.
      const result: ClueSearch = { coded: shiftLetters(secret.text, secret.key) };
      return res.json(result);
    }
    recordClue(req.visitorId!, bounty.id, clue.id);
    const result: ClueSearch = { text: secret.text };
    res.json(result);
  });

  // Decode a coded clue: needs the right tool in the satchel and the right key.
  app.post("/api/bounties/:id/clues/:clueId/decode", clueLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    const found = bounty && clueOf(bounty, String(req.params.clueId));
    if (!bounty || !found || found.secret.key === undefined || !found.clue.cipher) {
      return res.status(404).json({ error: "Nothing to decode there" });
    }
    const parsed = decodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    if (!hasItem(req.visitorId!, found.clue.cipher.requires)) {
      return res.status(403).json({ error: "You need something to decode it with" });
    }
    if (parsed.data.key !== found.secret.key) return res.json({ correct: false });
    recordClue(req.visitorId!, bounty.id, found.clue.id);
    res.json({ correct: true, text: found.secret.text });
  });

  // Open a combination lock: needs the clues that reveal the combination, then the right code.
  app.post("/api/bounties/:id/clues/:clueId/unlock", clueLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    const found = bounty && clueOf(bounty, String(req.params.clueId));
    if (!bounty || !found || found.secret.code === undefined || !found.clue.lock) {
      return res.status(404).json({ error: "Nothing to unlock there" });
    }
    const parsed = unlockSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const have = foundClues(req.visitorId!, bounty.id);
    if (!(found.secret.needs ?? []).every((id) => have.includes(id))) {
      return res.status(409).json({ error: "You don't know the combination yet. Keep searching." });
    }
    if (parsed.data.code !== found.secret.code) return res.json({ correct: false });
    recordClue(req.visitorId!, bounty.id, found.clue.id);
    res.json({ correct: true, text: found.secret.text });
  });

  // Question a suspect about a topic.
  app.post("/api/bounties/:id/suspects/:suspect/ask/:topic", clueLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    if (!bounty) return res.status(404).json({ error: "No such bounty" });
    const found = foundClues(req.visitorId!, bounty.id);
    const t = topicOf(found, bounty, String(req.params.suspect), String(req.params.topic));
    if (t.status === "missing") return res.status(404).json({ error: "They have nothing to say about that" });
    if (t.status === "locked") return res.status(409).json({ error: "Find more clues before you ask about that" });
    res.json({ text: t.said.text });
  });

  // Present a found clue against what a suspect said. The right clue against a lie
  // is a breakthrough, recorded like a clue.
  app.post("/api/bounties/:id/suspects/:suspect/ask/:topic/present", clueLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    if (!bounty) return res.status(404).json({ error: "No such bounty" });
    const parsed = presentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const found = foundClues(req.visitorId!, bounty.id);
    const t = topicOf(found, bounty, String(req.params.suspect), String(req.params.topic));
    if (t.status === "missing") return res.status(404).json({ error: "They have nothing to say about that" });
    if (t.status === "locked") return res.status(409).json({ error: "Find more clues before you ask about that" });
    if (!found.includes(parsed.data.clue)) {
      return res.status(409).json({ error: "You haven't found that clue" });
    }
    const { breakthrough, caughtBy } = t.said;
    if (!breakthrough || !caughtBy?.includes(parsed.data.clue)) return res.json({ correct: false });
    recordClue(req.visitorId!, bounty.id, breakthrough.id);
    res.json({ correct: true, id: breakthrough.id, text: breakthrough.text });
  });

  // Name a suspect. Needs enough clues on record; a correct guess starts the showdown clock.
  app.post("/api/bounties/:id/accuse", gameLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    if (!bounty) return res.status(404).json({ error: "No such bounty" });
    const parsed = accusationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    if (foundClues(req.visitorId!, bounty.id).length < cluesNeeded(bounty)) {
      return res.status(409).json({ error: "Find more clues before you name anyone" });
    }
    const solution = BOUNTY_SOLUTIONS[bounty.id];
    if (solution?.suspect !== parsed.data.suspect) return res.json({ correct: false });
    startShowdown(req.visitorId!, bounty.id);
    res.json({ correct: true, showdown: solution.showdown, outro: solution.outro });
  });

  // Pay out once per hunter, only after a correct accusation and a real showdown.
  app.post("/api/bounties/:id/claim", gameLimiter, (req, res) => {
    const bounty = liveBounty(req.params.id);
    if (!bounty) return res.status(404).json({ error: "No such bounty" });
    const parsed = accusationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    if (BOUNTY_SOLUTIONS[bounty.id]?.suspect !== parsed.data.suspect) {
      return res.status(422).json({ error: "Wrong suspect" });
    }
    const started = showdownStartedAt(req.visitorId!, bounty.id);
    if (started === null) return res.status(409).json({ error: "Name the culprit before you collect" });
    if (Date.now() - started < SHOWDOWN_MIN_MS) return res.status(409).json({ error: "Win the showdown first" });
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

  // Aurelia is invitation-only: the doormen check the hunter's record.
  app.get("/api/aurelia", (req, res) => {
    const profile = getProfile(req.visitorId!);
    if (!invitedToAurelia(profile.completedBounties)) {
      return res.status(403).json({
        error: "Your name isn't on the list",
        have: fragmentsFor(profile.completedBounties).length,
        needed: AURELIA_INVITE_FRAGMENTS,
      });
    }
    res.json(aureliaFor(profile.callsign, profile.completedBounties));
  });

  app.get("/api/star-map", (_req, res) => {
    res.json(getStarMap());
  });
}
