# Work Handoff — Cosmic Conquest (2026-10-04)

Written for an agent with no memory of the earlier sessions. Read `AGENTS.md`, `CLAUDE.md`
and `GAME_PLAN.md` first; this file only adds what is not already written there.

## Objective

Continue building Cosmic Conquest, a browser detective game played mostly on phones. One
workstream is open: **put six looping background-music tracks into the live game, in the
old-time (1950s) radio style the owner wants.** Everything else from the recent sessions is
shipped and verified; do not redo it.

Done means: on the live site with sound on, each screen plays its track, the music dips
under voice lines, each loop comes round without a hard cut, and the owner approves by ear.

## Current state (verified 2026-10-04)

- **Live:** https://cosmic-conquest-ten.vercel.app, `/health` returns ok. Every push to
  `main` deploys. `npm run check`, `npm test` (28 of 28) and `npm run build` pass.
- **Shipped and verified, do not redo:** the Neptune case (art, hotspots, released); 65 voice
  lines with the 1950s broadcast treatment; hosting on Vercel with a Turso database;
  full-screen swipeable scenes on phones with animated loading; villain showdown art served
  only after a correct accusation; the music import script and cache rule.
- **Music, in progress:** the game plays no music yet (`client/public/audio/audio.json` lists
  none). The player and its six slots already exist in `client/src/lib/sound.ts`: `hub`,
  `office`, `investigate`, `showdown`, `aurelia`, `venus`, each read from
  `client/public/audio/music/<name>.m4a`. Screens: `hub` on the hub, voyages, expo and
  diner; `office` in the Bounty Office; `investigate` during a case (`venus` instead for the
  venus-fog case) and `showdown` at the showdown stage; `aurelia` on Aurelia
  (`grep -rn "useMusic(" client/src`).
- **Takes generated 2026-10-01** in the owner's Suno account (model v6, instrumental, two
  takes per track, nothing downloaded). All twelve are in his private Suno playlist
  **"Cosmic Conquest: Game Music (review)"**, in this order (last checked 2026-10-01):

  | Slot | Title | Take 1 | Take 2 |
  | --- | --- | --- | --- |
  | office | Bounty Office Blues | 3:09 (571db44d) | 3:07 (d876690b) |
  | investigate | Clues in the Fog | 2:27 (108ae610) | 2:52 (2b4fe179) |
  | showdown | High Noon on the Moon | 3:20 (107c3b69) | 3:08 (1b0e0f29) |
  | aurelia | Welcome to Aurelia | 2:25 (ed237859) | 2:32 (69e50ab7) |
  | venus | Fog Show at the Aphrodite | 2:58 (d5dcd2f8) | 3:14 (2822ff6f) |
  | hub | Tomorrow's Past | 2:39 (3187e6bb) | 2:58 (a0995c83) |

  (The code in brackets is the start of each song's id in Suno.)
- **Owner's play-through QA is outstanding (last checked 2026-10-01).** His checklist is a Google Doc in his Drive
  folder "Retro Futurism", titled "Cosmic Conquest QA Checklist — 30 Sept 2026 build". He has
  not reported results.

## Decisions made, and why

- **Download only the chosen take of each track.** The Suno plan allows 24 downloads a
  month (24 left on 2026-10-01, refreshing 2026-10-29). If the owner expresses no preference,
  use the longer take: more music before the loop repeats.
- **Music is prepared for looping by `script/audio/music.sh`:** silence trimmed at both ends,
  0.8 s fade in, 3 s fade out, loudness evened to -18 LUFS, AAC 128 kbps. A hard cut at the
  loop point was the alternative; the fade makes the restart a soft breath.
- **Scenes on phones are drawn about 1.85 times the screen width and swiped sideways**
  (`VISIBLE_SHARE = 0.54` in `client/src/components/Scene.tsx`). Mobile adventure games do
  this; zooming further makes the 1536 px art look soft.
- **Art in `/scenes` and `/game` is cached for 7 days and not fingerprinted.** Those names are
  not hashed by the build (the client refers to them by path), so replaced art needs a new
  file name.
- **Villain showdown pictures live in `art/showdown/<bounty id>.webp`** behind
  `/api/art/showdown/:bounty`. They used to be public files named after the culprit, so
  asking for each suspect's file revealed who did it.
- **Voices:** narrator is a 1950s transatlantic announcer; each world has its own regional
  accent; Aurora's voice is the reference sound and is left untreated. Cast and reasons are in
  `GAME_PLAN.md` under "Sound".

## Constraints from the owner

- He is not technical. Finish the work, verify it, and explain in plain language. Never hand
  him a multi-step technical procedure. He may not be available to approve prompts or
  dialogs on the Mac, so avoid steps that wait on one.
- Commit and push straight to `main` in his repositories. Do not open or watch pull requests.
  `CLAUDE.md` still describes reviewing and squash-merging pull requests; that predates his
  2026-09-27 direct-push authorization, so this rule wins.
- Follow the delegate-and-review rule in `AGENTS.md`: cheaper models do the work, the lab's
  top model reviews it before he sees it.
- Audio must feel like 1950s radio. Aurora's voice must not be changed. Voices vary by region.
- The game is phone-first. Pictures must fill the screen (no framed cards) and loading must
  be animated, never popping in.
- Nothing that answers a case may ship to the browser (see "Anti-cheat rule" in `CLAUDE.md`).
- Documents he asks for go to him as a file in the chat plus an editable copy in his Drive
  project folder, not as a link into an AI tool.
- On his Mac, do not leave stray Terminal icons in the Dock; background helper processes
  create them.
- Do not publish, share or make public anything in his Suno account. Do not spend money or
  upgrade plans.

## Ruled out (do not retry)

- **Hosting the game on GitHub Pages:** it needs a live server and database.
- **`better-sqlite3`, and the default `@libsql/client` entry, on Vercel:** both need a native
  binary the function bundle lacks. The server uses the web client for hosted databases.
- **A service worker, AVIF, or 960 px image variants:** poor value or unverified quality; the
  zoomed phone scenes need the full-width art.
- **Forcing or asking for landscape:** iPhones cannot lock orientation from a web page.
- **Constantly pulsing hotspot dots and full-height edge arrows:** replaced by twinkling
  glints, a "Look closer" button and small arrow tabs (the tall arrows swallowed taps).
- **Taking Suno audio from its streaming addresses** to avoid the download limit: not
  acceptable. Use the Download button.
- **Scripted (synthetic) clicks on Suno's menus while Chrome is in the background:** they stop
  working. Use real clicks, and add songs to a playlist from each song's own page (the "+"
  button titled "Add to Playlist"); the first click after a page load is often ignored.
- **Reading the Mac's Downloads folder from the terminal:** macOS privacy blocks it, and
  asking Finder to do it timed out waiting for a permission prompt.
- **An agent deleting rows in the live database:** blocked by the agent's safety checks. The
  owner has to run it or approve it.

## Open questions

1. **Owner:** which take of each of the six tracks, after listening to the playlist.
2. **Owner:** apply a lighter old-time-radio treatment (narrower range, tape warmth, faint
   crackle) to all music at import? Recommended yes. He asked whether the songs kept "the same
   old time radio sound"; they do not, only the voices are treated.
3. **Owner:** regenerate the showdown and hub tracks in a 1950s style? They are 1980s
   synthwave, from the original plan. Recommended yes.
4. **Owner:** allow the terminal app to read Downloads (System Settings → Privacy & Security
   → Files & Folders → Terminal → Downloads Folder), or the downloaded tracks cannot be
   picked up automatically.
5. **Owner:** results of his QA play-through, including whether the zoomed art looks sharp
   enough on his real phone.
6. **Owner:** the live leaderboard still shows a test hunter named "Vercel Tester". Clearing
   it means deleting the rows of `bounty_claims`, `clue_finds`, `showdowns`, `player_items`
   and `players` in the Turso console.
7. **Owner:** this repository is public, so the case answers in `server/bounties.ts` and the
   villain art can be read here. The anti-cheat protects the live site only. Keep it public or
   make it private?

## Referenced artifacts

- `AGENTS.md`, `CLAUDE.md`: working rules, checks, anti-cheat rule, database and Vercel notes.
- `GAME_PLAN.md`: roadmap, art pipeline, "Sound" (voice cast, music plan), "Hosting".
- `DESIGN.md`: "Immersive scenes and loading" (the scene components and motion).
- `README.md`: build, run and Vercel deployment.
- `script/audio/music.sh`, `script/audio/vintage.sh`, `script/audio/voices.ts`: music import,
  the voices' broadcast treatment (a starting point for the music treatment), voice list.
- `script/art/process.py`, `script/art/placeholders.py`: art processing and blur previews.
- `script/qa/`: phone and desktop QA scripts, with a README.
- Drive folder "Retro Futurism": art sources; `Music/Suno prompts - copy one at a time.txt`
  (the six style prompts and file names); the QA checklist document.
- Vercel project `cosmic-conquest`; Turso database `cosmic-conquest-db`.

## Next action

Ask the owner questions 1 to 4 in one short message. Then, for each chosen take: download
it from Suno as MP3 (song menu → Download → MP3 → Unlock & Download, one download each),
save it as `<slot>.mp3` in the Drive folder "Retro Futurism/Music", run
`script/audio/music.sh` (adding the radio treatment there if he approved it), confirm
`client/public/audio/audio.json` lists six tracks, run the three checks, push to `main`,
and confirm on the live site at phone size with sound on.

Stop rule: do not download more than one take per track without asking, and stop if Suno
shows an error or a permission prompt appears that the owner would have to answer.
