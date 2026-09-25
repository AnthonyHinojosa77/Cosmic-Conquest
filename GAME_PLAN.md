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
| 2. Real art | ChatGPT-made hero poses (ready, firing, too slow), suspect portraits, Cookie showdown pose, showdown street and Bounty Office scenes | **Done** — still to make: a relaxed standing pose, and red/teal/gold suit versions (the suits are "coming soon" in the shop until then) |
| 3. The Sterling Legacy | The story hook (below), map fragments earned from bounties, a community tracker showing how close everyone is | Next |
| 4. Puzzles & RPG | Puzzles inside investigations (safes, circuits, coded telegrams, star charts), an inventory of found items used elsewhere, hunter rank, gadgets that help with puzzles, and conversations with suspects | Next |
| 5. More worlds | Tomorrowland-style planets: Mars ("Rustlers of the Red Sands"), Venus ("The Venus Fog Phantom"), each with scenes, puzzles, a fragment and a showdown | Later |
| 6. Deeper gear | Suits (once colored art exists), weapons that change showdowns, gadgets, ship paint | Later |
| 7. Co-op | Team up with friends on a bounty (shared clues, split reward) | Later, needs live multiplayer |

## Story bible: the Sterling Legacy

**The hook (the "One Piece" call to action):** the solar system's greatest
industrialist built the gleaming future: the monorails, the Moon colonies,
the World's Fair of Tomorrow. Then she vanished. Her last broadcast plays on
every radio in the system:

> *"Everything I built, I built for the bold. My fortune waits among the
> stars. Whoever finds it inherits tomorrow."*

Every bounty hunter, dreamer and crook is now searching for it.

**The tycoon.** Working name **Aurora Sterling**, founder of *Sterling Atomic*.
Other options: Celestine Vantage, Evelyn Goldcrest. She's a modern twist on
the Rockefeller / Andrew Ryan figure: visionary, glamorous and generous,
the face of the space age.

**How the story unfolds (the most important rule):**

1. **Act I: The Promise.** Players arrive while the golden age is *happening*,
   not after it (unlike BioShock or Fallout). Everything is wonder: her
   creations are marvels, her believers are sincere, and exploration is the
   reward. No cracks show at all.
2. **Act II: The Cracks.** These only appear after meaningful progress (for
   example, a set number of map fragments or a hunter rank). Small details
   are wrong: a mural with workers painted out, a sealed district, a
   broadcast that contradicts the records.
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

**How to hand them over:** Claude generates the art in the ChatGPT app on the
Mac Mini and runs it through `script/art/process.py`. If you make an image
yourself, save it as a PNG and send it to Claude in chat; don't upload
full-size PNGs into the repository.

**Site cover (the hub page):** the current cover has "RETRO UNIVERSE" painted
into the art. Upload it to ChatGPT and ask:

> Recreate this exact magazine cover in the same style, but change the title
> text "RETRO UNIVERSE" to "COSMIC CONQUEST". Keep everything else the same.

## Known limits

- **Anonymous players:** anyone who clears their browser cookies starts
  over with a new hunter. They could collect a bounty again, capped by the
  rate limit. Accounts would fix this if it ever matters.
- **Showdowns are honor-system:** the quick-draw runs in the player's
  browser, so a technical player could skip it and collect directly. The
  server still checks the right suspect was named and pays once per hunter.
- **Animation:** the showdown and scenes stay mostly still, like
  storybook panels, rather than Cuphead-style frame-by-frame animation.
