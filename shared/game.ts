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
  { id: "suit-red", name: "Pulp Red Suit", price: 150, description: "Loud, proud, and visible from orbit.", comingSoon: true },
  { id: "suit-teal", name: "Atomic Teal Suit", price: 150, description: "Cool as the far side of the Moon.", comingSoon: true },
  { id: "suit-gold", name: "Gold Rush Suit", price: 250, description: "For hunters who want the whole saloon to know they've arrived.", comingSoon: true },
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

export interface Clue {
  id: string;
  label: string;
  text: string;
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
    available: false,
    teaser: "Someone's stealing water rigs from the Martian dome farms. Coming soon.",
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
  showdown: { opponent: string; image: string; taunt: string };
  outro: string;
}

// Public player profile returned by the API (no visitorId).
export interface PlayerProfile {
  callsign: string;
  credits: number;
  suit: SuitId;
  owned: ShopItemId[];
  completedBounties: string[];
}

export interface LeaderboardEntry {
  callsign: string;
  earned: number;
  bounties: number;
}
