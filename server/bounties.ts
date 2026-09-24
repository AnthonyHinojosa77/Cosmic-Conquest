import type { CaseSolution } from "@shared/game";

// Server-only bounty solutions — kept out of shared/ so they don't ship to the browser.
// The showdown/outro name the culprit, so they're only sent after a correct accusation.
export const BOUNTY_SOLUTIONS: Record<string, { suspect: string } & CaseSolution> = {
  "heart-of-luna": {
    suspect: "cookie",
    outro: "The Heart of Luna is back under the Expo dome, and Cookie is cooling off in the Lunar lock-up.",
    showdown: {
      opponent: "\"Cookie\" Carmichael",
      icon: "🍳",
      taunt: "Cookie backs against the grill, hand hovering over his spatula blaster. \"You'll never take me alive, hunter!\"",
    },
  },
};
