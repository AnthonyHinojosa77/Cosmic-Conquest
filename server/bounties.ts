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
export const CLUES: Record<string, Record<string, { text: string; key?: number }>> = {
  "heart-of-luna": {
    dome: { text: "The glass dome is intact, but the base panel was unscrewed and put back crooked. There's a sticky smear of malt syrup on the screws — and a trail of glittering moon dust leading toward the exit." },
    robot: { text: "You rewind the Robot Butler's memory tape. 11:52 PM: 'Good evening, sir. The Expo is closed.' The late visitor wore a paper diner cap and smelled strongly of fry oil. Dr. Gearhart, RB-9's inventor, had locked up and gone home at six." },
    videophone: { text: "The booth's call log shows Madame Vela Quasar on a single call to Mars from 10:15 PM to 1:40 AM — the light-delay charges alone cost her a fortune. She never left the booth." },
    mixer: { text: "The Moon Malt mixer is clogged with something that glitters. Moon dust, and plenty of it. Whoever was back here last night wasn't making milkshakes." },
    servo: { text: "Servo's eyes flicker. 'Cookie clocked out early last night, sir. He took his lunchbox — it looked very heavy. He hasn't come in for his shift today.'" },
    jukebox: { text: "Tucked behind the jukebox: a paper diner cap with 'COOKIE' stitched on the band, dusted with moon glitter. Someone left in a hurry." },
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
