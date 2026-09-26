import "./env";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pingDb, closeDb } from "./storage";

const app = express();

// Behind a reverse proxy / PaaS load balancer, set TRUST_PROXY (e.g. "1" for one hop)
// so req.ip — and therefore per-IP rate limiting — uses the real client address.
// Left unset, X-Forwarded-For is ignored, which is correct when exposed directly.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set(
    "trust proxy",
    /^\d+$/.test(trustProxy) ? Number(trustProxy)
      : trustProxy === "true" ? true
      : trustProxy === "false" ? false
      : trustProxy,
  );
}
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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
app.get("/health", (_req, res) => {
  const ok = pingDb();
  res.status(ok ? 200 : 503).json({ ok });
});

// Stop cleanly on SIGINT/SIGTERM: finish open requests, then save the database
// properly. Registered before startup so a signal mid-startup is handled too.
// A second signal exits at once; the grace is shorter than the ~10s most platforms
// allow before force-killing, so the database is always closed first.
const GRACE_MS = 5_000;
let stopping = false;
function finish(code: number) {
  closeDb();
  process.exit(code);
}
function stop(signal: string) {
  if (stopping) {
    log(`received ${signal} again, exiting now`);
    finish(1);
  }
  stopping = true;
  log(`received ${signal}, stopping`);
  httpServer.close((err) => {
    if (err) console.error("Server wasn't running cleanly:", err.message);
    finish(err ? 1 : 0);
  });
  // Idle keep-alive (and dev live-reload) connections would hold close() open.
  httpServer.closeIdleConnections();
  setTimeout(() => {
    console.error(`Requests didn't finish within ${GRACE_MS / 1000}s; closing anyway`);
    finish(1);
  }, GRACE_MS).unref();
}
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

})();
