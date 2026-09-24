import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the process environment.
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data.db",
  },
});
