import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { PlayerProfile, LeaderboardEntry, SuitId, CaseSolution, StarMapStatus } from "@shared/game";

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
  return useQuery<StarMapStatus>({ queryKey: STAR_MAP_KEY, refetchInterval: 15000 });
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
