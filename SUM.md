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
6. > Yes

Message 6 answered the offer to send the research agent back to identify the courtroom deckbuilder.

### What was proposed (not yet approved to build)

- Recommended direction: deckbuilder + roguelite replay structure + social deduction, layered on the existing mystery game. Real-time action combat and turn-based strategy left out.
- "The Standoff": a short card duel between the accusation and the existing quick-draw. The deck is built from the case notebook (clues become Evidence cards, caught lies become Gotcha cards, red-herring lies become Bluff cards, plus three basic cards for every hunter). The result widens or narrows the draw window. One twist per case taken from its existing puzzle. Smallest first version: Luna only.
- Mole bounty: 3 to 5 hunters share one notebook, the server secretly assigns one as the mole, the team votes on the accusation. Turn-based, not live. Needs multiplayer (phase 7 in GAME_PLAN.md).
- Suggested order: 1) Standoff on Luna, 2) replays that re-deal the villain's deck across all five cases, 3) mole bounty.
- Owner's reaction to the Standoff sketch: "I like the sound of this". No build has been authorized.

### Market check (2026-11-13, follow-up 2026-11-14, run by a research agent, limited search)

- Full combination (investigation + deckbuilding + hidden traitor): not found.
- Evidence-as-cards is partly done: Card Detective (2023, Steam, $3.99, 145 reviews, 73% positive, confirmed from its store page) and One Show Only (2016).
- Traitor corrupting a shared card pool is done in board games (Unfathomable, 2021) but not in a mystery game.
- No asynchronous social deduction app with real traction was found; forum Mafia is the long-running exception.
- Follow-up: the "courtroom deckbuilder" covered by PC Gamer is All Will Rise (Speculative Agency, Steam, unreleased, free demo, no release date or price listed). Its investigation shapes the courtroom deck through unlocked cards and "claims"; it is not one card per clue, has no lie-catching mechanic found, no re-dealt cases and no multiplayer. It is a fixed branching story about persuading a court, not a whodunit. So it overlaps part of the deck-from-investigation idea only.
- Other titles seen in the follow-up but not opened: Hillthorn (clue cards, due November 2026), Detective 26 (card-based deduction), Interrogator 2, Desktop Detective.
- Not verified: the full PC Gamer article, All Will Rise's Kickstarter result and wishlist numbers; sales and owner numbers elsewhere are third-party estimates.

### Approved gap-fills

None yet.

### Open questions for the owner

- Should losing the Standoff only narrow the draw window (recommended), or send the hunter back to retry the cards?
- Sketch a full round of the mole bounty?
- Turn the three steps into a build plan?
