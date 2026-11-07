// Bounty Hunter game content shared by server and client.
// Solutions are NOT here — they live server-side in server/bounties.ts.

export type SuitId = "silver" | "red" | "teal" | "gold";
export type GearId = "raygun" | "holster" | "guild-star" | "bandana";
export type ShopItemId = `suit-${Exclude<SuitId, "silver">}` | GearId;

export const SUITS: Record<SuitId, { name: string; color: string; trim: string }> = {
  silver: { name: "Frontier Silver", color: "#b9bec4", trim: "#7d8790" },
  red: { name: "Pulp Red", color: "#c8312b", trim: "#8e1f1a" },
  teal: { name: "Atomic Teal", color: "#1f7f9c", trim: "#135569" },
  gold: { name: "Gold Rush", color: "#e0a92a", trim: "#a8781a" },
};

export const DEFAULT_SUIT: SuitId = "silver";
export const SUIT_IDS = Object.keys(SUITS) as [SuitId, ...SuitId[]];

export function ownsSuit(owned: readonly string[], suit: SuitId): boolean {
  return suit === DEFAULT_SUIT || owned.includes(`suit-${suit}`);
}

export interface ShopItem {
  id: ShopItemId;
  name: string;
  price: number;
  description: string;
  // Listed but not yet purchasable (waiting on art)
  comingSoon?: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "raygun", name: "Lucky Ray-Gun", price: 300, description: "A pearl-handled blaster that clears leather fast. Gives you more time to draw in showdowns." },
  { id: "guild-star", name: "Guild Gold Star", price: 1200, description: "Solid Venusian gold. Pins a Guild star beside your callsign on your Hunter card and the Bounty Office leaderboard." },
  { id: "holster", name: "Hair-Trigger Holster", price: 2000, description: "Custom balance-weighted leather. Adds an extra 150 ms to your quick-draw window (stacks with the Lucky Ray-Gun)." },
  { id: "suit-red", name: "Pulp Red Suit", price: 150, description: "Loud, proud, and visible from orbit." },
  { id: "suit-teal", name: "Atomic Teal Suit", price: 150, description: "Cool as the far side of the Moon." },
  { id: "suit-gold", name: "Gold Rush Suit", price: 250, description: "For hunters who want the whole saloon to know they've arrived." },
  { id: "bandana", name: "Red Bandana", price: 2050, description: "A red bandana with a gold star, knotted at the collar. In a showdown it forgives one jumpy draw. The painting does not change, and it does not buy extra time." },
];

// Only items that can actually be bought right now
export function shopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id && !i.comingSoon);
}

export function suitForItem(id: ShopItemId): SuitId | null {
  return id.startsWith("suit-") ? (id.slice(5) as SuitId) : null;
}

// Quick-draw reaction window in ms; the Lucky Ray-Gun and the Hair-Trigger Holster widen it.
export const DRAW_WINDOW_MS = 500;
export const DRAW_WINDOW_RAYGUN_BONUS_MS = 250;
export const DRAW_WINDOW_HOLSTER_BONUS_MS = 150;

export function drawWindowMs(owned: readonly string[]): number {
  return DRAW_WINDOW_MS
    + (owned.includes("raygun") ? DRAW_WINDOW_RAYGUN_BONUS_MS : 0)
    + (owned.includes("holster") ? DRAW_WINDOW_HOLSTER_BONUS_MS : 0);
}

// The Red Bandana changes the showdown itself: one early shot is ignored.
// It does not widen the draw window.
export function bandanaSteadies(owned: readonly string[]): boolean {
  return owned.includes("bandana");
}

// After the pardon is spent, say so only while the hunter is waiting out the draw.
// "TOO JUMPY!" is the failed shot, and it should not also claim the jump was forgiven.
export function bandanaNote(spentPardon: boolean, state: DuelState): boolean {
  return spentPardon && (state === "steady" || state === "waiting");
}

export type DuelState = "idle" | "waiting" | "steady" | "draw" | "early" | "slow" | "won";

// One press in a showdown. The first early press is forgiven only while `pardon` is true.
// A second early press, including one during the "steady" beat, ends the attempt.
export function duelPress(
  state: DuelState,
  pardon: boolean,
  elapsedMs: number,
  windowMs: number,
): { state: DuelState; pardon: boolean; won: boolean } {
  if (state === "steady") return { state: "early", pardon: false, won: false };
  if (state === "waiting" && pardon) return { state: "steady", pardon: false, won: false };
  if (state === "waiting") return { state: "early", pardon: false, won: false };
  if (state === "draw") {
    return elapsedMs <= windowMs
      ? { state: "won", pardon, won: true }
      : { state: "slow", pardon, won: false };
  }
  return { state, pardon, won: false };
}

// Items found during bounties stay in the hunter's satchel for later jobs.
export type ItemId = "decoder-ring" | "orrery-key";

export const ITEMS: Record<ItemId, { name: string; description: string }> = {
  "decoder-ring": {
    name: "Junior Ranger Decoder Ring",
    description: "Brass, Sterling Atomic issue. Engraved inside: \"Set your key to the number of moons of your world.\"",
  },
  "orrery-key": {
    name: "Brass Orrery Key",
    description: "Master clockwork key from the Ring Line Express. Engraved with the star-crest of Sterling Atomic.",
  },
};

// Clue text lives server-side (server/bounties.ts) and is sent when a hunter searches.
export interface Clue {
  id: string;
  label: string;
  // Searching this clue hands the hunter an item
  grants?: ItemId;
  // The clue is in code (the server sends the coded text and holds the key); decoding needs `requires`
  cipher?: { requires: ItemId };
  // The clue is behind a combination lock (the server holds the combination)
  lock?: { dials: number };
  // The clue is somewhere on a sea chart: pick the right square (the server holds which one)
  chart?: SeaChart;
  // Hotspot position over the scene image (percent)
  top: string;
  left: string;
  width: string;
  height: string;
}

// A harbor chart of squares: columns A, B, C… run west to east, rows 1, 2, 3… north to
// south. The chart is public; which square hides the answer, and the clues that narrow
// it down, stay server-side.
export interface SeaChart {
  cols: number;
  rows: number;
  // Squares of deep water, e.g. "C3"
  deep: string[];
  // Squares inside the Beacon's light
  lit: string[];
  marks: { cell: string; name: string; icon: "dome" | "arch" | "beacon" | "wreck" | "kelp" }[];
}

// Column 3 is "C"; column 3, row 3 is square "C3" (both count from 1).
export const chartColumn = (col: number) => String.fromCharCode(64 + col);
export const chartCell = (col: number, row: number) => `${chartColumn(col)}${row}`;

export function onChart(chart: SeaChart, cell: string): boolean {
  const m = /^([A-Z])([1-9][0-9]?)$/.exec(cell);
  if (!m) return false;
  const col = m[1].charCodeAt(0) - 64;
  const row = Number(m[2]);
  return col <= chart.cols && row >= 1 && row <= chart.rows;
}

export interface BountyLocation {
  id: string;
  name: string;
  image: string;
  clues: Clue[];
}

export interface Suspect {
  id: string;
  name: string;
  title: string;
  portrait: string;
  description: string;
}

// Aurora Sterling's last broadcast (shown on screen and spoken by her voice line).
export const AURORA_BROADCAST = {
  intro: "This is Aurora Sterling.",
  quote: "Everything I built, I built for the bold. My fortune waits among the stars. Whoever finds it inherits tomorrow.",
};

// Sterling's star map: each bounty turns up one fragment. The map is meant to
// be large; the other fragments arrive with future bounties and worlds.
export const STAR_MAP_SIZE = 12;

export interface MapFragment {
  id: string;
  number: number; // position on the map, 1..STAR_MAP_SIZE
  name: string;
  caption: string;
}

// Questioning suspects: topics a hunter can ask about. What they say, and which
// clue catches them in a lie, is server-side (server/bounties.ts).
export interface InterviewTopic {
  id: string;
  label: string;
  // Only askable once this clue has been found
  after?: string;
}

export interface Interview {
  suspect: string;
  topics: InterviewTopic[];
}

export interface Bounty {
  id: string;
  title: string;
  planet: string;
  reward: number;
  available: boolean;
  teaser: string;
  briefing?: string;
  locations?: BountyLocation[];
  suspects?: Suspect[];
  cluesNeeded?: number;
  accusePrompt?: string;
  fragment?: MapFragment;
  interviews?: Interview[];
  // Ids of the lies to catch while questioning (each counts like a clue). Only ids:
  // who lies, and which clue catches them, stays server-side.
  breakthroughs?: string[];
  // Bounties that must be collected before this one can be taken
  requires?: readonly string[];
  // Shown before a replay when the case's puzzles change on each replay (answers stay server-side)
  replayNote?: string;
  // Investigation music (defaults to "investigate")
  music?: "investigate" | "venus";
}

export const BOUNTIES: Bounty[] = [
  {
    id: "heart-of-luna",
    title: "The Heart of Luna Heist",
    planet: "Earth Orbit",
    reward: 500,
    available: true,
    teaser: "The Moon Colony model's glowing crystal core vanished from the Atomic Expo overnight.",
    briefing:
      "Last night someone lifted the Heart of Luna — the glowing crystal that powers the Moon Colony Alpha model — right out from under the Atomic Expo's dome. The Expo Committee is paying 500 credits to whoever brings the thief in. Search the Expo and the Astro Diner for clues, then name your suspect. Careful, hunter: the wrong accusation just gets you laughed out of town.",
    // The first case teaches questioning: Cookie's lie is there to catch, and it counts
    // as proof, but any four finds are still enough to name someone.
    cluesNeeded: 4,
    breakthroughs: ["breakthrough-1"],
    interviews: [
      {
        suspect: "gearhart",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "robot", label: "Tell me about RB-9." },
          { id: "dome", label: "Who could open the dome?", after: "dome" },
        ],
      },
      {
        suspect: "cookie",
        topics: [
          { id: "night", label: "How was your shift last night?" },
          { id: "lunchbox", label: "What was in the lunchbox?", after: "servo" },
          { id: "glitter", label: "Why is the mixer full of moon dust?", after: "mixer" },
        ],
      },
      {
        suspect: "vela",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "crystal", label: "What do you make of the Heart of Luna?" },
        ],
      },
    ],
    locations: [
      {
        id: "expo",
        name: "The Atomic Expo",
        image: "./scenes/expo-scene.webp",
        clues: [
          {
            id: "dome",
            label: "Moon Colony Dome",
            top: "37%", left: "30%", width: "30%", height: "33%",
          },
          {
            id: "robot",
            label: "RB-9's Memory Tape",
            top: "39%", left: "70.5%", width: "10%", height: "37%",
          },
          {
            id: "videophone",
            label: "Videophone Call Log",
            top: "38%", left: "81.5%", width: "13.5%", height: "32%",
          },
        ],
      },
      {
        id: "diner",
        name: "Astro Diner",
        image: "./scenes/diner-scene.webp",
        clues: [
          {
            id: "mixer",
            label: "Malt Mixer",
            top: "50%", left: "43%", width: "8%", height: "17%",
          },
          {
            id: "servo",
            label: "Servo the Robot Waiter",
            top: "22%", left: "62%", width: "34%", height: "50%",
          },
          {
            id: "jukebox",
            label: "Atomic Jukebox",
            top: "36%", left: "3%", width: "14%", height: "32%",
          },
        ],
      },
    ],
    suspects: [
      {
        id: "gearhart",
        name: "Dr. Otto Gearhart",
        title: "Robot Butler Inventor",
        portrait: "./game/suspect-gearhart.webp",
        description: "Brilliant, cranky, and furious his robot got less press than the Moon model.",
      },
      {
        id: "cookie",
        name: "\"Cookie\" Carmichael",
        title: "Astro Diner Fry Cook",
        portrait: "./game/suspect-cookie.webp",
        description: "Flips a mean Rocket Burger. Talks a lot about 'retiring somewhere shiny.'",
      },
      {
        id: "vela",
        name: "Madame Vela Quasar",
        title: "Videophone Saleswoman",
        portrait: "./game/suspect-vela.webp",
        description: "Sells the future one long-distance call at a time. Always on the line.",
      },
    ],
    accusePrompt: "Who took the Heart of Luna?",
    fragment: {
      id: "lunar-quadrant",
      number: 1,
      name: "The Lunar Quadrant",
      caption: "Folded inside the Heart of Luna's brass setting: a sliver of star chart inked in gold, signed \"A.S.\" It marks Moon Colony Alpha, then a trail of stars running off the edge toward places no chart has ever named.",
    },
  },
  {
    id: "red-sands",
    title: "Rustlers of the Red Sands",
    planet: "Mars",
    reward: 800,
    available: true,
    requires: ["heart-of-luna"],
    teaser: "Chrome Rain-Makers are vanishing from the Ares Valley dome farms, one Friday night at a time.",
    briefing:
      "Out in Mars's Ares Valley, Sterling Atomic's glass-domed farms turn red dust into green fields, thanks to towering chrome Rain-Makers that pull water right out of the thin Martian air. Someone's been rustling them: three towers gone in three weeks. The Valley Growers' Cooperative is paying 800 credits to whoever stops it. Search the Hydro-Dome and the Red Sands freight depot, then name your rustler.",
    // All six scene clues plus the rustler's lie.
    cluesNeeded: 7,
    breakthroughs: ["breakthrough-1"],
    interviews: [
      {
        suspect: "quill",
        topics: [
          { id: "night", label: "What ships out of the depot on a Friday?" },
          { id: "crates", label: "Who sealed the Canned Sunshine crates?", after: "crates" },
          { id: "rounds", label: "Folks say you've been buying rounds." },
        ],
      },
      {
        suspect: "dusty",
        topics: [
          { id: "night", label: "Where were you last Friday night?" },
          { id: "water", label: "What's your beef with the dome farms?" },
        ],
      },
      {
        suspect: "venn",
        topics: [
          { id: "night", label: "Where were you last Friday night?" },
          { id: "rain-makers", label: "Why do you want the old Rain-Makers gone?" },
        ],
      },
    ],
    locations: [
      {
        id: "hydro-dome",
        name: "Ares Valley Hydro-Dome",
        image: "./scenes/mars-farm.webp",
        clues: [
          {
            id: "pad",
            label: "Empty Rain-Maker Pad",
            top: "60%", left: "28%", width: "40%", height: "16%",
          },
          {
            id: "sprinkles",
            label: "Sprinkles the Farm Robot",
            grants: "decoder-ring",
            top: "45%", left: "70%", width: "16%", height: "33%",
          },
          {
            id: "lab",
            label: "Professor Venn's Lab",
            top: "38%", left: "5%", width: "20%", height: "22%",
          },
        ],
      },
      {
        id: "depot",
        name: "Red Sands Freight Depot",
        image: "./scenes/mars-depot.webp",
        clues: [
          {
            id: "skiff",
            label: "Dusty's Sand-Skiff",
            top: "20%", left: "63%", width: "34%", height: "62%",
          },
          {
            id: "crates",
            label: "Canned Sunshine Crates",
            top: "44%", left: "29%", width: "21%", height: "26%",
          },
          {
            id: "telegram",
            label: "Coded Telegram",
            cipher: { requires: "decoder-ring" },
            top: "27%", left: "3%", width: "17%", height: "30%",
          },
        ],
      },
    ],
    suspects: [
      {
        id: "quill",
        name: "Rigby Quill",
        title: "Monorail Freight Clerk",
        portrait: "./game/suspect-quill.webp",
        description: "Knows every crate that leaves the Red Sands depot. Lately he's been buying rounds.",
      },
      {
        id: "dusty",
        name: "\"Dusty\" Dunmore",
        title: "Sand-Skiff Racer",
        portrait: "./game/suspect-dusty.webp",
        description: "Loud about 'dome farmers hogging all of Mars's water.' Fastest skiff in the Ares Valley.",
      },
      {
        id: "venn",
        name: "Professor Lyra Venn",
        title: "Sterling Atomic Hydrologist",
        portrait: "./game/suspect-venn.webp",
        description: "Designed a better Rain-Maker and makes no secret she wanted the old ones gone.",
      },
    ],
    accusePrompt: "Who's rustling the Rain-Makers?",
    fragment: {
      id: "martian-quadrant",
      number: 2,
      name: "The Martian Quadrant",
      caption: "When the Rain-Makers come home, Sprinkles finds a chart rolled up inside one hollow fin: Aurora Sterling's gold ink tracing the canals of Mars, and a bright dotted line running on past the asteroid belt.",
    },
  },
  {
    id: "venus-fog",
    title: "The Venus Fog Phantom",
    planet: "Venus",
    reward: 1200,
    available: true,
    requires: ["heart-of-luna"],
    music: "venus",
    replayNote: "Each replay, the Phantom tears a fresh note: new scraps, and a different combination from your last run.",
    teaser: "A masked thief lifted the Star of Venus during the sky-resort's fog show.",
    briefing:
      "High above the fog seas of Venus floats the Aphrodite Sky Resort, Sterling Atomic's most glamorous address. Last night, during the fog show, a masked figure the guests are calling the Fog Phantom lifted the Star of Venus, the most famous necklace in the solar system, right off a starlet's table. The resort is paying 1,200 credits for the Phantom. Search the Grand Lounge and the Orchid Conservatory, then unmask your thief.",
    // All six scene clues plus the Phantom's lie.
    cluesNeeded: 7,
    breakthroughs: ["breakthrough-1"],
    interviews: [
      {
        suspect: "lune",
        topics: [
          { id: "night", label: "Where were you during the fog show?" },
          { id: "star", label: "Did you see the Star of Venus last night?" },
        ],
      },
      {
        suspect: "fenwick",
        topics: [
          { id: "night", label: "Where were you during the fog show?" },
          { id: "fog", label: "Who changed your fog schedule?", after: "fog-machine" },
        ],
      },
      {
        suspect: "vance",
        topics: [
          { id: "night", label: "Where were you during the fog show?" },
          { id: "dock", label: "Who uses the name \"Dock Control\"?", after: "fog-machine" },
        ],
      },
    ],
    locations: [
      {
        id: "lounge",
        name: "Grand Lounge",
        image: "./scenes/venus-lounge.webp",
        clues: [
          { id: "case", label: "The Empty Jewel Case", top: "64%", left: "28%", width: "42%", height: "28%" },
          { id: "bandstand", label: "The Bandstand", top: "30%", left: "3%", width: "31%", height: "24%" },
          { id: "keys", label: "Reception Key Board", top: "20%", left: "86%", width: "11%", height: "36%" },
        ],
      },
      {
        id: "conservatory",
        name: "Orchid Conservatory",
        image: "./scenes/venus-conservatory.webp",
        clues: [
          { id: "fog-machine", label: "The Fog Machine", top: "15%", left: "3%", width: "18%", height: "55%" },
          { id: "orchids", label: "Orchid Bed", top: "38%", left: "28%", width: "30%", height: "40%" },
          { id: "locker", label: "Locked Staff Locker", lock: { dials: 3 }, top: "40%", left: "86%", width: "11%", height: "48%" },
        ],
      },
    ],
    suspects: [
      {
        id: "lune",
        name: "Maestro Felix Lune",
        title: "Lounge Bandleader",
        portrait: "./game/suspect-lune.webp",
        description: "Conducts the resort orchestra, and conducts himself like a star. Adores a sparkle.",
      },
      {
        id: "fenwick",
        name: "Dr. Iris Fenwick",
        title: "Resort Botanist",
        portrait: "./game/suspect-fenwick.webp",
        description: "Runs the Orchid Conservatory, and the fog machine that keeps it misty.",
      },
      {
        id: "vance",
        name: "Captain Teddy Vance",
        title: "Sky-Gondola Pilot",
        portrait: "./game/suspect-vance.webp",
        description: "Flies guests between the cloud islands. Everybody's favorite captain.",
      },
    ],
    accusePrompt: "Who is the Fog Phantom?",
    fragment: {
      id: "venusian-quadrant",
      number: 3,
      name: "The Venusian Quadrant",
      caption: "Tucked in the lining of the Star of Venus's velvet case: Aurora Sterling's chart of the Venus cloud-lanes, with a gold arrow pointing out past the asteroid belt, toward the giant planets.",
    },
  },
  {
    id: "saturn-orrery",
    title: "The Stopped Orrery",
    planet: "Saturn",
    reward: 1600,
    available: true,
    requires: ["red-sands", "venus-fog"],
    teaser: "The golden orrery aboard the Ring Line Express stopped mid-journey, and its master gear is gone.",
    briefing:
      "The Ring Line Express glides around Saturn on a track laid across the rings themselves, and its pride is the Sterling Orrery: a golden clockwork model of the solar system that Aurora Sterling gave to the Saturn colonies. Last night, somewhere between the Cassini Gap and the Titan Transfer, it stopped. Its master gear, the Saturn Gear, is missing. The Ring Line is paying 1,600 credits to get it back. Search the Observatory Car and the Dining Car, question the three passengers who were awake that night, and catch whoever is lying.",
    // Six scene clues plus the culprit's lie. Lady Ashgrove's pawn-ticket lie stays
    // available, and it is not required before you can name someone.
    cluesNeeded: 7,
    breakthroughs: ["breakthrough-1", "breakthrough-2"],
    locations: [
      {
        id: "observatory",
        name: "Observatory Car",
        image: "./scenes/saturn-observatory.webp",
        clues: [
          { id: "orrery", label: "The Sterling Orrery", grants: "orrery-key", top: "18%", left: "38%", width: "34%", height: "62%" },
          { id: "telescope", label: "The Great Telescope", top: "5%", left: "74%", width: "23%", height: "42%" },
          { id: "guestbook", label: "Observatory Guestbook", top: "60%", left: "3%", width: "30%", height: "22%" },
        ],
      },
      {
        id: "dining",
        name: "Dining Car",
        image: "./scenes/saturn-dining.webp",
        clues: [
          { id: "table", label: "Table for One", top: "55%", left: "3%", width: "47%", height: "30%" },
          { id: "galley", label: "The Galley", top: "15%", left: "50%", width: "17%", height: "55%" },
          { id: "luggage", label: "Baggage Rack", top: "5%", left: "70%", width: "27%", height: "25%" },
        ],
      },
    ],
    interviews: [
      {
        suspect: "ashgrove",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "orrery", label: "What do you make of the orrery?" },
          { id: "money", label: "About that pawn ticket…", after: "guestbook" },
        ],
      },
      {
        suspect: "tuttle",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "the-key", label: "Who can open the orrery?" },
          { id: "case", label: "What's in your velvet case?", after: "luggage" },
        ],
      },
      {
        suspect: "pip",
        topics: [
          { id: "night", label: "What did you do last night?" },
          { id: "tuttle", label: "Tell me about the Professor." },
          { id: "chime", label: "Anything odd about the orrery?" },
        ],
      },
    ],
    suspects: [
      {
        id: "ashgrove",
        name: "Lady Vivienne Ashgrove",
        title: "Society Collector",
        portrait: "./game/suspect-ashgrove.webp",
        description: "Collects antique clocks, and makes sure everyone knows it.",
      },
      {
        id: "tuttle",
        name: "Professor Orson Tuttle",
        title: "Keeper of the Orrery",
        portrait: "./game/suspect-tuttle.webp",
        description: "Has tended the Sterling Orrery for thirty years. Very calm about all this.",
      },
      {
        id: "pip",
        name: "Pip Kettleby",
        title: "Ring Line Porter",
        portrait: "./game/suspect-pip.webp",
        description: "Knows every cabin on the train. Runs on cocoa and good intentions.",
      },
    ],
    accusePrompt: "Who took the Saturn Gear?",
    fragment: {
      id: "saturnian-quadrant",
      number: 4,
      name: "The Saturnian Quadrant",
      caption: "Engraved on the back of the Saturn Gear, too small to see without a loupe: a chart of Saturn's moons in Aurora Sterling's own hand, and a line of gold stars leading on toward Uranus and Neptune.",
    },
  },
  {
    id: "neptune-deep",
    title: "The Golden Submarine",
    planet: "Neptune",
    reward: 2000,
    available: true,
    requires: ["saturn-orrery"],
    replayNote: "Each replay, the thief hides somewhere other than your last run. Read the sonar tape again.",
    // All six scene clues (the chart included) plus the thief's lie. Captain Brine's
    // tall tale is there to catch too; it is not required and does not count.
    cluesNeeded: 7,
    breakthroughs: ["breakthrough-1", "breakthrough-2"],
    interviews: [
      {
        suspect: "coralie",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "sequin", label: "Whose sequin is on the cleat?", after: "berth" },
          { id: "book", label: "Reading up on Aurora's fortune?", after: "stage-door" },
        ],
      },
      {
        suspect: "brine",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "berth", label: "You wanted the Tomorrow's berth?" },
          { id: "deep", label: "Did your tour go near the Deep?", after: "sonar" },
        ],
      },
      {
        suspect: "rusty",
        topics: [
          { id: "night", label: "Where were you last night?" },
          { id: "gold", label: "Finders keepers?" },
        ],
      },
    ],
    teaser: "Aurora Sterling's own golden submarine vanished from its berth, deep beneath Neptune's sea.",
    briefing:
      "On the floor of Neptune's blue sea sits the Aquadome, a glass city of promenades, coral gardens and the famous Aquacade. Its pride is the Tomorrow, the golden submarine Aurora Sterling piloted herself. Last night it slipped out of the Sterling Submarine Pen and vanished into the deep. The Aquadome is paying 2,000 credits to get it back. Search the Submarine Pen and the Glass Promenade, work out on the harbor chart where the thief hid her, send down the diving bell, then name your culprit.",
    locations: [
      {
        id: "pen",
        name: "Sterling Submarine Pen",
        image: "./scenes/neptune-pen.webp",
        clues: [
          { id: "berth", label: "The Tomorrow's Empty Berth", top: "55%", left: "44%", width: "32%", height: "30%" },
          { id: "chamber", label: "Decompression Chamber", top: "18%", left: "77%", width: "18%", height: "62%" },
          {
            id: "chart",
            label: "Harbor Master's Sea Chart",
            chart: {
              cols: 6,
              rows: 5,
              deep: ["C1", "C2", "D2", "C3", "D3", "E3", "B4", "C4", "D4", "C5"],
              lit: ["D3", "E3", "F3", "D4", "E4", "F4", "D5", "E5", "F5"],
              marks: [
                { cell: "F1", name: "The Aquadome", icon: "dome" },
                { cell: "D2", name: "Wreck of the Sea Queen", icon: "wreck" },
                { cell: "A3", name: "The Coral Arch", icon: "arch" },
                { cell: "E4", name: "The Beacon", icon: "beacon" },
                { cell: "A5", name: "Kelp Forest", icon: "kelp" },
              ],
            },
            top: "68%", left: "3%", width: "41%", height: "28%",
          },
        ],
      },
      {
        id: "promenade",
        name: "The Glass Promenade",
        image: "./scenes/neptune-promenade.webp",
        clues: [
          { id: "sonar", label: "Sonar Lookout", top: "40%", left: "3%", width: "34%", height: "55%" },
          { id: "beacon", label: "Call Box to the Beacon", top: "22%", left: "44%", width: "16%", height: "52%" },
          { id: "stage-door", label: "Aquacade Stage Door", top: "10%", left: "79%", width: "18%", height: "64%" },
        ],
      },
    ],
    suspects: [
      {
        id: "coralie",
        name: "Coralie Finn",
        title: "Star of the Aquacade",
        portrait: "./game/suspect-coralie.webp",
        description: "The Mermaid of Neptune. Holds her breath for four minutes, and her audience for two hours.",
      },
      {
        id: "brine",
        name: "Captain Silas Brine",
        title: "Tour Submarine Skipper",
        portrait: "./game/suspect-brine.webp",
        description: "Runs the Neptune Belle's glass-bottom tours. Calls the Tomorrow \"that gold-plated bathtub\" and wants her berth.",
      },
      {
        id: "rusty",
        name: "\"Rusty\" Mackerel",
        title: "Salvage Diver",
        portrait: "./game/suspect-rusty.webp",
        description: "Says anything that sinks is finders-keepers. Has strong opinions about gold.",
      },
    ],
    accusePrompt: "Who took the Tomorrow?",
    fragment: {
      id: "neptunian-quadrant",
      number: 5,
      name: "The Neptunian Quadrant",
      caption: "The thief emptied every chart drawer aboard the Tomorrow, but never thought to unscrew the ship's wheel. Inside its golden hub: Aurora Sterling's chart of Neptune's seas, with a line of gold stars doubling back toward Uranus and its moons.",
    },
  },
];

export function bountyById(id: string): Bounty | undefined {
  return BOUNTIES.find((b) => b.id === id);
}

// Contracts open in order. A bounty the hunter already started or collected stays open
// (so hunters who played before the order existed keep their place).
export function isBountyUnlocked(
  bounty: Bounty,
  completedBounties: readonly string[],
  startedBounties: readonly string[] = [],
): boolean {
  return completedBounties.includes(bounty.id)
    || startedBounties.includes(bounty.id)
    || (bounty.requires ?? []).every((id) => completedBounties.includes(id));
}

// Jobs still open on the cover: unlocked, live, and not yet collected.
export function openJobs(
  bounties: readonly Bounty[],
  completed: readonly string[],
  started: readonly string[] = [],
): number {
  return bounties.filter((b) => b.available && isBountyUnlocked(b, completed, started) && !completed.includes(b.id)).length;
}

// The cover badge. A finished Act I chart says so; otherwise it counts the jobs left.
export function jobsBadge(open: number, finished: boolean): { figure: string; caption: string } {
  if (finished && open === 0) return { figure: "REPLAY", caption: "ACT I" };
  return { figure: String(open), caption: "JOBS" };
}

export type HubBadge =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; figure: string; caption: string };

// No profile yet: an error can be retried. A profile shows the jobs that are left.
export function hubBadgeState(
  player: { completedBounties: readonly string[]; startedBounties: readonly string[] } | null,
  isError: boolean,
  bounties: readonly Bounty[],
): HubBadge {
  if (!player) return isError ? { kind: "error" } : { kind: "loading" };
  const live = bounties.filter((b) => b.available);
  const open = openJobs(live, player.completedBounties, player.startedBounties);
  const finished = live.every((b) => player.completedBounties.includes(b.id));
  return { kind: "ready", ...jobsBadge(open, finished) };
}

// A claim with no open showdown. A finished replay can be retried; anything else still needs the culprit.
export function claimWithoutShowdown(hasReceipt: boolean): "already_collected" | "name_the_culprit" {
  return hasReceipt ? "already_collected" : "name_the_culprit";
}

export function creditsLabel(credits: number | null, failed = false): string {
  if (credits === null && failed) return "? credits";
  return credits === null ? "…" : `${credits.toLocaleString()} credits`;
}

// A shot lands if it reaches the server inside the draw window, plus a short allowance for the request.
export function shotLands(elapsedMs: number, windowMs: number, graceMs = 1000): boolean {
  return elapsedMs >= 0 && elapsedMs <= windowMs + graceMs;
}

export function shopButtonLabel(opts: {
  comingSoon: boolean;
  playerReady: boolean;
  owned: boolean;
  affordable: boolean;
  profileError?: boolean;
}): string {
  if (opts.comingSoon) return "Coming soon";
  if (!opts.playerReady) return opts.profileError ? "Profile didn't load" : "Checking…";
  if (opts.owned) return "✓ Owned";
  if (opts.affordable) return "Buy";
  return "Need more credits";
}

// A poster contract before the hunter profile exists. Empty arrays are not a profile.
export function contractLinkPhase(
  bounty: Bounty | undefined,
  player: { completedBounties: readonly string[]; startedBounties: readonly string[] } | null,
  load: "pending" | "error" | "ready",
): "hidden" | "checking" | "error" | "locked" | "collected" | "open" {
  if (!bounty?.available) return "hidden";
  if (!player) return load === "error" ? "error" : "checking";
  if (!isBountyUnlocked(bounty, player.completedBounties, player.startedBounties)) return "locked";
  return player.completedBounties.includes(bounty.id) ? "collected" : "open";
}

// The case-file action row. A missing notebook is not an empty one.
export function caseFileGate(opts: {
  playerReady: boolean;
  playerError: boolean;
  unlocked: boolean;
  progressReady: boolean;
  progressError: boolean;
}): "checking" | "hunter-error" | "locked" | "progress-error" | "start" {
  if (!opts.playerReady) return opts.playerError ? "hunter-error" : "checking";
  if (!opts.unlocked) return "locked";
  if (!opts.progressReady) return opts.progressError ? "progress-error" : "checking";
  return "start";
}

// "🔒 Complete The Heart of Luna Heist first", shown instead of "Take the job".
export function lockedLabel(bounty: Bounty): string {
  const titles = (bounty.requires ?? []).map((id) => bountyById(id)?.title ?? id);
  return `🔒 Complete ${titles.join(" and ")} first`;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
export const numeral = (n: number) => NUMERALS[n - 1] ?? String(n);

// Shift letters by n (Caesar cipher); everything else is left alone.
export function shiftLetters(text: string, n: number): string {
  return text.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + n) % 26 + 26) % 26 + 65));
}

// Hunter rank grows with bounties collected.
export const RANKS = [
  { min: 0, title: "Greenhorn" },
  { min: 1, title: "Deputy" },
  { min: 2, title: "Marshal" },
  { min: 4, title: "Star Ranger" },
  { min: 7, title: "Legend of the Spaceways" },
] as const;

export function hunterRank(bounties: number): { title: string; next?: { title: string; needed: number } } {
  let i = 0;
  while (i + 1 < RANKS.length && bounties >= RANKS[i + 1].min) i++;
  const next = RANKS[i + 1];
  return { title: RANKS[i].title, ...(next ? { next: { title: next.title, needed: next.min - bounties } } : {}) };
}

// What the office says under the rank. Clearing every live contract is the end of
// Act I, even when a higher title still sits past this chart.
export function rankLine(completed: number, liveContracts: number): string | null {
  const rank = hunterRank(completed);
  if (!rank.next) return null;
  const left = Math.max(0, liveContracts - completed);
  if (left === 0) return `Act I charted. ${rank.next.title} is a rank this chart does not reach.`;
  if (rank.next.needed > left) return left === 1 ? "1 contract left on this chart." : `${left} contracts left on this chart.`;
  const n = rank.next.needed;
  return `${n} more bount${n === 1 ? "y" : "ies"} to ${rank.next.title}`;
}

// How many fragments a live contract can turn up. The other sectors stay blank.
export const LIVE_CHART_COUNT = BOUNTIES.filter((b) => b.available && b.fragment).length;

// The hunter's own progress on this chart. A full set is the end of Act I.
export function chartLine(held: number, live = LIVE_CHART_COUNT): string {
  const n = Math.max(0, Math.min(held, live));
  if (live > 0 && n >= live) return `Act I charted. ${live} of ${live} on this chart.`;
  return `${n} of ${live} on this chart.`;
}


// Clues a hunter must find before naming a suspect (server and browser agree on this).
export function cluesNeeded(bounty: Bounty): number {
  return bounty.cluesNeeded ?? (bounty.locations ?? []).reduce((n, l) => n + l.clues.length, 0) + (bounty.breakthroughs?.length ?? 0);
}

// What counts toward naming someone: scene clues, plus the lies the case requires.
// An optional lie (a red herring) never stands in for a scene clue or a puzzle.
export function accusationCount(bounty: Bounty, found: readonly string[], requiredLies: readonly string[] = []): number {
  const scene = new Set((bounty.locations ?? []).flatMap((l) => l.clues).map((c) => c.id));
  return found.filter((id) => scene.has(id) || requiredLies.includes(id)).length;
}

// Cases with no interviews can be named as soon as the count is met.
// A case with interviews stays on the server's canAccuse, so a lie is never treated as already caught.
export function readyWithoutInterview(bounty: Bounty | undefined, found: Record<string, string>): boolean | null {
  if (!bounty || bounty.interviews) return null;
  return accusationCount(bounty, Object.keys(found)) >= cluesNeeded(bounty);
}

// The accuse button. The lie line names no one, and it only shows once a required interview is still open.
export function accuseLabel(opts: {
  interviews: boolean;
  canAccuse: boolean;
  needsLie: boolean;
  foundCount: number;
  needed: number;
}): string {
  const counted = opts.foundCount >= opts.needed;
  const ready = opts.canAccuse && counted;
  const left = opts.needed - opts.foundCount;
  if (ready) return "★ Name your suspect";
  if (opts.interviews && opts.needsLie && opts.foundCount >= opts.needed - 1) return "Catch the lie that doesn't add up";
  if (counted) return "Checking the notebook…";
  return `Find ${left} more clue${left === 1 ? "" : "s"}`;
}

// Aurelia: the private planet of the rich. Hunters are invited once they've
// recovered this many star map pieces.
export const AURELIA_INVITE_FRAGMENTS = 3;

export function invitedToAurelia(completedBounties: readonly string[]): boolean {
  return fragmentsFor(completedBounties).length >= AURELIA_INVITE_FRAGMENTS;
}

// True when collecting this bounty is what earned the invitation.
export function bountyEarnedInvite(completedBounties: readonly string[], bountyId: string): boolean {
  return invitedToAurelia(completedBounties) && !invitedToAurelia(completedBounties.filter((id) => id !== bountyId));
}

export interface AureliaSpot {
  id: string;
  label: string;
  text: string;
  top: string;
  left: string;
  width: string;
  height: string;
}

export interface AureliaLocation {
  id: string;
  name: string;
  image: string;
  spots: AureliaSpot[];
}

export const MAP_FRAGMENTS: MapFragment[] = BOUNTIES.flatMap((b) => (b.fragment ? [b.fragment] : []));

// Fragments a player holds, from the bounties they've collected.
export function fragmentsFor(completedBounties: readonly string[]): MapFragment[] {
  return BOUNTIES.filter((b) => b.fragment && completedBounties.includes(b.id)).map((b) => b.fragment!);
}

// Community progress on the star map (public, no player identities).
export interface StarMapStatus {
  total: number;
  // How many hunters have recovered each known fragment (0 = still lost)
  fragments: { id: string; hunters: number }[];
  // Hunters holding at least one fragment
  searchers: number;
}

// Revealed by the server only after a correct accusation (keeps the culprit out of the bundle).
export interface CaseSolution {
  showdown: { opponent: string; image: string; taunt: string; scene?: string };
  outro: string;
}

// A hunter's progress on one bounty, as the server records it.
export interface BountyProgress {
  // Clues found so far (decoded ones included), with their text
  found: Record<string, string>;
  // Lies already caught: "<suspect>/<topic>" -> breakthrough id
  caught?: Record<string, string>;
  // Set once the hunter has named the right suspect (lets a refresh return to the duel)
  accused?: { suspect: string } & CaseSolution;
  // Enough is on record to name someone. False when a required lie is still missing.
  canAccuse: boolean;
  // This showdown started after the bounty was collected: an unfinished replay duel.
  replayDuel?: boolean;
  // A required interview is still open. Does not name the speaker.
  needsLie: boolean;
  // How many finds count toward naming someone (scene clues plus required lies; optional
  // lies don't count). Only the server knows which lies are required.
  counted?: number;
}

// Remember a correct accusation in the notebook the case file already has open.
export function withAccusation(progress: BountyProgress, suspect: string, solution: CaseSolution, replayDuel = progress.replayDuel): BountyProgress {
  return {
    ...progress,
    accused: { suspect, showdown: solution.showdown, outro: solution.outro },
    ...(replayDuel ? { replayDuel: true } : {}),
  };
}

// A won replay duel is over. The notebook stays. The showdown button does not.
export function closeReplayDuel(progress: BountyProgress): BountyProgress {
  const next: BountyProgress = { ...progress, replayDuel: false };
  delete next.accused;
  return next;
}

// A caught lie names who said it, in the same notebook update as the breakthrough text.
export function withCaught(progress: BountyProgress, suspect: string, topic: string, id: string): BountyProgress {
  return { ...progress, caught: { ...(progress.caught ?? {}), [`${suspect}/${topic}`]: id } };
}

// The first duel of a collected case stays closed. A replay that names the culprit again
// (its showdown starts after the claim) can be resumed. One-time payouts stay one-time.
export function showResume(collected: boolean, hasShowdown: boolean, replayDuel = false): boolean {
  if (!hasShowdown) return false;
  if (!collected) return true;
  return replayDuel;
}

// The accusation screen. A collected case already settled its seal.
export function accuseSealCopy(collected: boolean): string {
  const lead = "Pick your suspect, then the clue from your notebook that proves it. ";
  if (collected) {
    return lead + "The Clean Case seal was settled on your first collection. A wrong guess on this replay never changes it.";
  }
  return lead + "Crack the case on your first try to earn a ★ Clean Case seal. A wrong guess never costs you credits.";
}

// The done screen. A replay still shows the seal, labeled as the first collection's.
export function cleanCaseCopy(firstCollection: boolean): string {
  return firstCollection
    ? "★ Clean Case: solved on your first accusation"
    : "★ Clean Case: earned on your first collection";
}

// The done screen. A replay keeps the ending, and says the bounty already paid.
export function doneCopy(outro: string | undefined, paid: boolean, reward: number): string {
  const ending = outro?.trim() ? outro.trim() : "Case closed.";
  if (paid) return `${ending} ${reward} credits are yours — spend them at the Outfitters.`;
  return `${ending} You already collected this bounty. Each bounty only pays once per hunter.`;
}

// A caught lie stays visible after the interview panel unmounts. The server record is enough.
export function topicCaught(
  caughtTopics: Record<string, string>,
  found: Record<string, string>,
  suspect: string,
  topic: string,
): boolean {
  const id = caughtTopics[`${suspect}/${topic}`];
  return id !== undefined && found[id] !== undefined;
}

// Result of searching a clue: its text, or the coded message if it needs decoding.
export type ClueSearch =
  | { text: string; coded?: undefined; locked?: undefined }
  | { coded: string; text?: undefined; locked?: undefined }
  | { locked: true; text?: undefined; coded?: undefined };

// Public player profile returned by the API (no visitorId).
export interface PlayerProfile {
  callsign: string;
  credits: number;
  suit: SuitId;
  owned: ShopItemId[];
  completedBounties: string[];
  // Bounties with any recorded progress (clues, a showdown or a claim)
  startedBounties: string[];
  // Bounties collected without a single wrong accusation
  cleanBounties: string[];
  items: ItemId[];
}

// The Guild Wire: recent case closures, shown on the hub beside world arrivals.
export interface WireEntry {
  callsign: string;
  bountyId: string;
  clean: boolean;
}

export function wireLine(entry: WireEntry): string | null {
  const bounty = bountyById(entry.bountyId);
  if (!bounty) return null;
  return `${entry.callsign} closed ${bounty.title}${entry.clean ? " ★ clean case" : ""}`;
}

// Closures first, then arrivals, alternating so neither crowds out the other.
export function tickerLines(wire: readonly WireEntry[], arrivals: readonly string[], limit = 8): string[] {
  const closed = wire.map(wireLine).filter((l): l is string => l !== null);
  const out: string[] = [];
  for (let i = 0; out.length < limit && (i < closed.length || i < arrivals.length); i++) {
    if (i < closed.length) out.push(closed[i]);
    if (i < arrivals.length && out.length < limit) out.push(arrivals[i]);
  }
  return out;
}

export interface LeaderboardEntry {
  callsign: string;
  earned: number;
  bounties: number;
  cleanCount: number;
  starred: boolean;
}
