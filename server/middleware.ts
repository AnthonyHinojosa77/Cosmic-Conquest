import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

// General API rate limit — 600 requests per 15 min per IP.
// World pages poll every 5s (~180 req / 15 min per tab) and the hub every 8s,
// so this leaves headroom for a few open tabs while still capping abuse.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many requests — slow down, explorer." });
  },
});

// Strict limit for write endpoints — 20 POSTs per 15 min per IP
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many submissions — take a break and explore the worlds." });
  },
});

declare module "http" {
  interface IncomingMessage {
    visitorId?: string;
  }
}

const VISITOR_COOKIE = "rf_vid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

// Server-issued visitor identity (httpOnly cookie) used for vote deduplication,
// so clients can't pick their own ID per request.
export function visitorIdentity(req: Request, res: Response, next: NextFunction) {
  let id = readCookie(req, VISITOR_COOKIE);
  if (!id || !UUID_RE.test(id)) {
    id = randomUUID();
    res.cookie(VISITOR_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }
  req.visitorId = id;
  next();
}
