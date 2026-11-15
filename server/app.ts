import "./env.js";
import express, { type Express, type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { pingDb } from "./storage.js";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// The API and its middleware, without anything tied to a long-lived process
// (listening on a port, serving the built client, the dev server). Used by both
// `server/index.ts` (own server) and `api/index.ts` (Vercel function).
export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy / PaaS load balancer, set TRUST_PROXY (e.g. "1" for one hop)
  // so req.ip — and therefore per-IP rate limiting — uses the real client address.
  // Left unset, X-Forwarded-For is ignored, which is correct when exposed directly.
  // Vercel always fronts the function with one proxy hop.
  const trustProxy = process.env.TRUST_PROXY ?? (process.env.VERCEL ? "1" : undefined);
  if (trustProxy) {
    app.set(
      "trust proxy",
      /^\d+$/.test(trustProxy) ? Number(trustProxy)
        : trustProxy === "true" ? true
        : trustProxy === "false" ? false
        : trustProxy,
    );
  }

  app.use(
    express.json({
      limit: "50kb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    // Response bodies are deliberately not logged: the public feeds are polled by
    // every open page, and bodies contain user-submitted content.
    res.on("finish", () => {
      if (path.startsWith("/api")) {
        log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
      }
    });

    next();
  });

  // Liveness check for hosting platforms (outside /api, so no rate limits or cookies)
  app.get("/health", async (_req, res) => {
    const ok = await pingDb();
    res.status(ok ? 200 : 503).json({ ok });
  });

  registerRoutes(app);

  // An /api path no route answered: say so in JSON, not Express's HTML page.
  // (OPTIONS is left to Express, which answers it with the path's allowed methods.)
  app.use("/api", (req, res, next) => {
    if (req.method === "OPTIONS") return next();
    res.status(404).json({ error: "No such endpoint" });
  });

  app.use(sendError);

  return app;
}

// A request that failed outside a route's own checks (a broken body, something thrown)
// answers in the shape the game reads: { error }. What went wrong inside the server (a
// database message, a stack) is logged, never sent.
export function sendError(err: any, _req: Request, res: Response, next: NextFunction) {
  const status = Number(err?.status || err?.statusCode) || 500;

  console.error(status >= 500 ? "Internal Server Error:" : `Request refused (${status}):`, err);

  if (res.headersSent) {
    return next(err);
  }

  const error = status >= 500
    ? "Something went wrong on our side. Try again in a moment."
    : status === 413 ? "That's too much to send at once."
    : "The game couldn't read that request.";
  return res.status(status).json({ error });
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
