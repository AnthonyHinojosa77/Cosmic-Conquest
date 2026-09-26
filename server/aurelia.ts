import { hunterRank } from "@shared/game";
import type { AureliaLocation } from "@shared/game";

// What each solved case leaves in the Guild's trophy case.
const TROPHIES: Record<string, string> = {
  "heart-of-luna": "a replica of the Heart of Luna",
  "red-sands": "a chrome fin from an Ares Valley Rain-Maker",
  "venus-fog": "a photograph of the Star of Venus",
  "saturn-orrery": "a brass rubbing of the Saturn Gear",
};

// Aurelia's text is served only to invited hunters (it isn't in the browser bundle).
// The scene images are ordinary public files; only the words and the way in are gated.
// Act I: wonder only. Aurora's disappearance is hinted at, never explained.
export function aureliaFor(callsign: string, completedBounties: readonly string[]): AureliaLocation[] {
  const rank = hunterRank(completedBounties.length).title;
  const trophies = completedBounties.flatMap((id) => (TROPHIES[id] ? [TROPHIES[id]] : []));
  const trophyList =
    trophies.length > 1 ? `${trophies.slice(0, -1).join(", ")} and ${trophies[trophies.length - 1]}` : trophies[0] ?? "your first case file";
  return [
    {
      id: "plaza",
      name: "The Grand Staircase",
      image: "./scenes/aurelia-plaza.webp",
      spots: [
        {
          id: "statue",
          label: "The Spirit of Aurelia",
          text: "Cast in solid Venus gold, the Spirit of Aurelia holds up a ring of the planets. The plaque at her feet reads \"Built for the bold.\" Guests toss coins into her fountain for luck before a night at the Stardust Ballroom.",
          top: "5%", left: "2%", width: "20%", height: "50%",
        },
        {
          id: "searchlights",
          label: "The Searchlights",
          text: "Every searchlight in Aurelia points up. It's written into the city charter: Aurora Sterling wanted her city always looking toward the stars.",
          top: "2%", left: "28%", width: "15%", height: "33%",
        },
        {
          id: "tower",
          label: "Sterling Tower",
          text: "The tallest building in the solar system, crowned with a golden star that's lit every night of the year. It has never once gone dark, not even the night Aurora Sterling's last broadcast went out.",
          top: "3%", left: "46%", width: "24%", height: "55%",
        },
        {
          id: "staircase",
          label: "The Grand Staircase",
          text: `Three hundred steps and no escalator, on purpose. "In Aurelia," the doorman robots like to say, "one arrives." Tonight's crowd is climbing toward the Stardust Ballroom, and for once a bounty hunter, ${callsign}, is climbing with them.`,
          top: "60%", left: "20%", width: "30%", height: "38%",
        },
      ],
    },
    {
      id: "guild",
      name: "Bounty Guild Headquarters",
      image: "./scenes/aurelia-guild.webp",
      spots: [
        {
          id: "board",
          label: "The Contracts Board",
          text: "The great board clatters as its brass tiles flip. Every bounty in the solar system is posted here first, long before it reaches frontier offices like yours. Tonight the tiles are blank. \"New contracts arriving soon,\" a clerk murmurs.",
          top: "25%", left: "31%", width: "37%", height: "37%",
        },
        {
          id: "registrar",
          label: "The Registrar's Desk",
          text: `The Registrar opens the file marked ${callsign}, ${rank}, every closed case stamped in gold, and slides an embossed Guild card across the desk. "Welcome to the inner circle. Not many frontier hunters ever see this room."`,
          top: "48%", left: "2%", width: "34%", height: "40%",
        },
        {
          id: "trophies",
          label: "The Trophy Case",
          text: `Behind the glass: ${trophyList}. Each brass plate reads "Recovered by ${callsign}."`,
          top: "50%", left: "77%", width: "21%", height: "30%",
        },
        {
          id: "charter",
          label: "The Guild Charter",
          text: "Cast in bronze and signed by Aurora Sterling herself: \"No contract shall be served within the walls of Aurelia.\" In this city the Guild keeps its offices, and its hunters keep their blasters holstered.",
          top: "3%", left: "83%", width: "14%", height: "44%",
        },
      ],
    },
    {
      id: "tower",
      name: "Sterling Tower Lobby",
      image: "./scenes/aurelia-tower.webp",
      spots: [
        {
          id: "portrait",
          label: "Portrait of Aurora Sterling",
          text: "Aurora Sterling, painted the year she founded Sterling Atomic. Visitors stand here a long time. Up close you notice the stars in the painting aren't random: they match the pieces of her star map.",
          top: "5%", left: "37%", width: "27%", height: "47%",
        },
        {
          id: "lilies",
          label: "White Lilies",
          text: "Fresh white lilies are placed beneath the portrait every morning at six. They were her favorite, the concierge says, and the standing order has never been cancelled.",
          top: "54%", left: "44%", width: "16%", height: "26%",
        },
        {
          id: "elevator",
          label: "The Penthouse Elevator",
          text: "The private elevator to the penthouse. The velvet rope has been up since the night of her last broadcast. The brass needle above the doors still points to the top floor.",
          top: "28%", left: "79%", width: "15%", height: "58%",
        },
        {
          id: "concierge",
          label: "Mr. Bellweather, Concierge",
          text: `The robot concierge bows low. "Welcome to Sterling Tower, ${callsign}. Miss Sterling is not receiving visitors at present. But she would be so pleased you came. She always said the bold would find their way here."`,
          top: "48%", left: "7%", width: "18%", height: "24%",
        },
      ],
    },
  ];
}
