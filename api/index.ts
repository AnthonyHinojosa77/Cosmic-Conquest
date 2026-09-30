// Vercel entry point: the whole API runs as one function. vercel.json rewrites
// /api/* and /health here; the built client is served from dist/public by the CDN.
import { createApp } from "../server/app";

export default createApp();
