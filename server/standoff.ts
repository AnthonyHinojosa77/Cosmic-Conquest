import {
  STANDOFF_BASICS,
  STANDOFF_COMPOSURE,
  STANDOFF_NERVE,
  type StandoffBasicId,
  type StandoffCardKind,
  type StandoffOutcome,
  type StandoffPlay,
  type StandoffView,
} from "../shared/game.js";
import type { VillainCard } from "./bounties.js";

// The Standoff's rules. Pure: no database, no hunter ids, and no randomness after the
// deal, so a saved state always plays out the same way. Server-only, because the state
// holds the villain's whole deck and which clue breaks each alibi.

// Where a Standoff runs. For now: replays of the first case only.
export function standoffApplies(bountyId: string, run: number): boolean {
  return bountyId === "heart-of-luna" && run >= 1;
}

export interface StandoffState {
  // The run of the case this was dealt for. One left over from an earlier run is re-dealt.
  run: number;
  // Cards the hunter has played. Saved beside the state so a double tap plays once.
  turn: number;
  nerve: number;
  composure: number;
  hand: string[];
  draw: string[];
  // Which of the hunter's cards are caught lies (the rest are clues or basics).
  gotchas: string[];
  // The villain's deck, copied in so a later edit can't change a duel in progress.
  villain: VillainCard[];
  // The villain's face-up card.
  at: number;
  // The Hair-Trigger Holster's free play before the villain's first card.
  opening: boolean;
  last?: StandoffPlay;
  outcome?: StandoffOutcome;
}

const HAND_SIZE = 4;
const BASIC_IDS = Object.keys(STANDOFF_BASICS) as StandoffBasicId[];
const isBasic = (id: string): id is StandoffBasicId => id in STANDOFF_BASICS;

// A small seeded generator (mulberry32), so a deal can be repeated from its seed.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const next = seeded(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The notebook becomes the deck: every clue found, every lie caught, and the three basics.
// The Lucky Ray-Gun deals one more card; the Hair-Trigger Holster plays before the villain.
export function dealStandoff(opts: {
  clues: readonly string[];
  gotchas: readonly string[];
  villain: readonly VillainCard[];
  owned: readonly string[];
  seed: number;
  run: number;
}): StandoffState {
  const cards = shuffled([...opts.clues, ...opts.gotchas, ...BASIC_IDS], opts.seed);
  const size = HAND_SIZE + (opts.owned.includes("raygun") ? 1 : 0);
  return {
    run: opts.run,
    turn: 0,
    nerve: STANDOFF_NERVE,
    composure: STANDOFF_COMPOSURE,
    hand: cards.slice(0, size),
    draw: cards.slice(size),
    gotchas: [...opts.gotchas],
    villain: opts.villain.map((card) => ({ ...card })),
    at: 0,
    opening: opts.owned.includes("holster"),
  };
}

function kindOf(state: StandoffState, id: string): StandoffCardKind {
  if (isBasic(id)) return "basic";
  return state.gotchas.includes(id) ? "gotcha" : "evidence";
}

// What one card does against the villain's face-up card: changes to Nerve and Composure,
// extra cards drawn, and whether the card did its job.
function effectOf(kind: StandoffCardKind, id: string, facing: VillainCard | null): { hit: boolean; nerve: number; composure: number; extra: number } {
  const miss = { hit: false, nerve: 0, composure: -1, extra: 0 };
  if (!facing) {
    // The free opening play: a Gotcha or a Stare Down lands a jab, anything else just cycles.
    const jab = kind === "gotcha" || id === "stare-down";
    return { hit: jab, nerve: jab ? -1 : 0, composure: 0, extra: 0 };
  }
  if (facing.kind === "alibi") {
    if (kind === "gotcha") return { hit: true, nerve: -3, composure: 0, extra: 0 };
    if (kind === "evidence" && facing.brokenBy.includes(id)) return { hit: true, nerve: -2, composure: 0, extra: 0 };
    return miss;
  }
  if (kind === "gotcha" || id === "stare-down") return { hit: true, nerve: -1, composure: 0, extra: 0 };
  if (id === "steady-hand") return { hit: true, nerve: 0, composure: 1, extra: 0 };
  if (id === "tip-of-the-hat") return { hit: true, nerve: 0, composure: 0, extra: 2 };
  return miss;
}

// Play one card from the hand. Null if the card isn't there or the Standoff is over.
export function playCard(state: StandoffState, cardId: string): StandoffState | null {
  if (state.outcome || !state.hand.includes(cardId)) return null;
  const facing = state.opening ? null : state.villain[state.at] ?? null;
  const effect = effectOf(kindOf(state, cardId), cardId, facing);
  const nerve = Math.max(0, state.nerve + effect.nerve);
  const composure = Math.min(STANDOFF_COMPOSURE, Math.max(0, state.composure + effect.composure));
  const at = state.opening ? state.at : state.at + 1;
  const held = state.hand.filter((id, i) => i !== state.hand.indexOf(cardId));
  const drawn = 1 + effect.extra;
  const hand = [...held, ...state.draw.slice(0, drawn)];
  const outcome: StandoffOutcome | undefined =
    nerve <= 0 ? "broke"
    : composure <= 0 ? "rattled"
    : at >= state.villain.length || hand.length === 0 ? "held"
    : undefined;
  return {
    ...state,
    turn: state.turn + 1,
    nerve,
    composure,
    hand,
    draw: state.draw.slice(drawn),
    at,
    opening: false,
    last: {
      card: cardId,
      against: facing ? facing.kind : "opening",
      hit: effect.hit,
      nerve: nerve - state.nerve,
      composure: composure - state.composure,
    },
    ...(outcome ? { outcome } : {}),
  };
}

// The only part of a Standoff the browser sees.
export function viewOf(state: StandoffState): StandoffView {
  const facing = state.outcome || state.opening ? null : state.villain[state.at] ?? null;
  return {
    turn: state.turn,
    round: Math.min(state.at + 1, state.villain.length),
    rounds: state.villain.length,
    nerve: state.nerve,
    composure: state.composure,
    hand: state.hand.map((id) => ({ id, kind: kindOf(state, id) })),
    deckLeft: state.draw.length,
    villain: facing ? { kind: facing.kind, text: facing.text } : null,
    ...(state.opening && !state.outcome ? { opening: true } : {}),
    ...(state.last ? { last: state.last } : {}),
    ...(state.outcome ? { outcome: state.outcome } : {}),
  };
}
