import type { Express } from "express";
import path from "path";
import fs from "fs";
import { invitedToAurelia } from "../shared/game.js";
import { liveBounty, clueOf } from "./gameRoutes.js";
import { foundClues, showdownStartedAt, getProfile } from "./gameStorage.js";
import { TESTIMONY } from "./bounties.js";

// Voice lines are recordings of clue text, taunts and so on, so they give away as much
// as the words do. They live outside the public folder and are only served when the
// hunter is allowed to read the same text.
const AUDIO_DIR = path.resolve(process.env.AUDIO_DIR ?? path.join(process.cwd(), "audio", "voice"));
const ID = /^[a-z0-9-]{1,40}$/;

type Gate = (visitorId: string) => Promise<boolean>;

function gateFor(scope: string, a: string, b?: string): Gate | null {
  if (scope === "aurora" && a === "broadcast" && !b) return async () => true;
  const bounty = liveBounty(a);
  if (scope === "briefing" && bounty && !b) return async () => true;
  if (scope === "clue" && bounty && b && clueOf(bounty, b)) {
    return async (v) => (await foundClues(v, a)).includes(b);
  }
  if ((scope === "taunt" || scope === "outro") && bounty && !b) {
    return async (v) => (await showdownStartedAt(v, a)) !== null;
  }
  // What a suspect says: once the topic can be asked (file name "<suspect>--<topic>")
  if (scope === "testimony" && bounty && b) {
    const [suspect, topicId] = b.split("--");
    const topic = bounty.interviews?.find((i) => i.suspect === suspect)?.topics.find((t) => t.id === topicId);
    if (!topic || !TESTIMONY[a]?.[suspect]?.[topicId]) return null;
    return async (v) => topic.after === undefined || (await foundClues(v, a)).includes(topic.after);
  }
  // A caught lie: once the hunter has caught it
  if (scope === "breakthrough" && bounty?.breakthroughs?.includes(b ?? "")) return async (v) => (await foundClues(v, a)).includes(b!);
  if (scope === "aurelia" && b) return async (v) => invitedToAurelia((await getProfile(v)).completedBounties);
  return null;
}

export function registerVoiceRoutes(app: Express) {
  app.get(["/api/voice/:scope/:a", "/api/voice/:scope/:a/:b"], async (req, res) => {
    const { scope, a, b } = req.params as { scope: string; a: string; b?: string };
    if (![scope, a, b ?? "x"].every((p) => ID.test(p))) return res.status(404).end();
    const gate = gateFor(scope, a, b);
    if (!gate || !(await gate(req.visitorId!))) return res.status(404).end();
    const file = path.join(AUDIO_DIR, scope, a, `${b ?? "line"}.mp3`);
    if (!fs.existsSync(file)) return res.status(404).end();
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.sendFile(file);
  });
}
