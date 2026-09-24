# RetroFuturism

A point-and-click retro-futurist social game. Explore illustrated scenes (a space-tourism
voyage, a World's Fair expo, a roadside diner), click hotspots to make discoveries, and
leave postcards, predictions, menu items, and a visitor tally that other players see.

## Stack

- **Client:** React 18, Vite 7, Tailwind CSS v3, Wouter (routing), TanStack Query, Radix UI primitives
- **Server:** Express 5 (serves both the API and the built client on a single port)
- **Data:** SQLite via `better-sqlite3` + Drizzle ORM (`drizzle-kit` for migrations)
- **Language:** TypeScript end to end (shared schema in `shared/`)

> The animations are CSS-driven (keyframes in `client/src/index.css`). See [`DESIGN.md`](./DESIGN.md)
> for the color palette, spacing, and animation specs.

## Local development

```bash
npm install
npm run dev       # starts Express + Vite dev middleware on http://localhost:5000
```

Useful scripts:

| Script            | What it does                                              |
| ----------------- | -------------------------------------------------------- |
| `npm run dev`     | Dev server (Express API + Vite middleware), `NODE_ENV=development` |
| `npm run build`   | Builds the client (Vite) and bundles the server to `dist/index.cjs` |
| `npm start`       | Runs the production build (`NODE_ENV=production node dist/index.cjs`) |
| `npm run check`   | TypeScript typecheck (`tsc`)                              |
| `npm test`        | API tests (Node test runner, temporary SQLite database)   |
| `npm run db:push` | Push the Drizzle schema to the SQLite database           |

## Environment variables

Copy [`.env.example`](./.env.example) to `.env`. This app deliberately has only a few:

| Variable   | Default         | Purpose                                                      |
| ---------- | --------------- | ----------------------------------------------------------- |
| `NODE_ENV` | `development`   | `production` serves the prebuilt static client; otherwise Vite dev middleware is used |
| `PORT`     | `5000`          | Port the Express server (API + client) binds on `0.0.0.0`   |
| `DATABASE_PATH` | `./data.db` | SQLite file location (put it on a persistent volume in production) |
| `TRUST_PROXY` | unset       | Proxy hops to trust for client IPs (e.g. `1` behind Fly.io/Railway/Render/nginx); needed for per-IP rate limiting behind a proxy |

The SQLite database path defaults to `./data.db` and can be overridden with
`DATABASE_PATH` (read by both `server/storage.ts` and `drizzle.config.ts`). The server
creates any missing tables on startup, so `npm run db:push` is optional.
There is no auth/session/OAuth layer, so no secrets are required. The server sets an
anonymous `rf_vid` cookie to identify visitors for one-vote-per-item deduplication.

## Deployment

This is a **stateful Express server with a local SQLite file** (`better-sqlite3` runs
in-process) plus WAL sidecar files. It is **not serverless-friendly** — it needs a
long-lived process and a persistent writable disk. Deploy it to a container/VM target
such as Docker, Fly.io, Railway, Render, or a plain VPS.

### Build & run

```bash
npm ci
npm run build      # -> dist/public (client) and dist/index.cjs (server)
NODE_ENV=production PORT=5000 npm start
```

The server binds `0.0.0.0` on `$PORT` (default `5000`) and serves both the API and the
built client from that single port.

### SQLite file location & persistence

The database is created as **`data.db` in the process working directory**, alongside
`data.db-shm` and `data.db-wal` (WAL mode is enabled in `server/storage.ts`). These three
files **are gitignored** and **must live on a persistent volume** — if the container
filesystem is ephemeral (the default on most PaaS platforms), all game data is lost on
every restart/redeploy.

- **Fly.io / Railway / Render:** attach a persistent volume and mount it where the app
  runs (e.g. `/data`), then start the process with that directory as the working dir so
  `./data.db` resolves onto the volume (or set `DATABASE_PATH=/data/data.db`). Tables
  are created automatically on first boot.
- **VPS:** run under a process manager (systemd, pm2) from a fixed working directory; back
  up `data.db*`.

### Dockerfile sketch

```dockerfile
FROM node:20-slim
# better-sqlite3 is a native module; build deps are needed at install time
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000
# Mount a persistent volume and point DATABASE_PATH at it so data.db survives
# restarts; tables are created on first boot.
CMD ["npm", "start"]
```

> Schema changes: the server creates missing tables on boot (`server/storage.ts`), but it
> does not alter existing ones. When you add a table, add it there too; when you change a
> column, run `npm run db:push` against the database.
