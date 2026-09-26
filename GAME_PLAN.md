# Cosmic Conquest — Game Plan

## The pitch

**Cosmic Conquest** is a journey through the future that never came: the
gleaming 1950s space age that dreamers and believers really thought was
around the corner.

You're a helmeted space cowboy: a bounty hunter drifting across a 1950s-pulp
solar system. You take jobs from the Bounty Office, travel to hand-drawn
planets, find clues, name the culprit and settle it with a quick-draw
showdown. Bounties pay credits; credits buy suits, gear and weapon upgrades.

- **Feel:** mostly exploring and solving (point-and-click), with short,
  simple action moments at the end of each job.
- **Look:** the site's existing style: aged pulp-magazine illustration,
  bold ink outlines, red / teal / gold / cream. The **world** leans 1950s
  Tomorrowland: chrome cities, Googie architecture, monorails, World's Fair
  optimism. The **hero** is the frontier drifter walking through it. Keep the
  cowboy flavor on the hero, not on the worlds.
- **Hero:** one main character whose face is always hidden behind a mirrored
  helmet visor. Players make them their own with suits, bandanas, hats and
  weapons.
- **Social:** a public leaderboard now; co-op bounties with friends later.

## The core loop

1. **Bounty Office:** pick a job from the Wanted board.
2. **Investigate:** search illustrated scenes for clues (they go in your
   Hunter's Notebook).
3. **Accuse:** name the suspect. A wrong guess costs nothing but pride.
4. **Showdown:** a quick-draw duel. Wait for DRAW!, then click. Better
   blasters give you more time.
5. **Get paid:** each bounty pays once per hunter. Spend it at the
   Outfitters, then climb the Top Hunters board.

## Build phases

| Phase | What ships | Status |
| ----- | ---------- | ------ |
| 1. First playable bounty | Bounty Office, "The Heart of Luna Heist", quick-draw showdown, credits, shop (suits, bandana, ray-gun), leaderboard, placeholder hero art | **Done** |
| 2. Real art | ChatGPT-made hero poses (ready, firing, too slow), suspect portraits, Cookie showdown pose, showdown street and Bounty Office scenes | **Done** — plus a relaxed standing pose (Bounty Office) and every pose in red, teal and gold (2026-09-25) |
| 3. The Sterling Legacy | The story hook (below), map fragments earned from bounties, a community tracker showing how close everyone is | **Built** — Aurora's broadcast (first Bounty Office visit, replay on the desk radio), a 12-piece star map with fragment I from the Heart of Luna, and the community count |
| 4. Puzzles & RPG | Puzzles inside investigations (safes, circuits, coded telegrams, star charts), an inventory of found items used elsewhere, hunter rank, gadgets that help with puzzles, and conversations with suspects | **Started** — puzzles: coded telegram + decoder dial (Mars), combination lock from torn-note scraps (Venus); a satchel of items kept between bounties, and hunter rank (Greenhorn → Legend of the Spaceways) |
| 5. More worlds | Tomorrowland-style planets: Mars ("Rustlers of the Red Sands"), Venus ("The Venus Fog Phantom"), each with scenes, puzzles, a fragment and a showdown | **Mars and Venus built** (800 CR / fragment II, 1,200 CR / fragment III); next worlds to be planned |
| 6. Deeper gear | Suits (**live**: red/teal/gold, worn in the office and in showdowns), weapons that change showdowns, gadgets, ship paint | Later |
| 7. Co-op | Team up with friends on a bounty (shared clues, split reward) | Later, needs live multiplayer |

## Story bible: the Sterling Legacy

**The hook (the "One Piece" call to action):** the solar system's greatest
industrialist built the gleaming future: the monorails, the Moon colonies,
the World's Fair of Tomorrow. Then she vanished. Her last broadcast plays on
every radio in the system:

> *"Everything I built, I built for the bold. My fortune waits among the
> stars. Whoever finds it inherits tomorrow."*

Every bounty hunter, dreamer and crook is now searching for it.

**The tycoon.** **Aurora Sterling** (final name, chosen by the owner
2026-09-25), founder of *Sterling Atomic*. She's a modern twist on
the Rockefeller / Andrew Ryan figure: visionary, glamorous and generous,
the face of the space age.

**How the story unfolds (the most important rule):**

1. **Act I: The Promise.** Players arrive while the golden age is *happening*,
   not after it (unlike BioShock or Fallout). Everything is wonder: her
   creations are marvels, her believers are sincere, and exploration is the
   reward. No cracks show at all.
2. **Act II: The Cracks.** These only appear after *significant* progress:
   substantial exploration of a large, expansive world, not a handful of
   bounties. Only then do the pieces come together and reveal the truth
   about Aurora and the world she built along with her fortune. The exact
   threshold (fragments, rank, worlds explored) gets set once there are
   enough worlds to make it substantial (phase 5); until then the game
   stays in Act I. When the cracks do come, small details are wrong: a
   mural with workers painted out, a sealed district, a broadcast that
   contradicts the records.
3. **Act III: The Truth.** The cost of her utopia. How it ends is still open.

The reveals are unlocked by the player's progress, never by time, so a new
player always meets the future at its most dazzling.

**Map fragments.** Each bounty turns up a piece of Sterling's star map.
Collecting them drives the story forward, and a shared tracker shows how
close the whole community is.

**Tone references:** Disneyland's 1955 Tomorrowland, the 1939 and 1964
World's Fairs, Googie architecture, Chesley Bonestell and Syd Mead
paintings, *The Jetsons*. The darker layer (*Atlas Shrugged*, BioShock)
arrives only in Act II and III.

## Art pipeline

- **Tool:** ChatGPT's image generator. It matched the site's style best, and it
  keeps the hero consistent across poses when you stay in the same chat.
- **Characters** are drawn on a plain cream background. They're cut out
  automatically and saved as small `.webp` files in `client/public/game/`.
- **Scenes** are wide 3:2 images and are just resized.
- **Processing:** `script/art/process.py` does the cutout and resizing
  (`character`, `scene` or `portrait` mode; needs Python 3 with pillow, numpy
  and scipy). New art goes into `client/public/` as the finished `.webp`
  only; don't commit the full-size source PNGs.

## Sound (owner's call, 2026-09-26)

- **Music (Suno Pro):** noir jazz for the Bounty Office and investigations, big
  band for Aurelia and the Venus resort, synthwave for showdowns and the hub.
  Prompts are in the Drive folder "Retro Futurism/Music"; each `<name>.mp3`
  saved there is imported with `script/audio/music.sh` (AAC 96 kbps,
  loudness-evened) into `client/public/audio/music/`.
- **Voices (ElevenLabs Starter):** a noir narrator reads briefings, clues,
  outros and Aurelia; culprits voice their taunts; Aurora voices her broadcast.
  `npx tsx script/audio/voices.ts` makes missing lines (key from the macOS
  Keychain item `elevenlabs-api-key`); cast is set at the top of that script.
  Files live in `audio/voice/` (outside the public folder) and `/api/voice/...`
  serves each one only when the hunter may read the same text.
- Sound is off until the player turns it on (corner button, hidden until any
  audio exists). Music ducks while someone speaks.
- The game plays well on phones (owner, 2026-09-26): check new screens at
  phone width.

## Art prompts (for ChatGPT, Grok or similar)

Paste the **style block** first, then one of the item prompts. Keep the
same style block every time so everything matches.

**Style block:**

> 1950s pulp science-fiction magazine illustration, vintage comic art,
> bold black ink outlines, halftone dot shading, heavily aged and weathered
> paper texture with worn edges, saturated retro palette of tomato red,
> teal, mustard gold and cream, painterly lighting, whimsical atomic-age
> optimism. No modern elements. No text or lettering unless asked.

**1. Hero (most important — make this first):**

> Full-body character, standing, facing the viewer, on a plain cream
> background. A space cowboy bounty hunter: a round glass bubble space
> helmet with a dark mirrored visor that completely hides the face, a
> brown cowboy hat worn on top of the helmet with a red hatband, a
> silver one-piece space suit with a chest control panel, a brown leather
> gunbelt with a gold star buckle, a holster on the right hip, brown
> gloves and boots. Confident, relaxed stance. Square image.

Then make the same character in a **red**, a **teal** and a **gold** suit
("same character, same pose, but the suit is [color]"), plus one version
wearing a **red bandana with a gold star**.

**2. Suspect portraits** (square, "wanted poster" framing, one each):

> - Dr. Otto Gearhart, a cranky elderly robot inventor with wild white hair,
>   goggles and a lab coat.
> - Madame Vela Quasar, a glamorous 1950s videophone saleswoman holding a
>   telephone receiver.
> - "Cookie" Carmichael, a sly diner fry cook in a paper cap and apron,
>   holding a spatula-shaped ray gun.

**3. Showdown scene** (wide, 3:2):

> A dusty main street on a Moon-colony frontier town at high noon, glass
> domes and rockets in the background, two long shadows facing each other.
> No people in the scene.

**4. Bounty Office** (wide, 3:2):

> Interior of a frontier sheriff's office on a space station, wanted posters
> pinned to a cork board, a big porthole window showing Saturn, a desk with
> a vintage radio and a brass star badge.

**How to hand them over:** Claude drives the ChatGPT desktop app on the Mac
Mini (paste the reference image and prompt, then "Copy image" on the result),
saves the full-size PNG to the owner's Google Drive folder "Retro Futurism",
and runs it through `script/art/process.py` into `client/public/`. The ChatGPT
app exposes no accessibility controls, so this works from screenshots and
clicks by position; the Terminal running Claude Code needs Accessibility and
Screen Recording permission. Don't commit full-size PNGs to the repository.

**Site cover (the hub page):** done 2026-09-25 (title now "COSMIC CONQUEST";
original in the Drive folder as "hub cover cosmic conquest.png"). Prompt used,
with the old cover attached:

> Recreate this exact magazine cover in the same style, but change the title
> text "RETRO UNIVERSE" to "COSMIC CONQUEST". Keep everything else the same:
> the same tall portrait size, the same three illustrated bands in the same
> positions, the same banners, colors, aged paper texture and worn edges.

Keeping the bands in place matters: the hub's clickable areas sit on them.

## Mars: Rustlers of the Red Sands

Chrome Rain-Makers vanish from Sterling Atomic's Ares Valley Hydro-Dome.
Locations: the Hydro-Dome (empty pad, Sprinkles the farm robot, who gives
the **decoder ring**, Professor Venn's lab) and the Red Sands freight depot
(Dusty's sand-skiff, the Canned Sunshine crates, the **coded telegram**).
The telegram is a letter-shift code; the ring's engraving says the key is
"the number of moons of your world" (Mars: 2). Red herrings: Dusty Dunmore
(racing all night) and Professor Lyra Venn (lab log). The clues point to the
freight clerk by design. All clue text and the decoder key stay on the
server; the browser only has the coded telegram. Art was made in a separate
ChatGPT chat with an existing world scene attached as the style reference;
sources are in the Drive folder.

## Aurelia: the private planet (owner's idea, 2026-09-26)

A planet only the solar system's richest can visit, built by Aurora Sterling:
1930s Art Deco pushed into the future (stepped towers, sunburst crowns,
searchlights, black tie), rendered on the game's usual inked aged paper in an
indigo / violet / silver / gold palette. Owner's reference images: airbrushed
Art Deco night cities.

- **No bounty hunting inside.** The Bounty Guild is headquartered here (all
  contracts start here), but Aurora's charter bans serving contracts within
  the walls, so the rich live protected from the rough world outside.
- **Invitation only.** Hunters see it from the start (Bounty Office card, the
  gates art) and are invited after recovering 3 star-map pieces. The server
  gates `/api/aurelia`, and the city's text only comes from the server.
- **Places:** the Grand Staircase plaza, Bounty Guild HQ (contracts board,
  registrar, trophy case of the hunter's own cases, charter), Sterling Tower
  lobby (her portrait, fresh lilies, the sealed penthouse elevator, robot
  concierge).
- **Story:** Aurora is still "vanished" to players (owner's call). Aurelia is
  pure wonder with small hints (the rope up since her last broadcast, lilies
  still ordered). The owner's longer arc: she actually died, the cause is a
  mystery nobody looks into because everyone is chasing the treasure, and
  Aurelia is the hub that makes everything around it run. That reveal belongs
  to Act II or later.

## Venus: The Venus Fog Phantom

During the Aphrodite Sky Resort's fog show, a masked thief takes the Star of
Venus. Locations: the Grand Lounge (empty jewel case, bandstand, reception key
board) and the Orchid Conservatory (fog machine, orchid bed, locked staff
locker). Puzzle: three torn scraps of a note (left edge, middle, right edge),
each with one digit, give the locker's combination in edge order; the server
only opens the lock once all three scraps are found. Red herrings: Maestro
Lune (live radio broadcast) and Dr. Fenwick (banquet, forty witnesses).
Culprit and combination are server-only. Art: separate ChatGPT chat, same
style reference; sources in the Drive folder.

## Economy

- **Prices outrun a single bounty on purpose** (owner decision, 2026-09-25):
  the first bounty pays 500 credits once, so a hunter can't buy everything
  from it (ray-gun 300 + gold suit 250 = 550). The better gear is a reason to
  keep exploring and take on new bounties as they arrive. Purchases are final.

## Known limits

- **Anonymous players:** anyone who clears their browser cookies starts
  over with a new hunter. They could collect a bounty again, capped by the
  rate limit. Accounts would fix this if it ever matters.
- **The server is the referee:** clue text, puzzle answers and culprits live
  only on the server. It records each clue a hunter finds, checks decoder keys,
  hands out items only when the right spot is searched, refuses accusations
  until enough clues are on record, and pays out only after a correct
  accusation and a showdown that took at least as long as the shortest DRAW!.
- **Reaction time can't be proven:** the quick-draw itself still runs in the
  player's browser, so an auto-clicker could win it. No web or downloaded game
  can fully stop that; the server makes sure the duel actually happened.
- **Animation:** the showdown and scenes stay mostly still, like
  storybook panels, rather than Cuphead-style frame-by-frame animation.
