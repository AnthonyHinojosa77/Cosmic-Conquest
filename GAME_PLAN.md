# Retro Universe: Bounty Hunter — Game Plan

## The pitch

You're a helmeted space cowboy: a bounty hunter drifting across a 1950s-pulp
solar system. You take jobs from the Bounty Office, travel to hand-drawn
planets, find clues, name the culprit and settle it with a quick-draw
showdown. Bounties pay credits; credits buy suits, gear and weapon upgrades.

- **Feel:** mostly exploring and solving (point-and-click), with short,
  simple action moments at the end of each job.
- **Look:** the site's existing style: aged pulp-magazine illustration,
  bold ink outlines, red / teal / gold / cream.
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
| 2. Real art | Swap the placeholder hero, suspects and showdown for AI-made illustrations (prompts below) | Waiting on art |
| 3. More planets | Mars ("Rustlers of the Red Sands") and Venus ("The Venus Fog Phantom"), each with its own scenes, clues and a new showdown twist | Next |
| 4. Deeper gear | Weapons that change showdowns (e.g. two shots, slow-mo), hats, helmet visors, ship paint | Later |
| 5. Co-op | Team up with friends on a bounty (shared clues, split reward). Possible later twist: one player is secretly in league with the outlaw | Later, needs live multiplayer |

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

**How to hand them over:** save each image as a PNG and send them to Claude
in chat, or upload them to the repository's `client/public/scenes/` folder
on GitHub.

## Known limits

- **Anonymous players:** anyone who clears their browser cookies starts
  over with a new hunter. They could collect a bounty again, capped by the
  rate limit. Accounts would fix this if it ever matters.
- **Showdowns are honor-system:** the quick-draw runs in the player's
  browser, so a technical player could skip it and collect directly. The
  server still checks the right suspect was named and pays once per hunter.
- **Animation:** the showdown and scenes stay mostly still, like
  storybook panels, rather than Cuphead-style frame-by-frame animation.
