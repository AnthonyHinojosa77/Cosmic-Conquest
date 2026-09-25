// Bounty Hunter game content shared by server and client.
// Solutions are NOT here — they live server-side in server/bounties.ts.

export type SuitId = "silver" | "red" | "teal" | "gold";
export type GearId = "raygun";
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
  { id: "suit-red", name: "Pulp Red Suit", price: 150, description: "Loud, proud, and visible from orbit." },
  { id: "suit-teal", name: "Atomic Teal Suit", price: 150, description: "Cool as the far side of the Moon." },
  { id: "suit-gold", name: "Gold Rush Suit", price: 250, description: "For hunters who want the whole saloon to know they've arrived." },
];

// Only items that can actually be bought right now
export function shopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id && !i.comingSoon);
}

export function suitForItem(id: ShopItemId): SuitId | null {
  return id.startsWith("suit-") ? (id.slice(5) as SuitId) : null;
}

// Quick-draw reaction window in ms; the Lucky Ray-Gun widens it.
export const DRAW_WINDOW_MS = 500;
export const DRAW_WINDOW_RAYGUN_MS = 750;

// Items found during bounties stay in the hunter's satchel for later jobs.
export type ItemId = "decoder-ring";

export const ITEMS: Record<ItemId, { name: string; description: string }> = {
  "decoder-ring": {
    name: "Junior Ranger Decoder Ring",
    description: "Brass, Sterling Atomic issue. Engraved inside: \"Set your key to the number of moons of your world.\"",
  },
};

export interface Clue {
  id: string;
  label: string;
  text: string;
  // Searching this clue hands the hunter an item
  grants?: ItemId;
  // The clue is in code: shown shifted by `key` letters until decoded with `requires`
  cipher?: { requires: ItemId; key: number };
  // Hotspot position over the scene image (percent)
  top: string;
  left: string;
  width: string;
  height: string;
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

// Sterling's star map: each bounty turns up one fragment. The map is meant to
// be large; the other fragments arrive with future bounties and worlds.
export const STAR_MAP_SIZE = 12;

export interface MapFragment {
  id: string;
  number: number; // position on the map, 1..STAR_MAP_SIZE
  name: string;
  caption: string;
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
    cluesNeeded: 4,
    locations: [
      {
        id: "expo",
        name: "The Atomic Expo",
        image: "./scenes/expo-scene.webp",
        clues: [
          {
            id: "dome",
            label: "Moon Colony Dome",
            text: "The glass dome is intact, but the base panel was unscrewed and put back crooked. There's a sticky smear of malt syrup on the screws — and a trail of glittering moon dust leading toward the exit.",
            top: "37%", left: "30%", width: "30%", height: "33%",
          },
          {
            id: "robot",
            label: "RB-9's Memory Tape",
            text: "You rewind the Robot Butler's memory tape. 11:52 PM: 'Good evening, sir. The Expo is closed.' The late visitor wore a paper diner cap and smelled strongly of fry oil. Dr. Gearhart, RB-9's inventor, had locked up and gone home at six.",
            top: "39%", left: "70.5%", width: "10%", height: "37%",
          },
          {
            id: "videophone",
            label: "Videophone Call Log",
            text: "The booth's call log shows Madame Vela Quasar on a single call to Mars from 10:15 PM to 1:40 AM — the light-delay charges alone cost her a fortune. She never left the booth.",
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
            text: "The Moon Malt mixer is clogged with something that glitters. Moon dust, and plenty of it. Whoever was back here last night wasn't making milkshakes.",
            top: "50%", left: "43%", width: "8%", height: "17%",
          },
          {
            id: "servo",
            label: "Servo the Robot Waiter",
            text: "Servo's eyes flicker. 'Cookie clocked out early last night, sir. He took his lunchbox — it looked very heavy. He hasn't come in for his shift today.'",
            top: "22%", left: "62%", width: "34%", height: "50%",
          },
          {
            id: "jukebox",
            label: "Atomic Jukebox",
            text: "Tucked behind the jukebox: a paper diner cap with 'COOKIE' stitched on the band, dusted with moon glitter. Someone left in a hurry.",
            top: "36%", left: "1%", width: "16%", height: "34%",
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
        id: "vela",
        name: "Madame Vela Quasar",
        title: "Videophone Saleswoman",
        portrait: "./game/suspect-vela.webp",
        description: "Sells the future one long-distance call at a time. Always on the line.",
      },
      {
        id: "cookie",
        name: "\"Cookie\" Carmichael",
        title: "Astro Diner Fry Cook",
        portrait: "./game/suspect-cookie.webp",
        description: "Flips a mean Rocket Burger. Talks a lot about 'retiring somewhere shiny.'",
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
    teaser: "Chrome Rain-Makers are vanishing from the Ares Valley dome farms, one Friday night at a time.",
    briefing:
      "Out in Mars's Ares Valley, Sterling Atomic's glass-domed farms turn red dust into green fields, thanks to towering chrome Rain-Makers that pull water right out of the thin Martian air. Someone's been rustling them: three towers gone in three weeks. The Valley Growers' Cooperative is paying 800 credits to whoever stops it. Search the Hydro-Dome and the Red Sands freight depot, then name your rustler.",
    cluesNeeded: 6,
    locations: [
      {
        id: "hydro-dome",
        name: "Ares Valley Hydro-Dome",
        image: "./scenes/mars-farm.webp",
        clues: [
          {
            id: "pad",
            label: "Empty Rain-Maker Pad",
            text: "Where a Rain-Maker stood last night there's only bare concrete. The four bolts were undone neatly with a proper wrench, not ripped out. Narrow paired wheel tracks lead to the dome's freight door: a monorail freight dolly.",
            top: "60%", left: "28%", width: "40%", height: "16%",
          },
          {
            id: "sprinkles",
            label: "Sprinkles the Farm Robot",
            text: "Sprinkles plays back his memory tape: \"The Rain-Makers always go missing on a Friday night, sir, just before the 2:10 freight monorail leaves for Phobos.\" Then he pops open his chest drawer and hands you something from the lost-and-found: a brass decoder ring.",
            grants: "decoder-ring",
            top: "45%", left: "70%", width: "16%", height: "33%",
          },
          {
            id: "lab",
            label: "Professor Venn's Lab",
            text: "Professor Venn has been asking Sterling Atomic to scrap the old Rain-Makers for her new design, which looks bad. But the lab's door log shows she badged in at 8 PM last Friday and didn't leave until sunrise, and the night camera shows her at her bench the whole time.",
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
            text: "Dusty Dunmore's racing skiff is caked in dust and its engine is stone cold. On the seat: a race ticket for the Olympus Mons Rally, last Friday from 9 PM to dawn. He finished second. Besides, a skiff this size couldn't haul a Rain-Maker.",
            top: "20%", left: "63%", width: "35%", height: "62%",
          },
          {
            id: "crates",
            label: "Canned Sunshine Crates",
            text: "The crates say CANNED SUNSHINE, but one is far too heavy, and a chrome fin pokes through the slats. The shipping label: \"To Phobos Station. Checked and sealed by the freight clerk on duty.\"",
            top: "44%", left: "29%", width: "21%", height: "26%",
          },
          {
            id: "telegram",
            label: "Coded Telegram",
            text: "TEN MORE RAIN-MAKERS READY FRIDAY. CRATE THEM AS CANNED SUNSHINE. PHOBOS BUYER PAYS DOUBLE. SIGNED, Q.",
            cipher: { requires: "decoder-ring", key: 2 },
            top: "27%", left: "3%", width: "17%", height: "30%",
          },
        ],
      },
    ],
    suspects: [
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
      {
        id: "quill",
        name: "Rigby Quill",
        title: "Monorail Freight Clerk",
        portrait: "./game/suspect-quill.webp",
        description: "Knows every crate that leaves the Red Sands depot. Lately he's been buying rounds.",
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
    available: false,
    teaser: "A masked jewel thief hides in the tropical fog of Venus. Coming soon.",
  },
];

export function bountyById(id: string): Bounty | undefined {
  return BOUNTIES.find((b) => b.id === id);
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

// Bounties that hand out an item, so the server only grants items that exist in play.
export function itemAvailable(id: string): id is ItemId {
  return BOUNTIES.some((b) => b.available && b.locations?.some((l) => l.clues.some((c) => c.grants === id)));
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

// Public player profile returned by the API (no visitorId).
export interface PlayerProfile {
  callsign: string;
  credits: number;
  suit: SuitId;
  owned: ShopItemId[];
  completedBounties: string[];
  items: ItemId[];
}

export interface LeaderboardEntry {
  callsign: string;
  earned: number;
  bounties: number;
}
