# Cosmic Conquest — notes for Claude

## Working agreement with the owner

The owner is non-technical. For the rest of this build:

- Make technical decisions yourself, using sound judgement and the conventions
  of similar small web products (security, data safety, simplicity first).
- Only bring a decision to the owner when it's genuinely theirs: product
  direction, anything user-visible they'd care about, spending money, or an
  action that is hard to undo. When you do, explain it in plain language with
  no jargon, give a recommendation, and ask short clarifying questions about
  their intent.
- Review every PR yourself before calling it ready: run the checks below,
  review the diff for bugs, fix what you find, and verify real behavior in
  a browser when UI or API behavior changes. Report the verdict in plain
  language.
- Merging is pre-approved: once your review is done, all checks pass (locally
  and in CI) and there are no conflicts, squash-merge the PR yourself. Still
  ask first for anything risky, irreversible, or product-related.

## Checks (all must pass before a PR is ready)

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
  decoder keys, lock combinations (`code`, plus the `needs` clues that reveal
  them) and culprits live in `server/bounties.ts`; the client gets clue text
  from `/api/bounties/:id/clues/:clueId/search`, `/decode` and `/unlock`, and
  the server checks recorded progress before unlocking, accusing and claiming
  (a test fails if clue text, a key or a code appears in `shared/game.ts`).
  Voice recordings count too: they live in `audio/voice/` and are served only
  through `/api/voice/...` with the same gates (never put them in `client/public`).
- Env vars: `PORT`, `DATABASE_PATH`, `TRUST_PROXY` (loaded from `.env` by
  `server/env.ts`). `SHOWDOWN_MIN_MS` is a test-only knob (default 1500);
  `AUDIO_DIR` overrides where voice lines are read from (default `./audio/voice`).
