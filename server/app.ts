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

    // Response bodies are deliberately not logged: polled GETs return whole
    // tables every few seconds, and bodies contain user-submitted content.
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

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return app;
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}
