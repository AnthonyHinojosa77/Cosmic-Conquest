# Cosmic Conquest — notes for Claude

Universal working, review, and delivery rules are in the managed agreement below.

If the owner explicitly asks for PR watching, hand it to a cheaper, smaller agent at low reasoning effort; the builder does not watch it.

Verify real behavior in a browser when UI or API behavior changes.

## Checks (all must pass before pushing to main)

```bash
npm run check   # typecheck
npm test        # API tests (temp SQLite DB)
npm run build
```

## Project facts

- Express + React (Vite) single server; Drizzle with @libsql/client, using a local SQLite file or hosted Turso/libSQL. The Database and Vercel notes below define the current modes.
- Tables are created by `dbReady()` before routes use them in `server/storage.ts` — when adding a table or
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
