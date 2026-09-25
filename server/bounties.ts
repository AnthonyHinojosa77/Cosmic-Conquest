import type { CaseSolution } from "@shared/game";

// Server-only bounty solutions — kept out of shared/ so they don't ship to the browser.
// The showdown/outro name the culprit, so they're only sent after a correct accusation.
export const BOUNTY_SOLUTIONS: Record<string, { suspect: string } & CaseSolution> = {
  "heart-of-luna": {
    suspect: "cookie",
    outro: "The Heart of Luna is back under the Expo dome, and Cookie is cooling off in the Lunar lock-up.",
    showdown: {
      opponent: "\"Cookie\" Carmichael",
      image: "./game/cookie-showdown.webp",
      taunt: "Cookie backs against the grill, hand hovering over his spatula blaster. \"You'll never take me alive, hunter!\"",
    },
  },
  "red-sands": {
    suspect: "quill",
    outro: "The Rain-Makers are back on their pads, the Ares Valley crops are drinking again, and Rigby Quill is filing his own paperwork in the Phobos lock-up.",
    showdown: {
      opponent: "Rigby Quill",
      image: "./game/quill-showdown.webp",
      scene: "./game/showdown-street-mars.webp",
      taunt: "Quill tucks his clipboard under one arm, fingers twitching over his stamp-blaster. \"Everything was properly filed, hunter!\"",
    },
  },
};
