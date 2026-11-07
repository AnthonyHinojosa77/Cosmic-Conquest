import { shiftLetters, type CaseSolution } from "../shared/game.js";

// Server-only bounty solutions — kept out of shared/ so they don't ship to the browser.
// The showdown/outro name the culprit, so they're only sent after a correct accusation.
// `proof`: the found clues (or caught lies) that back up naming the culprit; an
// accusation needs the right suspect AND one of these.
export const BOUNTY_SOLUTIONS: Record<string, { suspect: string; proof: readonly string[]; beforeAccusation?: readonly string[] } & CaseSolution> = {
  "heart-of-luna": {
    suspect: "cookie",
    // Every clue but the videophone log (Madame Vela's alibi) points at Cookie: the malt
    // syrup and moon dust, the diner cap and fry oil, the clogged mixer, Servo, the cap.
    proof: ["dome", "robot", "mixer", "servo", "jukebox", "breakthrough-1"],
    outro: "The Heart of Luna is back under the Expo dome, and Cookie is cooling off in the Lunar lock-up.",
    showdown: {
      opponent: "\"Cookie\" Carmichael",
      image: "/api/art/showdown/heart-of-luna",
      taunt: "Cookie backs against the grill, hand hovering over his spatula blaster. \"You'll never take me alive, hunter!\"",
    },
  },
  "saturn-orrery": {
    suspect: "tuttle",
    // The locked case, the caught lie, and the two clues that break his alibi:
    // the telescope log and the cocoa that came back because he was not there.
    // Naming him also takes his own caught lie. Lady Ashgrove's lie does not stand in for it.
    proof: ["luggage", "breakthrough-2", "telescope", "galley", "guestbook"],
    beforeAccusation: ["breakthrough-2"],
    outro: "The Saturn Gear clicks back onto its spindle and the Sterling Orrery chimes again. Professor Tuttle will be lecturing on Titan after all, from the inside of the Titan lock-up.",
    showdown: {
      opponent: "Professor Orson Tuttle",
      image: "/api/art/showdown/saturn-orrery",
      scene: "./game/showdown-platform-saturn.webp",
      taunt: "Tuttle snaps his pocket watch shut and reaches for his brass spyglass-pistol. \"Aurora's gears belong to those who understand them, hunter!\"",
    },
  },
  "venus-fog": {
    suspect: "vance",
    // The signed log names him. So do the wet footprints toward the gondola dock,
    // and the fog log signed "Dock Control."
    proof: ["locker", "orchids", "fog-machine", "breakthrough-1"],
    beforeAccusation: ["breakthrough-1"],
    outro: "The Star of Venus is back around its owner's neck, the fog show runs on schedule again, and Captain Vance is taking the long gondola ride down to the Venus lock-up.",
    showdown: {
      opponent: "Captain Teddy Vance",
      image: "/api/art/showdown/venus-fog",
      scene: "./game/showdown-deck-venus.webp",
      taunt: "Vance swirls his fog-grey cape and flashes that famous grin. \"Nobody catches the Fog Phantom, hunter. Nobody!\"",
    },
  },
  "neptune-deep": {
    suspect: "coralie",
    // Her stage-door log and dripping tail missing its scales, and the "C.F." note and
    // sequinned mask left aboard the Tomorrow. The berth's lone sequin alone names no one.
    proof: ["stage-door", "chart", "breakthrough-1"],
    beforeAccusation: ["breakthrough-1"],
    outro: "The Tomorrow is back in her berth, polished and gleaming, and the Aquacade is holding auditions for a new mermaid. Coralie Finn is practicing her breath-holding in the Triton lock-up.",
    showdown: {
      opponent: "Coralie Finn",
      image: "/api/art/showdown/neptune-deep",
      scene: "./game/showdown-promenade-neptune.webp",
      taunt: "Coralie Finn peels off her flowered swim cap and levels a pearl-handled harpoon pistol. \"Aurora's fortune belongs to whoever dives deepest, hunter!\"",
    },
  },
  "red-sands": {
    suspect: "quill",
    // The crates and the telegram signed "Q." name the freight clerk. So do the
    // monorail freight-dolly tracks leaving the empty pad.
    proof: ["crates", "telegram", "pad", "breakthrough-1"],
    beforeAccusation: ["breakthrough-1"],
    outro: "The Rain-Makers are back on their pads, the Ares Valley crops are drinking again, and Rigby Quill is filing his own paperwork in the Phobos lock-up.",
    showdown: {
      opponent: "Rigby Quill",
      image: "/api/art/showdown/red-sands",
      scene: "./game/showdown-street-mars.webp",
      taunt: "Quill tucks his clipboard under one arm, fingers twitching over his stamp-blaster. \"Everything was properly filed, hunter!\"",
    },
  },
};

// Server-only clue text, sent to a hunter when they search that spot (so reading the
// browser code reveals nothing). A clue with a `key` is in code: its text is only
// released when the hunter decodes it with that key.
// A clue with a `code` is behind a combination lock, or hidden on a sea chart (then the
// code is the square, like "C3"); `needs` lists the clues that reveal the combination
// or the square, which must be found before the lock will open or the dive will go.
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
    guestbook: { text: "Last night's entries: \"Lady V. Ashgrove, 8:30 PM. A divine little machine!\" and \"P. Kettleby, porter, 10:15 PM. Cocoa for the Professor. Nobody here. Brought it back.\" Tucked between the pages: a pawn ticket from a Titan clock dealer, made out to V. Ashgrove." },
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
  "neptune-deep": {
    berth: { text: "The Tomorrow's berth is empty, the water still rocking against her gold nameplate. Her mooring lines weren't cut: they were untied and coiled, neat as a bow, by someone who knew exactly what they were doing. Snagged on a cleat is one shimmering green sequin, shaped like a fish scale." },
    chamber: { text: "The dock doctor's stamp on the decompression chamber log reads \"R. Mackerel, sealed in 11:00 PM, out 7:00 AM.\" Rusty Mackerel presses his whiskers to the porthole. \"Wasn't me, pal! But I'll tell you for free: a sub as tall as the Tomorrow can't hide in the shallows. She's down in the Deep, the dark water on the harbor chart.\"" },
    chart: {
      text: "The diving bell sinks through the dark to square C3, and its lamp catches a gleam of gold: the Tomorrow, parked in the Deep just beyond the Beacon's light. Every chart drawer aboard has been pulled out and rifled. On the captain's chair lies a lady's diving mask trimmed with green sequins, and across the periscope, in lipstick: \"Map's not in the drawers. Back tomorrow night. - C.F.\"",
      code: "C3",
      needs: ["chamber", "sonar", "beacon"],
    },
    sonar: { text: "Old Ping, the sonar robot, prints last night's tape: \"2:12 AM: large contact leaves the Sterling Pen, running silent. 2:31 AM: contact stops due east of the Coral Arch, on the very same row of the harbor chart. No further echoes.\"" },
    beacon: { text: "You ring the Beacon keeper on the brass call box. \"Busy night! The Neptune Belle's moonlight tour circled my light from midnight to three, Captain Brine at the wheel and twenty passengers waving at my window. But nothing else came into my light all night. Whoever you're after kept to the dark.\"" },
    "stage-door": { text: "The Aquacade's stage door log: \"C. Finn out 1:55 AM, midnight swim.\" No time back in. Inside her dressing room a green sequined mermaid tail hangs dripping seawater, a patch of scales missing. On the vanity sits a dog-eared copy of \"Where Did Aurora Sterling Hide Her Fortune?\"" },
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

type ClueSecret = { text: string; key?: number; code?: string; needs?: string[] };

// Replays change the puzzles. Run 0 is the case as first played (and as voiced); each
// replay moves on to the next variant, so the answer is never the one you remember.
// A variant only overrides text or codes; which clues reveal the answer stays the same.
function venusScraps(left: number, middle: number, right: number): Record<string, Partial<ClueSecret>> {
  const v = CLUES["venus-fog"];
  return {
    case: { text: v.case.text.replace("the digit 4", `the digit ${left}`) },
    keys: { text: v.keys.text.replace("the digit 1", `the digit ${middle}`) },
    orchids: { text: v.orchids.text.replace("the digit 8", `the digit ${right}`) },
    locker: { code: `${left}${middle}${right}` },
  };
}

// On the harbor chart, C5 is the only deep, unlit square on the Kelp Forest's row.
const NEPTUNE_KELP: Record<string, Partial<ClueSecret>> = {
  sonar: { text: CLUES["neptune-deep"].sonar.text.replace("due east of the Coral Arch", "due east of the Kelp Forest") },
  chart: { text: CLUES["neptune-deep"].chart.text.replace("square C3", "square C5"), code: "C5" },
};

// C1 is the only deep square on the Aquadome's row (the Beacon's light never reaches row 1).
const NEPTUNE_DOME: Record<string, Partial<ClueSecret>> = {
  sonar: { text: CLUES["neptune-deep"].sonar.text.replace("due east of the Coral Arch", "due west of the Aquadome") },
  chart: {
    text: CLUES["neptune-deep"].chart.text
      .replace("square C3", "square C1")
      .replace("parked in the Deep just beyond the Beacon's light", "parked in the Deep in the shadow of the Aquadome"),
    code: "C1",
  },
};

export const VARIANTS: Record<string, Record<string, Partial<ClueSecret>>[]> = {
  "venus-fog": [{}, venusScraps(7, 3, 5), venusScraps(2, 9, 6)],
  "neptune-deep": [{}, NEPTUNE_KELP, NEPTUNE_DOME],
};

export function variantIndex(bountyId: string, run: number): number {
  const variants = VARIANTS[bountyId];
  return variants ? run % variants.length : 0;
}

// A clue's secret for this run of the case.
export function secretFor(bountyId: string, clueId: string, run = 0): ClueSecret | undefined {
  const base = CLUES[bountyId]?.[clueId];
  if (!base) return undefined;
  const over = VARIANTS[bountyId]?.[variantIndex(bountyId, run)]?.[clueId];
  return over ? { ...base, ...over } : base;
}

// A recording speaks run 0's words. A clue whose words change in this run stays silent.
export function voicedInRun(bountyId: string, clueId: string, run: number): boolean {
  return VARIANTS[bountyId]?.[variantIndex(bountyId, run)]?.[clueId]?.text === undefined;
}

// What suspects say when questioned. A statement with `caughtBy` is a lie: presenting
// one of those found clues is a breakthrough (recorded like a clue, with its own text).
export const TESTIMONY: Record<string, Record<string, Record<string, {
  text: string;
  caughtBy?: string[];
  breakthrough?: { id: string; text: string };
}>>> = {
  "heart-of-luna": {
    gearhart: {
      night: { text: "I locked the Expo at six sharp and went home to my workshop, where a man can think. RB-9 kept the doors. RB-9 always keeps the doors." },
      robot: { text: "RB-9 remembers every face and every word, which is more than the Expo Committee can say. They gave my butler a corner. They gave a rock a dome." },
      dome: { text: "The base panel comes off with an ordinary screwdriver. I told the Committee so in writing. Twice. Anyone with sticky fingers and ten minutes could have done it." },
    },
    vela: {
      night: { text: "On the line to Mars, darling, from a quarter past ten until the small hours. My sister. The light delay makes every argument twice as long." },
      crystal: { text: "Pretty, but it doesn't ring. Give me a videophone any day. Now, a little bird in a paper hat told me he was retiring somewhere shiny. Funny, isn't it?" },
    },
    cookie: {
      night: {
        text: "Worked my whole shift, start to close, flipping Rocket Burgers. Ask anybody. I never set foot outside the diner.",
        caughtBy: ["servo", "robot"],
        breakthrough: { id: "breakthrough-1", text: "Cookie wipes his hands on his apron, slowly. \"Okay, so I clocked out a little early. I had a delivery. A late milkshake, over to the Expo, for the night guard.\" The Expo has no night guard. RB-9 is the night guard." },
      },
      lunchbox: { text: "Meatloaf. Heavy meatloaf. My mother's recipe. You want a bite? No? Then quit looking at my lunchbox." },
      glitter: { text: "Moon dust? In my mixer? Must've blown in off the Expo floor. It gets everywhere. It's the Moon." },
    },
  },
  "red-sands": {
    dusty: {
      night: { text: "Racing! The Olympus Mons Rally, nine to dawn. I came second, which still stings. Check the results board if you don't believe me." },
      water: { text: "Those domes drink half of Mars's water and give nothing back to the rest of us. But stealing a Rain-Maker? I couldn't tow one with my skiff. I tried. As a joke." },
    },
    venn: {
      night: { text: "At my bench, all night, like every Friday. The night camera has a better view of my work than the Board of Directors ever will." },
      "rain-makers": { text: "They're thirty years old and they leak. I want them scrapped and replaced with my design. A stolen tower just gets replaced with another old one. Theft doesn't help me at all." },
    },
    quill: {
      night: {
        text: "Nothing ships Fridays, sir. The depot shuts at six and nothing moves until Monday morning. Quiet as a tomb.",
        caughtBy: ["sprinkles", "crates"],
        breakthrough: { id: "breakthrough-1", text: "Quill's stamp hand freezes over his clipboard. \"The 2:10 to Phobos. Right. That one. I may have stayed late to see it off. Somebody has to sign the manifests.\" He looks at the crate of Canned Sunshine and doesn't look away fast enough." },
      },
      crates: { text: "Every crate I seal is checked twice and stamped once. That's the system. The system is never wrong." },
      rounds: { text: "A man can't buy his friends a root beer? I came into a little money. An aunt. On Phobos. She was very old." },
    },
  },
  "venus-fog": {
    lune: {
      night: { text: "On my bandstand, darling, from eleven until one, live on the radio for all of Venus. A conductor does not leave mid-number. The orchestra would fall apart." },
      star: { text: "I saw it sparkle from the stage just before the fog rolled in. Then the lights dimmed, and when they came up, nothing. My trumpets played a very sad note." },
    },
    fenwick: {
      night: { text: "The botanists' banquet in the Sun Room, until one. Forty witnesses and an extremely dry soufflé." },
      fog: { text: "Not me. My show runs at midnight, gentle, for the orchids. And I sign my changes \"Dr. F.\", always. \"Dock Control\" is what the gondola pilots call their radio shack." },
    },
    vance: {
      night: {
        text: "Down at the gondola dock, sweetheart, the whole fog show. Quiet as a church. Nobody came down from the terrace and nobody went up. I'd have seen them.",
        caughtBy: ["orchids"],
        breakthrough: { id: "breakthrough-1", text: "The famous grin slips, just for a second. \"All right, somebody came down from the terrace in the fog. Me. Every pilot sneaks up for the fog show, it's the best view on Venus. I was back at the dock before the lights came up.\" His boots are still damp." },
      },
      dock: { text: "Dock Control? That's just the radio shack at the gondola dock. Any pilot could walk in. Any guest, too, if they wanted to badly enough." },
    },
  },
  "neptune-deep": {
    brine: {
      night: {
        text: "Tour? Cancelled, too rough. I was tucked in my bunk by eleven, snoring like a whale. Didn't see a thing all night.",
        caughtBy: ["beacon"],
        breakthrough: { id: "breakthrough-2", text: "Brine scowls into his beard. \"Fine. I ran the moonlight tour. Off the books, cash only, twenty passengers who'd rather not be in your notebook. The harbor master needn't hear about it. But I never left the Beacon's light all night. Ask the keeper.\"" },
      },
      berth: { text: "That gold-plated bathtub hogs the best berth in the Pen. Sure, I wanted it. But I'd never take her. You can't sell a sub that famous, and you can't hide one that shiny." },
      deep: { text: "That echo at 2:31? Not the Belle. My girl is lit up like a Christmas tree; the Beacon keeper would've seen her leave. Whoever went into the Deep went dark." },
    },
    rusty: {
      night: { text: "Sealed in that tin can of a decompression chamber, eleven to seven, doc's orders. Ask the stamp. Ask my aching knees." },
      gold: { text: "Finders keepers, sure, that's the law of the sea. But you've got to find it first, and I was busy finding my knees." },
    },
    coralie: {
      night: {
        text: "Asleep in my dressing room by midnight, darling. A mermaid needs her beauty rest. I didn't leave the Aquacade all night.",
        caughtBy: ["stage-door"],
        breakthrough: { id: "breakthrough-1", text: "Coralie's stage smile doesn't move, but her fingers tighten on her flowered swim cap. \"Fine. A midnight swim. I swim when I can't sleep. That isn't a crime on Neptune, is it?\" She doesn't say where she swam to, or when she came back." },
      },
      sequin: { text: "Sequins? Half the Aquacade sheds them. You'll find them in the soup. You'll find them in the Beacon keeper's beard." },
      book: { text: "Every girl on Neptune has read that book. Aurora's fortune is the only story anybody tells down here. It doesn't mean anything." },
    },
  },
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
