import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getVisitorName, shouldLogVisit } from "@/lib/visitor";
import type { PlayerProfile, LeaderboardEntry, SuitId, CaseSolution, StarMapStatus, BountyProgress, ClueSearch, AureliaLocation } from "@shared/game";

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
  const { data: player, isLoading } = usePlayer();
  const [name, setNameState] = useState("");
  const edited = useRef(false);

  useEffect(() => {
    if (isLoading || !shouldLogVisit(world)) return;
    apiRequest("POST", "/api/visitors", {
      visitorName: player?.callsign || getVisitorName(),
      world,
      action: "arrived at",
    }).catch(() => {});
  }, [isLoading]);

  useEffect(() => {
    if (!edited.current && player?.callsign) setNameState(player.callsign);
  }, [player?.callsign]);

  const setName = (value: string) => {
    edited.current = true;
    setNameState(value);
  };
  // After a successful submission
  const resetName = () => {
    edited.current = false;
    setNameState(player?.callsign ?? "");
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

// Name a suspect with a found clue as proof. Returns the case solution (showdown + outro)
// when both are right, else null (a wrong guess costs the Clean Case seal, never credits).
export async function accuse(bountyId: string, suspect: string, proof: string): Promise<CaseSolution | null> {
  const res = await apiRequest("POST", `/api/bounties/${bountyId}/accuse`, { suspect, proof });
  const body = await res.json();
  return body.correct ? { showdown: body.showdown, outro: body.outro } : null;
}

export type ClaimOutcome = "paid" | "already_claimed";

export async function claimBounty(bountyId: string, suspect: string): Promise<ClaimOutcome> {
  try {
    const res = await apiRequest("POST", `/api/bounties/${bountyId}/claim`, { suspect });
    onProfile(await res.json());
    return "paid";
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("409")) return "already_claimed";
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
async function addFound(bountyId: string, clueId: string, text: string) {
  const key = progressKey(bountyId);
  await queryClient.cancelQueries({ queryKey: key });
  queryClient.setQueryData<BountyProgress>(key, (p) =>
    ({ ...(p ?? { found: {} }), found: { ...(p?.found ?? {}), [clueId]: text } }));
  queryClient.invalidateQueries({ queryKey: key });
}

// Search a spot; the server records it and returns the clue (and may add an item to the satchel).
export async function searchClue(bountyId: string, clueId: string): Promise<ClueSearch> {
  const result = (await (await apiRequest("POST", `/api/bounties/${bountyId}/clues/${clueId}/search`)).json()) as ClueSearch;
  if (result.text !== undefined) await addFound(bountyId, clueId, result.text);
  queryClient.invalidateQueries({ queryKey: PLAYER_KEY }); // an item may have been found
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
    await addFound(bountyId, body.id, body.text); // re-reads progress, which now lists this caught lie
  }
  return body;
}
