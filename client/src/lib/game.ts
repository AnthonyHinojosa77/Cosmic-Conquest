import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { arrivalName, finishVisit, shouldLogVisit } from "@/lib/visitor";
import { BOUNTIES, closeReplayDuel, readyWithoutInterview, withAccusation, withCaught, type PlayerProfile, type LeaderboardEntry, type SuitId, type CaseSolution, type StarMapStatus, type BountyProgress, type ClueSearch, type AureliaLocation } from "@shared/game";
import { nameAfterReset } from "@/lib/votes";

export const PLAYER_KEY = ["/api/player"];
export const LEADERBOARD_KEY = ["/api/leaderboard"];
export const STAR_MAP_KEY = ["/api/star-map"];
export const AURELIA_KEY = ["/api/aurelia"];

export function usePlayer() {
  return useQuery<PlayerProfile>({ queryKey: PLAYER_KEY });
}

// The social worlds use the hunter's callsign as their name: it signs the arrival log
// (once the profile has loaded) and pre-fills the form until the visitor types their own.
export function useCallsignName(world: string) {
  const { data: player, isLoading, isPending, isError } = usePlayer();
  const [name, setNameState] = useState("");
  const edited = useRef(false);
  const signed = arrivalName(player ?? null, isPending || isLoading, isError);

  useEffect(() => {
    if (!signed || !shouldLogVisit(world)) return;
    apiRequest("POST", "/api/visitors", {
      visitorName: signed,
      world,
      action: "arrived at",
    }).then(() => {
      finishVisit(world, true);
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
    }).catch(() => {
      finishVisit(world, false);
    });
  }, [signed, world]);

  useEffect(() => {
    if (!edited.current && player?.callsign) setNameState(player.callsign);
  }, [player?.callsign]);

  const latestName = useRef(name);
  latestName.current = name;
  const callsign = useRef(player?.callsign);
  callsign.current = player?.callsign;
  const setName = (value: string) => {
    edited.current = true;
    setNameState(value);
  };
  // After a successful submission. No profile yet: keep the name they typed.
  const resetName = () => {
    const next = nameAfterReset(latestName.current, callsign.current);
    edited.current = next.edited;
    setNameState(next.name);
  };
  return { name, setName, resetName };
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({ queryKey: LEADERBOARD_KEY, refetchInterval: 15000 });
}

// Aurelia's places; a 403 means the hunter isn't invited yet.
export function useAurelia() {
  return useQuery<AureliaLocation[]>({ queryKey: AURELIA_KEY });
}

export function useStarMap() {
  // Changes only when someone collects a bounty; your own claim refreshes it right away.
  return useQuery<StarMapStatus>({ queryKey: STAR_MAP_KEY, refetchInterval: 60000 });
}

function onProfile(profile: PlayerProfile) {
  queryClient.setQueryData(PLAYER_KEY, profile);
  queryClient.invalidateQueries({ queryKey: LEADERBOARD_KEY });
  queryClient.invalidateQueries({ queryKey: STAR_MAP_KEY });
  queryClient.invalidateQueries({ queryKey: AURELIA_KEY }); // a new piece may earn the invitation
}

// "402: {...}" -> the server's error message, for friendly display
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const body = raw.replace(/^\d+:\s*/, "");
  try {
    return JSON.parse(body).error ?? body;
  } catch {
    return body;
  }
}

export function useUpdatePlayer() {
  return useMutation({
    mutationFn: async (changes: { callsign?: string; suit?: SuitId }) =>
      (await apiRequest("PATCH", "/api/player", changes)).json() as Promise<PlayerProfile>,
    onSuccess: onProfile,
  });
}

export function useBuyItem() {
  return useMutation({
    mutationFn: async (itemId: string) =>
      (await apiRequest("POST", `/api/shop/${itemId}/buy`)).json() as Promise<PlayerProfile>,
    onSuccess: onProfile,
  });
}

// Testimony text is not in the progress record. Keep it for this visit so a tab change
// does not make the hunter ask again. A replay drops that bounty’s lines.
const heardLines = new Map<string, string>();

export function heardFor(bountyId: string): Record<string, string> {
  const prefix = `${bountyId}/`;
  const lines: Record<string, string> = {};
  heardLines.forEach((text, key) => {
    if (key.startsWith(prefix)) lines[key.slice(prefix.length)] = text;
  });
  return lines;
}

export function keepLine(bountyId: string, suspect: string, topic: string, text: string) {
  heardLines.set(`${bountyId}/${suspect}/${topic}`, text);
}

export function forgetLines(bountyId: string) {
  const prefix = `${bountyId}/`;
  const drop: string[] = [];
  heardLines.forEach((_text, key) => {
    if (key.startsWith(prefix)) drop.push(key);
  });
  drop.forEach((key) => heardLines.delete(key));
}

// Open a collected case again. The notebook comes back empty. The payout and seal stay.
export async function replayBounty(bountyId: string): Promise<void> {
  await apiRequest("POST", `/api/bounties/${bountyId}/replay`);
  forgetLines(bountyId);
  const key = progressKey(bountyId);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<BountyProgress>(key, { found: {}, canAccuse: false, needsLie: false });
  queryClient.invalidateQueries({ queryKey: key });
}

// Name a suspect with a found clue as proof. Returns the case solution (showdown + outro)
// when both are right, else null (a wrong guess costs the Clean Case seal, never credits).
export async function accuse(bountyId: string, suspect: string, proof: string): Promise<CaseSolution | null> {
  const res = await apiRequest("POST", `/api/bounties/${bountyId}/accuse`, { suspect, proof });
  const body = await res.json();
  if (!body.correct) return null;
  const solution: CaseSolution = { showdown: body.showdown, outro: body.outro };
  await rememberAccusation(bountyId, suspect, solution);
  return solution;
}

// The progress query does not refetch on its own, so a correct name has to be written
// into the cache or "Back to the showdown" disappears until a full reload.
// Cancel first: an older progress response can still be in flight, and infinite
// freshness would keep that response and drop the showdown.
export async function rememberAccusation(bountyId: string, suspect: string, solution: CaseSolution) {
  const key = progressKey(bountyId);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<BountyProgress>(key, (p) => {
    if (!p) return p;
    const player = queryClient.getQueryData<PlayerProfile>(PLAYER_KEY);
    const replayDuel = p.replayDuel === true || (player?.completedBounties.includes(bountyId) ?? false);
    return withAccusation(p, suspect, solution, replayDuel);
  });
  await queryClient.invalidateQueries({ queryKey: key });
}

export type ClaimOutcome = "paid" | "already_claimed";

export function openDraw(bountyId: string): Promise<Response> {
  return apiRequest("POST", `/api/bounties/${bountyId}/draw`);
}

export async function landShot(bountyId: string): Promise<{ won: boolean }> {
  const res = await apiRequest("POST", `/api/bounties/${bountyId}/shot`);
  return res.json();
}

export async function claimBounty(bountyId: string, suspect: string): Promise<ClaimOutcome> {
  try {
    const res = await apiRequest("POST", `/api/bounties/${bountyId}/claim`, { suspect });
    onProfile(await res.json());
    return "paid";
  } catch (err) {
    // Only a real second payout is "already collected". Other 409s
    // ("Win the showdown first", "Name the culprit before you collect") stay errors.
    if (err instanceof Error && err.message.startsWith("409") && err.message.includes("Bounty already collected")) {
      const key = progressKey(bountyId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<BountyProgress>(key, (p) => (p ? closeReplayDuel(p) : p));
      queryClient.invalidateQueries({ queryKey: key });
      return "already_claimed";
    }
    throw err;
  }
}

// --- Bounty progress (recorded by the server) --------------------------------

const progressKey = (bountyId: string) => ["/api/bounties", bountyId, "progress"];

export function useProgress(bountyId: string | null) {
  return useQuery<BountyProgress>({ queryKey: progressKey(bountyId ?? ""), enabled: bountyId !== null });
}

// Show the find right away, then re-read the server's record (so an older in-flight
// progress response can't wipe it out).
async function addFound(bountyId: string, clueId: string, text: string, caught?: { suspect: string; topic: string }) {
  const key = progressKey(bountyId);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<BountyProgress>(key, (p) => {
    const found = { ...(p?.found ?? {}), [clueId]: text };
    const ready = readyWithoutInterview(BOUNTIES.find((b) => b.id === bountyId), found);
    const canAccuse = ready === null ? (p?.canAccuse ?? false) : ready;
    const next: BountyProgress = { ...(p ?? { found, canAccuse, needsLie: false }), found, canAccuse, needsLie: p?.needsLie ?? false };
    return caught ? withCaught(next, caught.suspect, caught.topic, clueId) : next;
  });
  queryClient.invalidateQueries({ queryKey: key });
}

// A searched spot can put an item in the satchel, which Aurelia reads on the next visit.
export function cachesAfterSearch(): (typeof PLAYER_KEY | typeof AURELIA_KEY)[] {
  return [PLAYER_KEY, AURELIA_KEY];
}

// Search a spot; the server records it and returns the clue (and may add an item to the satchel).
export async function searchClue(bountyId: string, clueId: string): Promise<ClueSearch> {
  const result = (await (await apiRequest("POST", `/api/bounties/${bountyId}/clues/${clueId}/search`)).json()) as ClueSearch;
  if (result.text !== undefined) await addFound(bountyId, clueId, result.text);
  cachesAfterSearch().forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  return result;
}

// Submit a puzzle answer; true (and the clue is found) when the server accepts it.
async function solveClue(bountyId: string, clueId: string, action: "decode" | "unlock", answer: object): Promise<boolean> {
  const body = await (await apiRequest("POST", `/api/bounties/${bountyId}/clues/${clueId}/${action}`, answer)).json();
  if (body.correct) await addFound(bountyId, clueId, body.text);
  return body.correct;
}

// Try a key on a coded clue.
export const decodeClue = (bountyId: string, clueId: string, key: number) => solveClue(bountyId, clueId, "decode", { key });

// Try a combination on a locked clue.
export const unlockClue = (bountyId: string, clueId: string, code: string) => solveClue(bountyId, clueId, "unlock", { code });

// Question a suspect about a topic; returns what they say.
export async function askSuspect(bountyId: string, suspect: string, topic: string): Promise<string> {
  const res = await apiRequest("POST", `/api/bounties/${bountyId}/suspects/${suspect}/ask/${topic}`);
  return (await res.json()).text;
}

// Present a found clue against a statement; a breakthrough is added to the notebook.
export async function presentClue(
  bountyId: string,
  suspect: string,
  topic: string,
  clue: string,
): Promise<{ correct: false } | { correct: true; id: string; text: string }> {
  const body = await (await apiRequest("POST", `/api/bounties/${bountyId}/suspects/${suspect}/ask/${topic}/present`, { clue })).json();
  if (body.correct) {
    await addFound(bountyId, body.id, body.text, { suspect, topic });
  }
  return body;
}
