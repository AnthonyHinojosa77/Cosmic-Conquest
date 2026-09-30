import { createApp, log } from "./app.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";
import { closeDb } from "./storage.js";

const app = createApp();
const httpServer = createServer(app);

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
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
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
