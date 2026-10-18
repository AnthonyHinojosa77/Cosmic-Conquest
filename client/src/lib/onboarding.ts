import type { PlayerProfile } from "@shared/game";

// Where a player is in the game's opening: whether they've seen the announcer's
// intro, and whether they've signed their hunter's license. Kept on the device.

const INTRO_KEY = "cc_intro_seen";
const ONBOARDED_KEY = "cc_onboarded";
const SIGNED_KEY = "cc_license_signed"; // signed here, but left before reaching the office

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, on = true) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the opening simply shows again next time
  }
}

export const introSeen = () => read(INTRO_KEY);
export const markIntroSeen = () => write(INTRO_KEY);
export const markSigned = () => write(SIGNED_KEY);
export function markOnboarded() {
  write(ONBOARDED_KEY);
  write(SIGNED_KEY, false);
}

// The name every new player gets until they sign their license (server/gameStorage.ts).
export const isDefaultCallsign = (callsign: string) => /^Hunter #\d{4}$/.test(callsign);

// A hunter who finished the opening here, or who played before it existed (they chose
// a name or solved a case), goes straight to "Continue". One who signed their license
// but left before the office starts again, with their name already on it.
export function hasHunter(player: PlayerProfile | undefined): boolean {
  if (read(ONBOARDED_KEY)) return true;
  if (!player) return false;
  if (player.completedBounties.length > 0) return true;
  return !read(SIGNED_KEY) && !isDefaultCallsign(player.callsign);
}
