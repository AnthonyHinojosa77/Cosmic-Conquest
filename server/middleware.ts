import rateLimit from "express-rate-limit";
import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

// General API rate limit — 600 requests per 15 min per IP.
// World pages and the hub re-read their feeds every 25s (~36 req / 15 min per tab),
// so this leaves headroom for many open tabs while still capping abuse.
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

// Searching and decoding clues: generous, since a bounty takes a dozen or so.
export const clueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Easy there, hunter — too many searches. Try again in a few minutes." });
  },
});

// Entering a hunter code: wrong codes only, a handful per 15 min per IP. The code's
// length is the real guard against guessing (these counters are per server instance).
export const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many tries. Wait a few minutes before entering a code again." });
  },
});

// Game actions (customizing, buying, claiming) — more generous than content writes
export const gameLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Easy there, hunter — too many actions. Try again in a few minutes." });
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
    if (key === name) return rest.join("=");
  }
  return undefined;
}

// Give this browser a visitor id. Any cookie already queued on this response for the
// same name is dropped first, so the browser is told one id, not two.
export function setVisitorCookie(req: Request, res: Response, id: string): void {
  const queued = res.getHeader("Set-Cookie");
  if (queued !== undefined) {
    const others = (Array.isArray(queued) ? queued : [String(queued)]).filter((c) => !c.startsWith(`${VISITOR_COOKIE}=`));
    if (others.length) res.setHeader("Set-Cookie", others);
    else res.removeHeader("Set-Cookie");
  }
  res.cookie(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// A request that a page on another site caused this browser to make. Browsers say so
// themselves (Sec-Fetch-Site); older ones at least name the page's origin on anything
// but a plain GET. A request that says neither is taken as the game's own.
export function fromElsewhere(req: Request): boolean {
  const site = req.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.host;
  } catch {
    return true; // "null", or not a URL at all
  }
}

// Server-issued visitor identity (httpOnly cookie): who this browser's hunter is, and
// its one vote per item. Clients can't pick their own ID per request.
// A browser's cookie is not sent along with a form another site posts here. Such a
// request is served as a passing stranger and is never given a cookie: answering it with
// a new one would replace the visitor's hunter with a blank one.
export function visitorIdentity(req: Request, res: Response, next: NextFunction) {
  let id = readCookie(req, VISITOR_COOKIE);
  if (!id || !UUID_RE.test(id)) {
    id = randomUUID();
    if (!fromElsewhere(req)) setVisitorCookie(req, res, id);
  }
  req.visitorId = id;
  next();
}

// A request the game's own page made: not one another site caused, and, where it carries
// a body, JSON (which a form on another site cannot send, and which a script on another
// site cannot send without this server's say-so). Guards the routes that change who this
// browser is.
export function fromThisSite(req: Request, sendsBody: boolean): boolean {
  return !fromElsewhere(req) && (!sendsBody || !!req.is("application/json"));
}

// The same check as a step in front of a route: refused requests go no further, so they
// are not counted against the visitor by a limiter behind it.
export function ownPageOnly(sendsBody: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (fromThisSite(req, sendsBody)) return next();
    res.status(403).json({ error: "Open the game itself to do that." });
  };
}
