import { shiftLetters, type CaseSolution } from "@shared/game";

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
  "venus-fog": {
    suspect: "vance",
    outro: "The Star of Venus is back around its owner's neck, the fog show runs on schedule again, and Captain Vance is taking the long gondola ride down to the Venus lock-up.",
    showdown: {
      opponent: "Captain Teddy Vance",
      image: "./game/vance-showdown.webp",
      scene: "./game/showdown-deck-venus.webp",
      taunt: "Vance swirls his fog-grey cape and flashes that famous grin. \"Nobody catches the Fog Phantom, hunter. Nobody!\"",
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

// Server-only clue text, sent to a hunter when they search that spot (so reading the
// browser code reveals nothing). A clue with a `key` is in code: its text is only
// released when the hunter decodes it with that key.
// A clue with a `code` is behind a combination lock; `needs` lists the clues that
// reveal the combination, which must be found before the lock will open.
export const CLUES: Record<string, Record<string, { text: string; key?: number; code?: string; needs?: string[] }>> = {
  "heart-of-luna": {
    dome: { text: "The glass dome is intact, but the base panel was unscrewed and put back crooked. There's a sticky smear of malt syrup on the screws — and a trail of glittering moon dust leading toward the exit." },
    robot: { text: "You rewind the Robot Butler's memory tape. 11:52 PM: 'Good evening, sir. The Expo is closed.' The late visitor wore a paper diner cap and smelled strongly of fry oil. Dr. Gearhart, RB-9's inventor, had locked up and gone home at six." },
    videophone: { text: "The booth's call log shows Madame Vela Quasar on a single call to Mars from 10:15 PM to 1:40 AM — the light-delay charges alone cost her a fortune. She never left the booth." },
    mixer: { text: "The Moon Malt mixer is clogged with something that glitters. Moon dust, and plenty of it. Whoever was back here last night wasn't making milkshakes." },
    servo: { text: "Servo's eyes flicker. 'Cookie clocked out early last night, sir. He took his lunchbox — it looked very heavy. He hasn't come in for his shift today.'" },
    jukebox: { text: "Tucked behind the jukebox: a paper diner cap with 'COOKIE' stitched on the band, dusted with moon glitter. Someone left in a hurry." },
  },
  "venus-fog": {
    case: { text: "The Star of Venus is gone from its velvet case. The lights dimmed for the fog show at 11:40, and when they came up, the necklace had vanished. On the table: one wet orchid petal. Wedged under the case: a torn scrap of paper, the LEFT edge of a note, with the digit 4 on it." },
    bandstand: { text: "Maestro Lune's sheet music is still on the stands. His orchestra played straight through the fog show, and the resort radio broadcast it live across Venus: every song from 11 until 1, with his baton tapping between numbers. He never left the stage." },
    keys: { text: "The starlet's suite key was borrowed and quietly put back. Only staff can reach behind this desk, and the night clerk remembers \"one of the uniforms\" leaning over it around 11:30. Tucked behind the board: a scrap of paper torn on BOTH sides, with the digit 1." },
    "fog-machine": { text: "Dr. Fenwick's fog log shows one gentle fog show, set for midnight. But last night someone moved it to 11:40, made it extra thick, and signed the change \"Dock Control.\" Dr. Fenwick was at the botanists' banquet in the Sun Room until 1 AM, with forty witnesses." },
    orchids: { text: "A stem is freshly snapped: the petal on the jewel table came from here. Stuck to the damp soil: a scrap of paper, the RIGHT edge of a note, with the digit 8. Wet footprints lead toward the gondola dock." },
    locker: { text: "The padlock clicks open. Inside: a fog-grey cape, a black velvet domino mask, the Star of Venus itself, and a gondola pilot's logbook. Last night's entry reads: \"Fog show moved to 11:40. Quick trip. Back on shift by midnight. - T.V.\"", code: "418", needs: ["case", "keys", "orchids"] },
  },
  "red-sands": {
    pad: { text: "Where a Rain-Maker stood last night there's only bare concrete. The four bolts were undone neatly with a proper wrench, not ripped out. Narrow paired wheel tracks lead to the dome's freight door: a monorail freight dolly." },
    sprinkles: { text: "Sprinkles plays back his memory tape: \"The Rain-Makers always go missing on a Friday night, sir, just before the 2:10 freight monorail leaves for Phobos.\" Then he pops open his chest drawer and hands you something from the lost-and-found: a brass decoder ring." },
    lab: { text: "Professor Venn has been asking Sterling Atomic to scrap the old Rain-Makers for her new design, which looks bad. But the lab's door log shows she badged in at 8 PM last Friday and didn't leave until sunrise, and the night camera shows her at her bench the whole time." },
    skiff: { text: "Dusty Dunmore's racing skiff is caked in dust and its engine is stone cold. On the seat: a race ticket for the Olympus Mons Rally, last Friday from 9 PM to dawn. He finished second. Besides, a skiff this size couldn't haul a Rain-Maker." },
    crates: { text: "The crates say CANNED SUNSHINE, but one is far too heavy, and a chrome fin pokes through the slats. The shipping label: \"To Phobos Station. Checked and sealed by the freight clerk on duty.\"" },
    telegram: { text: "TEN MORE RAIN-MAKERS READY FRIDAY. CRATE THEM AS CANNED SUNSHINE. PHOBOS BUYER PAYS DOUBLE. SIGNED, Q.", key: 2 },
  },
};
