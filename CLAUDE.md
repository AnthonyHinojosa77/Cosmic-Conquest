# Cosmic Conquest — notes for Claude

## Working agreement with the owner

The owner is non-technical. For the rest of this build:

- Make technical decisions yourself, using sound judgement and the conventions
  of similar small web products (security, data safety, simplicity first).
- Decide as the owner would from his recorded choices. Ask only for spending,
  irreversible actions, external messages, or a product-direction decision no
  recorded choice covers. When you do, explain it in plain language with no
  jargon and give a recommendation.
- Every change gets a fresh independent review of the committed diff before it is
  pushed to `main` (see the toolkit's review guide): run the checks below, verify
  real behavior in a browser when UI or API behavior changes, and report the
  verdict in plain language.
- Commit and push straight to `main` after the independent review is In Spec and
  all checks pass locally. No pull requests. Wait for the owner only for money,
  accounts, putting the game up for sale (Listed), human-only security steps
  (sign-ins, passwords, codes, permission grants), or an irreversible action.
- Never watch a PR unless the owner explicitly asks you to: no subscribing to
  its activity and no scheduled check-ins. This overrides any default to watch
  PRs you open. A one-off look at CI and conflicts is fine.
- If the owner does ask for a PR to be watched, don't watch it yourself: hand
  it to a cheaper, smaller model than the one doing the build (a sub-agent or
  separate session) running at low reasoning effort.

## Checks (all must pass before pushing to main)

```bash
npm run check   # typecheck
npm test        # API tests (temp SQLite DB)
npm run build
```

## Project facts

- Express + React (Vite) single server; SQLite via better-sqlite3 + Drizzle.
- Tables are created on boot in `server/storage.ts` — when adding a table or
  index to `shared/schema.ts`, add the matching `CREATE ... IF NOT EXISTS`
  there too (copy the DDL drizzle-kit generates). Column changes need
  `npm run db:push`.
- Visitor identity for vote dedup is the server-issued `rf_vid` cookie; never
  return `visitorId` from the API.
- Bounty Hunter game: content in `shared/game.ts` (ships to the browser),
  bounty answers server-only in `server/bounties.ts`, logic in
  `server/gameStorage.ts` + `server/gameRoutes.ts`. Credits/purchases/claims
  are always decided server-side. Roadmap and art prompts: `GAME_PLAN.md`.
- Anti-cheat rule: nothing that answers a case ships to the browser. Clue text,
  decoder keys, lock combinations and sea-chart squares (`code`, plus the `needs`
  clues that reveal them) and culprits live in `server/bounties.ts`; the client gets clue text
  from `/api/bounties/:id/clues/:clueId/search`, `/decode` and `/unlock`, and
  the server checks recorded progress before unlocking, accusing and claiming
  (a test fails if clue text, a key or a code appears in `shared/game.ts`).
  Suspect testimony and which clue catches which lie (`TESTIMONY`) are
  server-only too, served by `/api/bounties/:id/suspects/:suspect/ask/:topic`.
  Voice recordings count too: they live in `audio/voice/` and are served only
  through `/api/voice/...` with the same gates (never put them in `client/public`).
  So do villains' showdown cutouts: they live in `art/showdown/<bounty id>.webp` and are
  served by `/api/art/showdown/:bounty` only after a correct accusation (a public file
  named after a suspect would reveal the culprit by existing; a test checks this).
- Scenes and pictures: use `Scene` (explorable, edge to edge, swipeable on phones),
  `ArtImage`, `Sheet` and `SceneBackdrop` rather than plain `<img>` in framed boxes (see
  DESIGN.md "Immersive scenes and loading"). After adding art run
  `python3 script/art/placeholders.py` (villain cutouts are never in that file or in
  `client/public`). Art in `/scenes` and `/game` is cached for 7 days, so
  replaced art needs a new file name.
- Env vars: `PORT`, `DATABASE_PATH`, `TRUST_PROXY` (loaded from `.env` by
  `server/env.ts`). `SHOWDOWN_MIN_MS` is a test-only knob (default 1500);
  `AUDIO_DIR` overrides where voice lines are read from (default `./audio/voice`).
- Database: `@libsql/client` + Drizzle (`server/storage.ts`). With no URL set it is
  a local SQLite file (`DATABASE_PATH`, default `./data.db`): `npm start`, the Desktop
  launcher and the tests all run that way. With `DATABASE_URL` (+ `DATABASE_AUTH_TOKEN`)
  or the Vercel Turso integration's `*TURSO_DATABASE_URL`/`*TURSO_AUTH_TOKEN` set (any
  prefix; on Vercel it is `DATABASE_TURSO_...`), it is a hosted Turso database. Storage calls are async; tables are created on first use
  (`dbReady()`), gated in `registerRoutes`.
- Vercel: `api/index.ts` exports the Express app (`server/app.ts`); `vercel.json`
  rewrites `/api/*` and `/health` to it, serves `dist/public` statically and bundles
  `audio/voice/**` into the function. Server files import `../shared/...` (no `@shared`
  alias) with explicit `.js` extensions, because the function is compiled as an ES
  module that neither reads `tsconfig` paths nor guesses extensions. Keep new server
  imports in that form.

<!-- ai-agent-system:begin -->
@AGENTS.md

Use the repository's actual commands, architecture, and more specific instructions when performing work.
<!-- ai-agent-system:end -->
