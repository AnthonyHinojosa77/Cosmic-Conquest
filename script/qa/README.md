# Phone and desktop QA scripts

These drive the Chrome already installed on a Mac (through `puppeteer-core`, which is
not a project dependency) against a local copy of the game, so UI changes can be
checked at phone size without touching the live database.

```bash
npm run build
PORT=5090 DATABASE_PATH=/tmp/cc-qa.db SHOWDOWN_MIN_MS=0 NODE_ENV=production node dist/index.cjs &
cd script/qa
npm install --no-save puppeteer-core
QA_DB=/tmp/cc-qa.db OUT=shots/run node screens.mjs all   # screenshots, loading filmstrip, other pages
node touch.mjs                                           # swipe, tap, drag-to-close, Look closer, arrows
node pan-landscape.mjs                                   # opening pan ends on centre; phone held sideways
```

- `screens.mjs [shots|film|pages|all]` saves PNGs and a `report.json` with each scene's size,
  its share of the screen, the page's scroll width (must equal the viewport: no sideways
  overflow) and any page errors. `film` throttles the network to 1.6 Mbps with the cache off
  and captures the scene loading frame by frame. `pages` needs `QA_DB` (it writes three
  bounty claims into the local database with `sqlite3` so Aurelia opens).
- Set `BASE=https://…` to point `screens.mjs shots` or `film` at the live site. Do not run
  `pages` or anything that claims bounties against production: the live database feeds the
  public leaderboard.
- Output folders (`shots/`, `chrome-profile*`) are ignored by git.
