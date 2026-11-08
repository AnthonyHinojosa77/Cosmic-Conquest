import type { Express, Request, Response } from "express";
import { z } from "zod";
import { updatePlayerSchema } from "../shared/schema.js";
import {
  SHOT_FLOOR_MS,
  bountyById,
  cluesNeeded,
  accusationCount,
  shiftLetters,
  invitedToAurelia,
  fragmentsFor,
  AURELIA_INVITE_FRAGMENTS,
  onChart,
  claimWithoutShowdown,
  drawWindowMs,
  type Bounty,
  type BountyProgress,
  type ClueSearch,
} from "../shared/game.js";
import { aureliaFor } from "./aurelia.js";
import { gameLimiter, clueLimiter } from "./middleware.js";
import { secretFor, solutionFor, testimonyFor, type Solution } from "./bounties.js";
import {
  getProfile,
  updateProfile,
  claimBounty,
  buyItem,
  getLeaderboard,
  getStarMap,
  getWire,
  grantItem,
  hasItem,
  recordClue,
  foundClues,
  startShowdown,
  showdownStartedAt,
  replayDuelOpen,
  canAccessBounty,
  recordWrongAccusation,
  replayInvestigation,
  closeShowdown,
  hasReplayReceipt,
  beginDraw,
  showdownWon,
  resolveShot,
  caseRun,
  recordReplayStrike,
} from "./gameStorage.js";

const accusationSchema = z.object({
  suspect: z.string().min(1).max(40),
  proof: z.string().min(1).max(40),
  // Cases with two evidence questions send the second answer here.
  proof2: z.string().min(1).max(40).optional(),
});
const claimSchema = z.object({ suspect: z.string().min(1).max(40) });
const decodeSchema = z.object({ key: z.number().int().min(0).max(25) });
// A lock's digits, or a square on a sea chart ("C3")
const unlockSchema = z.object({ code: z.string().regex(/^[0-9]{1,6}$|^[A-Z][1-9][0-9]?$/) });
const presentSchema = z.object({ clue: z.string().min(1).max(50) });

// The quick-draw can't end sooner than the shortest possible wait for DRAW!.
// (SHOWDOWN_MIN_MS only exists so tests can shorten it; a bad value falls back.)
const envMin = Number(process.env.SHOWDOWN_MIN_MS);
const SHOWDOWN_MIN_MS = Number.isFinite(envMin) && envMin >= 0 ? envMin : 1500;
const SHOT_GRACE_MS = 1000;
const REPLAY_STRIKES = 3;


export function liveBounty(id: unknown): Bounty | undefined {
  const bounty = bountyById(String(id));
  return bounty?.available ? bounty : undefined;
}

// A live bounty this hunter may work on, or the error response is sent (404 / 403).
async function openBounty(req: Request, res: Response, missing = "No such bounty"): Promise<Bounty | undefined> {
  const bounty = liveBounty(req.params.id);
  if (!bounty) {
    res.status(404).json({ error: missing });
    return undefined;
  }
  if (!(await canAccessBounty(req.visitorId!, bounty))) {
    res.status(403).json({ error: "Complete earlier contracts first" });
    return undefined;
  }
  return bounty;
}

// A clue and its secret for this run of the case (replays move puzzles to new answers).
export function clueOf(bounty: Bounty, clueId: string, run = 0) {
  const clue = bounty.locations?.flatMap((l) => l.clues).find((c) => c.id === clueId);
  const secret = secretFor(bounty.id, clueId, run);
  return clue && secret ? { clue, secret } : undefined;
}

// One clue from each group answers the case's two questions (in either order).
// A case with one question takes any single piece of proof.
export function proofHolds(solution: Solution, proof: string, proof2?: string): boolean {
  if (!solution.proofGroups) return solution.proof.includes(proof);
  const [a, b] = solution.proofGroups;
  return proof2 !== undefined && ((a.includes(proof) && b.includes(proof2)) || (b.includes(proof) && a.includes(proof2)));
}

// A topic the hunter may ask about right now, with what the suspect says.
function topicOf(found: string[], bounty: Bounty, suspect: string, topicId: string, run: number) {
  const topic = bounty.interviews?.find((i) => i.suspect === suspect)?.topics.find((t) => t.id === topicId);
  const said = testimonyFor(bounty.id, run)?.[suspect]?.[topicId];
  if (!topic || !said) return { status: "missing" as const };
  if (topic.after && !found.includes(topic.after)) return { status: "locked" as const };
  return { status: "ok" as const, said };
}

// Text for everything a hunter has found: clues and breakthroughs (caught lies).
function textOf(bountyId: string, id: string, run: number): string | undefined {
  const clue = secretFor(bountyId, id, run)?.text;
  if (clue) return clue;
  for (const topics of Object.values(testimonyFor(bountyId, run) ?? {})) {
    for (const said of Object.values(topics)) if (said.breakthrough?.id === id) return said.breakthrough.text;
  }
  return undefined;
}

async function progressOf(visitorId: string, bounty: Bounty): Promise<BountyProgress> {
  const found: Record<string, string> = {};
  const ids = await foundClues(visitorId, bounty.id);
  const run = await caseRun(visitorId, bounty.id);
  for (const id of ids) {
    const text = textOf(bounty.id, id, run);
    if (text) found[id] = text;
  }
  // Which statements were caught (only once caught, so this reveals nothing new)
  const caught: Record<string, string> = {};
  for (const [suspect, topics] of Object.entries(testimonyFor(bounty.id, run) ?? {})) {
    for (const [topic, said] of Object.entries(topics)) {
      if (said.breakthrough && ids.includes(said.breakthrough.id)) caught[`${suspect}/${topic}`] = said.breakthrough.id;
    }
  }
  const solution = solutionFor(bounty.id, run);
  const accused = (await showdownStartedAt(visitorId, bounty.id)) !== null;
  const replayDuel = accused && await replayDuelOpen(visitorId, bounty.id);
  const needsLie = (solution?.beforeAccusation ?? []).some((id) => !ids.includes(id));
  const counted = accusationCount(bounty, ids, solution?.beforeAccusation);
  const canAccuse = counted >= cluesNeeded(bounty) && !needsLie;
  return {
    found,
    canAccuse,
    needsLie,
    counted,
    replayDuel,
    ...(Object.keys(caught).length ? { caught } : {}),
    ...(accused && solution
      ? { accused: { suspect: solution.suspect, showdown: solution.showdown, outro: solution.outro } }
      : {}),
  };
}

export function registerGameRoutes(app: Express) {
  app.get("/api/player", async (req, res) => {
    res.json(await getProfile(req.visitorId!));
  });

  app.patch("/api/player", gameLimiter, async (req, res) => {
    const parsed = updatePlayerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const result = await updateProfile(req.visitorId!, parsed.data);
    if (result.status === "suit_not_owned") return res.status(403).json({ error: "You don't own that suit yet" });
    res.json(result.profile);
  });

  // What this hunter has found so far (survives a page refresh).
  app.get("/api/bounties/:id/progress", async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    res.json(await progressOf(req.visitorId!, bounty));
  });

  // Search a spot: the server records the find and hands over the clue (and any item).
  app.post("/api/bounties/:id/clues/:clueId/search", clueLimiter, async (req, res) => {
    const bounty = await openBounty(req, res, "Nothing to find there");
    if (!bounty) return;
    const found = clueOf(bounty, String(req.params.clueId), await caseRun(req.visitorId!, bounty.id));
    if (!found) return res.status(404).json({ error: "Nothing to find there" });
    const { clue, secret } = found;
    if (clue.grants) await grantItem(req.visitorId!, clue.grants);
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
    await recordClue(req.visitorId!, bounty.id, clue.id);
    const result: ClueSearch = { text: secret.text };
    res.json(result);
  });

  // Decode a coded clue: needs the right tool in the satchel and the right key.
  app.post("/api/bounties/:id/clues/:clueId/decode", clueLimiter, async (req, res) => {
    const bounty = await openBounty(req, res, "Nothing to decode there");
    if (!bounty) return;
    const found = clueOf(bounty, String(req.params.clueId), await caseRun(req.visitorId!, bounty.id));
    if (!found || found.secret.key === undefined || !found.clue.cipher) {
      return res.status(404).json({ error: "Nothing to decode there" });
    }
    const parsed = decodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    if (!(await hasItem(req.visitorId!, found.clue.cipher.requires))) {
      return res.status(403).json({ error: "You need something to decode it with" });
    }
    if (parsed.data.key !== found.secret.key) return res.json({ correct: false });
    await recordClue(req.visitorId!, bounty.id, found.clue.id);
    res.json({ correct: true, text: found.secret.text });
  });

  // Open a combination lock, or dive to a square on a sea chart: needs the clues that
  // reveal the answer, then the right code (a lock's digits, or the square).
  app.post("/api/bounties/:id/clues/:clueId/unlock", clueLimiter, async (req, res) => {
    const bounty = await openBounty(req, res, "Nothing to unlock there");
    if (!bounty) return;
    const found = clueOf(bounty, String(req.params.clueId), await caseRun(req.visitorId!, bounty.id));
    const { lock, chart } = found ? found.clue : {};
    if (!found || found.secret.code === undefined || !(lock || chart)) {
      return res.status(404).json({ error: "Nothing to unlock there" });
    }
    const parsed = unlockSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const { code } = parsed.data;
    // A lock takes digits; a chart takes one of its own squares
    if (chart ? !onChart(chart, code) : !/^[0-9]+$/.test(code)) {
      return res.status(400).json({ error: chart ? "That square isn't on the chart" : "A lock takes numbers" });
    }
    const have = await foundClues(req.visitorId!, bounty.id);
    if (!(found.secret.needs ?? []).every((id) => have.includes(id))) {
      return res.status(409).json({
        error: chart ? "You don't know where to dive yet. Keep searching." : "You don't know the combination yet. Keep searching.",
      });
    }
    if (code !== found.secret.code) return res.json({ correct: false });
    await recordClue(req.visitorId!, bounty.id, found.clue.id);
    res.json({ correct: true, text: found.secret.text });
  });

  // Question a suspect about a topic.
  app.post("/api/bounties/:id/suspects/:suspect/ask/:topic", clueLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    const found = await foundClues(req.visitorId!, bounty.id);
    const t = topicOf(found, bounty, String(req.params.suspect), String(req.params.topic), await caseRun(req.visitorId!, bounty.id));
    if (t.status === "missing") return res.status(404).json({ error: "They have nothing to say about that" });
    if (t.status === "locked") return res.status(409).json({ error: "Find more clues before you ask about that" });
    res.json({ text: t.said.text });
  });

  // Present a found clue against what a suspect said. The right clue against a lie
  // is a breakthrough, recorded like a clue.
  app.post("/api/bounties/:id/suspects/:suspect/ask/:topic/present", clueLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    const parsed = presentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const found = await foundClues(req.visitorId!, bounty.id);
    const t = topicOf(found, bounty, String(req.params.suspect), String(req.params.topic), await caseRun(req.visitorId!, bounty.id));
    if (t.status === "missing") return res.status(404).json({ error: "They have nothing to say about that" });
    if (t.status === "locked") return res.status(409).json({ error: "Find more clues before you ask about that" });
    if (!found.includes(parsed.data.clue)) {
      return res.status(409).json({ error: "You haven't found that clue" });
    }
    const { breakthrough, caughtBy } = t.said;
    if (!breakthrough || !caughtBy?.includes(parsed.data.clue)) return res.json({ correct: false });
    await recordClue(req.visitorId!, bounty.id, breakthrough.id);
    res.json({ correct: true, id: breakthrough.id, text: breakthrough.text });
  });

  // Name a suspect, backed by a found clue. Needs enough clues on record; the right suspect
  // with real proof starts the showdown clock. Any wrong answer gets the same reply, so
  // it never reveals whether the suspect or the proof was off.
  app.post("/api/bounties/:id/accuse", gameLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    const parsed = accusationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    const found = await foundClues(req.visitorId!, bounty.id);
    const solution = solutionFor(bounty.id, await caseRun(req.visitorId!, bounty.id));
    const ready = accusationCount(bounty, found, solution?.beforeAccusation) >= cluesNeeded(bounty)
      && (solution?.beforeAccusation ?? []).every((id) => found.includes(id));
    if (!ready) {
      return res.status(409).json({ error: "Find more clues before you name anyone" });
    }
    const { proof, proof2 } = parsed.data;
    if (!found.includes(proof) || (proof2 !== undefined && !found.includes(proof2))) {
      return res.status(409).json({ error: "You haven't found that clue" });
    }
    if (solution?.proofGroups && proof2 === undefined) return res.status(400).json({ error: "This case needs two pieces of evidence" });
    if (!solution || solution.suspect !== parsed.data.suspect || !proofHolds(solution, proof, proof2)) {
      // First run: a wrong name costs the Clean Case seal. A replay has no seal to lose,
      // so the third wrong name tears up the notebook and re-deals the case.
      if ((await getProfile(req.visitorId!)).completedBounties.includes(bounty.id)) {
        const strikes = await recordReplayStrike(req.visitorId!, bounty.id);
        if (strikes >= REPLAY_STRIKES) {
          await replayInvestigation(req.visitorId!, bounty.id);
          return res.json({ correct: false, reset: true });
        }
        return res.json({ correct: false, strikesLeft: REPLAY_STRIKES - strikes });
      }
      await recordWrongAccusation(req.visitorId!, bounty.id);
      return res.json({ correct: false });
    }
    await startShowdown(req.visitorId!, bounty.id);
    res.json({ correct: true, showdown: solution.showdown, outro: solution.outro });
  });

  // Collected cases open again with an empty notebook. The payout and Clean Case seal stay.
  app.post("/api/bounties/:id/replay", gameLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    if (!(await replayInvestigation(req.visitorId!, bounty.id))) {
      return res.status(409).json({ error: "Collect this bounty before you replay it" });
    }
    res.json({ ok: true });
  });

  // The stare-down is over. The server starts the draw clock.
  app.post("/api/bounties/:id/draw", gameLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    const started = await showdownStartedAt(req.visitorId!, bounty.id);
    if (started === null) return res.status(409).json({ error: "Name the culprit before you collect" });
    if (Date.now() - started < SHOWDOWN_MIN_MS) return res.status(409).json({ error: "Win the showdown first" });
    if (!(await showdownWon(req.visitorId!, bounty.id))) await beginDraw(req.visitorId!, bounty.id);
    res.json({ ready: true });
  });

  // The shot is won only if it arrives inside the hunter's draw window.
  app.post("/api/bounties/:id/shot", gameLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    const started = await showdownStartedAt(req.visitorId!, bounty.id);
    if (started === null) return res.status(409).json({ error: "Name the culprit before you collect" });
    const profile = await getProfile(req.visitorId!);
    res.json(await resolveShot(req.visitorId!, bounty.id, drawWindowMs(profile.owned), SHOT_GRACE_MS, SHOT_FLOOR_MS));
  });

  // Pay out once per hunter, only after a correct accusation and a real showdown.
  app.post("/api/bounties/:id/claim", gameLimiter, async (req, res) => {
    const bounty = await openBounty(req, res);
    if (!bounty) return;
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
    // Checked before the suspect, so /claim can't be used to test guesses.
    const started = await showdownStartedAt(req.visitorId!, bounty.id);
    if (started === null) {
      const settled = claimWithoutShowdown(await hasReplayReceipt(req.visitorId!, bounty.id));
      const error = settled === "already_collected" ? "Bounty already collected" : "Name the culprit before you collect";
      return res.status(409).json({ error });
    }
    if (solutionFor(bounty.id, await caseRun(req.visitorId!, bounty.id))?.suspect !== parsed.data.suspect) {
      return res.status(422).json({ error: "Wrong suspect" });
    }
    if (Date.now() - started < SHOWDOWN_MIN_MS) return res.status(409).json({ error: "Win the showdown first" });
    if (!(await showdownWon(req.visitorId!, bounty.id))) return res.status(409).json({ error: "Win the showdown first" });
    const result = await claimBounty(req.visitorId!, bounty.id, bounty.reward);
    if (result.status === "already_claimed") {
      // The showdown clock already ran. Close the replay duel. Pay nothing again.
      await closeShowdown(req.visitorId!, bounty.id);
      return res.status(409).json({ error: "Bounty already collected" });
    }
    res.json(result.profile);
  });

  app.post("/api/shop/:itemId/buy", gameLimiter, async (req, res) => {
    const result = await buyItem(req.visitorId!, String(req.params.itemId));
    if (result.status === "not_found") return res.status(404).json({ error: "No such item" });
    if (result.status === "already_owned") return res.status(409).json({ error: "You already own that" });
    if (result.status === "insufficient_credits") return res.status(402).json({ error: "Not enough credits" });
    res.json(result.profile);
  });

  app.get("/api/leaderboard", async (_req, res) => {
    res.json(await getLeaderboard());
  });

  // Aurelia is invitation-only: the doormen check the hunter's record.
  app.get("/api/aurelia", async (req, res) => {
    const profile = await getProfile(req.visitorId!);
    if (!invitedToAurelia(profile.completedBounties)) {
      return res.status(403).json({
        error: "Your name isn't on the list",
        have: fragmentsFor(profile.completedBounties).length,
        needed: AURELIA_INVITE_FRAGMENTS,
      });
    }
    res.json(aureliaFor(
      profile.callsign,
      profile.completedBounties,
      profile.items.includes("decoder-ring"),
      profile.cleanBounties,
      profile.items.includes("orrery-key"),
    ));
  });

  app.get("/api/wire", async (_req, res) => {
    res.json(await getWire());
  });

  app.get("/api/star-map", async (_req, res) => {
    res.json(await getStarMap());
  });
}
