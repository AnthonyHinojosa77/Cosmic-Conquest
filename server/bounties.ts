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
  "saturn-orrery": {
    suspect: "tuttle",
    outro: "The Saturn Gear clicks back onto its spindle and the Sterling Orrery chimes again. Professor Tuttle will be lecturing on Titan after all, from the inside of the Titan lock-up.",
    showdown: {
      opponent: "Professor Orson Tuttle",
      image: "./game/tuttle-showdown.webp",
      scene: "./game/showdown-platform-saturn.webp",
      taunt: "Tuttle snaps his pocket watch shut and reaches for his brass spyglass-pistol. \"Aurora's gears belong to those who understand them, hunter!\"",
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
  "saturn-orrery": {
    orrery: { text: "The Sterling Orrery stands frozen, its little planets stopped mid-orbit. Where the Saturn Gear should turn there's an empty brass spindle. The gear came off cleanly, with no scratches: someone opened the case with the orrery's own key." },
    telescope: { text: "The telescope log, in Professor Tuttle's neat hand: \"Ring storm approaching. Dome SHUT 9:05 PM. Reopened 12:40 AM.\" The lens cap is frosted with ring ice that never melted. Nobody looked through this telescope last night." },
    guestbook: { text: "Last night's entries: \"Lady V. Ashgrove, 8:30 PM. A divine little machine!\" and \"P. Kettleby, porter, 10:15 PM. Cocoa for the Professor. Nobody here, left it on the bench.\" Tucked between the pages: a pawn ticket from a Titan clock dealer, made out to V. Ashgrove." },
    table: { text: "Lady Ashgrove's table, still set for one. Her dinner check: the seven-course Ring Tasting, ordered at 9:00 PM, signed at 11:50. The waiter robot confirms it. \"Madam never left her seat. Not even for the flambé. She was most insistent.\"" },
    galley: { text: "In the galley sits Pip's cocoa tray with one cold, untouched cup. His order slip reads: \"Observatory, 10:15, for Prof. Tuttle. Nobody there. Brought it back.\"" },
    luggage: { text: "In the rack above the Professor's seat: a long velvet case with a claim tag for the Titan Transfer, where the train stops tomorrow. It's locked, and the lining bulges around something round and heavy." },
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

// What suspects say when questioned. A statement with `caughtBy` is a lie: presenting
// one of those found clues is a breakthrough (recorded like a clue, with its own text).
export const TESTIMONY: Record<string, Record<string, Record<string, {
  text: string;
  caughtBy?: string[];
  breakthrough?: { id: string; text: string };
}>>> = {
  "saturn-orrery": {
    ashgrove: {
      night: { text: "I dined, darling. Seven courses, each more divine than the last. I didn't leave the dining car from nine until nearly midnight." },
      orrery: { text: "An exquisite machine. I'd have bought it years ago if Aurora Sterling had ever sold anything to anyone." },
      money: {
        text: "My fortune? Perfectly intact, thank you. I've never set foot in a pawn shop in my life.",
        caughtBy: ["guestbook"],
        breakthrough: { id: "breakthrough-1", text: "Lady Ashgrove lowers her lorgnette. \"Fine. I pawned my grandmother's carriage clock on Titan. I'm broke, darling, and I travel first class on credit. But steal from Aurora's orrery? I'd sooner ride in coach. Ask the waiter robot. I never left my table.\"" },
      },
    },
    pip: {
      night: { text: "Run off my feet, sir! Cocoa to the observatory at a quarter past ten, but nobody was there, so I brought it back to the galley." },
      tuttle: { text: "The Professor? Kind old gent. Said he'd be at the telescope all night, watching the ring storm. Funny thing, though: the dome was shut when I went up." },
      chime: { text: "It chimes every hour, sir, regular as anything. I set my watch by it. Only last night it never chimed at eleven." },
    },
    tuttle: {
      night: {
        text: "I was at the telescope from nine until well past midnight, observing the ring storm. I never left the observatory. Not once.",
        caughtBy: ["telescope", "galley", "guestbook"],
        breakthrough: { id: "breakthrough-2", text: "Professor Tuttle's pipe goes out. \"The dome was shut, yes. I... stepped out. To the baggage car, only for a moment. For some air.\" He won't meet your eye, and his hand goes to the brass key on its ribbon." },
      },
      "the-key": { text: "Only I carry the orrery's key. Thirty years, and it's never once left this ribbon." },
      case: { text: "My lecture slides, for a talk on Titan. Nothing that would interest a bounty hunter." },
    },
  },
};
