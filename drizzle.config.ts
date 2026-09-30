import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the process environment.
}

// Same choice as server/storage.ts: a hosted libSQL/Turso database when a URL is
// set, otherwise the local SQLite file.
const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;

export default defineConfig(
  url
    ? {
        out: "./migrations",
        schema: "./shared/schema.ts",
        dialect: "turso",
        dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN },
      }
    : {
        out: "./migrations",
        schema: "./shared/schema.ts",
        dialect: "sqlite",
        dbCredentials: { url: process.env.DATABASE_PATH || "./data.db" },
      },
);
