import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PlayerProfile, LeaderboardEntry, SuitId, CaseSolution, StarMapStatus, BountyProgress, ClueSearch } from "@shared/game";

export const PLAYER_KEY = ["/api/player"];
export const LEADERBOARD_KEY = ["/api/leaderboard"];
export const STAR_MAP_KEY = ["/api/star-map"];

export function usePlayer() {
  return useQuery<PlayerProfile>({ queryKey: PLAYER_KEY });
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({ queryKey: LEADERBOARD_KEY, refetchInterval: 15000 });
}

export function useStarMap() {
  // Changes only when someone collects a bounty; your own claim refreshes it right away.
  return useQuery<StarMapStatus>({ queryKey: STAR_MAP_KEY, refetchInterval: 60000 });
}

function onProfile(profile: PlayerProfile) {
  queryClient.setQueryData(PLAYER_KEY, profile);
  queryClient.invalidateQueries({ queryKey: LEADERBOARD_KEY });
  queryClient.invalidateQueries({ queryKey: STAR_MAP_KEY });
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

// Returns the case solution (showdown + outro) when the accusation is right, else null.
export async function accuse(bountyId: string, suspect: string): Promise<CaseSolution | null> {
  const res = await apiRequest("POST", `/api/bounties/${bountyId}/accuse`, { suspect });
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

// Try a key on a coded clue; true when the server accepts it.
export async function decodeClue(bountyId: string, clueId: string, key: number): Promise<boolean> {
  const body = await (await apiRequest("POST", `/api/bounties/${bountyId}/clues/${clueId}/decode`, { key })).json();
  if (body.correct) await addFound(bountyId, clueId, body.text);
  return body.correct;
}

// Try a combination on a locked clue; true when the server accepts it.
export async function unlockClue(bountyId: string, clueId: string, code: string): Promise<boolean> {
  const body = await (await apiRequest("POST", `/api/bounties/${bountyId}/clues/${clueId}/unlock`, { code })).json();
  if (body.correct) await addFound(bountyId, clueId, body.text);
  return body.correct;
}
