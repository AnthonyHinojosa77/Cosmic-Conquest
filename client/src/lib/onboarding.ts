import type { PlayerProfile } from "@shared/game";

// Where a player is in the game's opening: whether they've seen the announcer's
// intro, and whether they've signed their hunter's license. Kept on the device.

const INTRO_KEY = "cc_intro_seen";
const ONBOARDED_KEY = "cc_onboarded";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // storage blocked: the opening simply shows again next time
  }
}

export const introSeen = () => read(INTRO_KEY);
export const markIntroSeen = () => write(INTRO_KEY);
export const markOnboarded = () => write(ONBOARDED_KEY);

// The name every new player gets until they sign their license (server/gameStorage.ts).
export const isDefaultCallsign = (callsign: string) => /^Hunter #\d{4}$/.test(callsign);

// A hunter who signed their license here, or who played before this opening existed
// (they chose a name or solved a case), goes straight to "Continue".
export function hasHunter(player: PlayerProfile | undefined): boolean {
  if (read(ONBOARDED_KEY)) return true;
  if (!player) return false;
  return player.completedBounties.length > 0 || !isDefaultCallsign(player.callsign);
}
