// One id stays pending until its own request settles. A second request must not
// clear the first.
export function trackPending<T>(pending: ReadonlySet<T>, id: T, active: boolean): Set<T> {
  const next = new Set(pending);
  if (active) next.add(id);
  else next.delete(id);
  return next;
}

export function trackVote(pending: ReadonlySet<number>, id: number, active: boolean): Set<number> {
  return trackPending(pending, id, active);
}

// One clue, one request. A second tap while the first is in flight does not start another.
export function claimSearch(inflight: ReadonlySet<string>, id: string): Set<string> | null {
  if (inflight.has(id)) return null;
  const next = new Set(inflight);
  next.add(id);
  return next;
}

// A feed error only replaces an empty list. Cached cards stay up without the banner.
export function showEmptyError(isError: boolean, count: number): boolean {
  return isError && count === 0;
}

// Space and Enter fire the draw only when the key is not meant for another control.
export function drawFromKey(code: string, inField: boolean): boolean {
  if (code !== "Space" && code !== "Enter") return false;
  return !inField;
}

// The draw button handles its own Space/Enter. Another control keeps its key. Otherwise the duel fires once.
export function drawKeyPlan(code: string, onDrawButton: boolean, inField: boolean): "native" | "fire" | "ignore" {
  if (code !== "Space" && code !== "Enter") return "ignore";
  if (onDrawButton) return "native";
  if (inField) return "ignore";
  return "fire";
}

// A field typed while a form was sending stays. An untouched field clears.
export function keepDraft(sent: string, now: string): string {
  return now === sent ? "" : now;
}

// After a form sends, restore the callsign. With no profile yet, keep the typed name.
export function nameAfterReset(typed: string, callsign: string | undefined): { edited: boolean; name: string } {
  if (!callsign) return { edited: true, name: typed };
  return { edited: false, name: callsign };
}

// The audio engine needs a wake when it is not running. A closed engine cannot resume.
export function engineNeedsWake(state: string): boolean {
  return state !== "running" && state !== "closed";
}

// Hide pauses the current track. Show plays it again, or starts one if none is loaded.
export function musicOnVisibility(hidden: boolean, hasTrack: boolean): "pause" | "resume" | "start" {
  if (hidden) return "pause";
  return hasTrack ? "resume" : "start";
}

// A voice line pauses with the page and picks up when the page is shown again.
export function voiceOnVisibility(hidden: boolean, playing: boolean): "pause" | "resume" | "idle" {
  if (!playing) return "idle";
  return hidden ? "pause" : "resume";
}

// Pausing the page rejects the play() that has not finished. That rejection is not a broken line.
export function dropVoiceOnPlayError(held: boolean): boolean {
  return !held;
}

// An open Aurelia sheet follows the latest spot with this id, not the object from the click.
export function aureliaSpot<T extends { id: string }>(spots: readonly T[] | undefined, openId: string | null): T | null {
  if (!openId || !spots) return null;
  return spots.find((spot) => spot.id === openId) ?? null;
}

// A confirmed replay runs once. A second click waits until that request settles.
export function replayArmed(confirmed: boolean, pending: boolean): "ask" | "wait" | "go" {
  if (pending) return "wait";
  return confirmed ? "go" : "ask";
}

export type ClueSheetKind = "lock" | "chart" | "decoder" | "found" | "searching" | "error" | "missing";

// Pending and a failed fetch come before the decoder, so a coded clue cannot sit on "Searching…" with no retry.
export function clueSheetKind(input: {
  lock: boolean;
  chart: boolean;
  cipher: boolean;
  found: boolean;
  pending: boolean;
  error: boolean;
  coded: boolean;
}): ClueSheetKind {
  if (input.lock) return "lock";
  if (input.chart) return "chart";
  if (input.found && input.cipher) return "decoder";
  if (input.found) return "found";
  if (input.pending) return "searching";
  if (input.error) return "error";
  if (input.cipher && input.coded) return "decoder";
  return "missing";
}
