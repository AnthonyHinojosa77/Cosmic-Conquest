# Discussion record

Newest first. Owner's words are quoted exactly.

## 2026-11-13: game direction (deckbuilder, roguelite replays, mole co-op)

Session: https://claude.ai/code/session_01GF8wU27PqANb4uWcqVkEbe

### Owner's words (in order)

1. > Which of the three following types of games is Cosmic Conquest most likely to succeed as or is a blend of them into one new kind of game the better path and why? Deckbuilders, Turn-Based Strategy, and Action-Roguelites
2. > yes, sketch the card-based showdown
3. > I like the sound of this, could we add a social deduction genre portion to the game as well?
4. > Based on that, is the optimal strategy to implement into Cosmic Conquest one of those four, or a combination of them, to risk trying to go for something that is new and exciting?
5. > Why don't you have an Sonnet 5.5 Medium agent check the market then

### What was proposed (not yet approved to build)

- Recommended direction: deckbuilder + roguelite replay structure + social deduction, layered on the existing mystery game. Real-time action combat and turn-based strategy left out.
- "The Standoff": a short card duel between the accusation and the existing quick-draw. The deck is built from the case notebook (clues become Evidence cards, caught lies become Gotcha cards, red-herring lies become Bluff cards, plus three basic cards for every hunter). The result widens or narrows the draw window. One twist per case taken from its existing puzzle. Smallest first version: Luna only.
- Mole bounty: 3 to 5 hunters share one notebook, the server secretly assigns one as the mole, the team votes on the accusation. Turn-based, not live. Needs multiplayer (phase 7 in GAME_PLAN.md).
- Suggested order: 1) Standoff on Luna, 2) replays that re-deal the villain's deck across all five cases, 3) mole bounty.
- Owner's reaction to the Standoff sketch: "I like the sound of this". No build has been authorized.

### Market check (2026-11-13, run by a research agent, limited search)

- Full combination (investigation + deckbuilding + hidden traitor): not found.
- Evidence-as-cards is partly done: Card Detective (2023, Steam, $3.99, 145 reviews, 73% positive, confirmed from its store page) and One Show Only (2016).
- Traitor corrupting a shared card pool is done in board games (Unfathomable, 2021) but not in a mystery game.
- No asynchronous social deduction app with real traction was found; forum Mafia is the long-running exception.
- Not verified: a "courtroom deckbuilder" covered by PC Gamer that could be a closer match; sales and owner numbers are third-party estimates.

### Approved gap-fills

None yet.

### Open questions for the owner

- Should losing the Standoff only narrow the draw window (recommended), or send the hunter back to retry the cards?
- Sketch a full round of the mole bounty?
- Turn the three steps into a build plan?
