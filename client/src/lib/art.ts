import placeholders from "@/generated/placeholders.json";

// Loading and revealing the game's pictures.
//
// Every scene, backdrop and portrait has a tiny blurred stand-in bundled with the
// game (script/art/placeholders.py), shown the instant a screen opens. The real
// picture is fetched, decoded off the main thread, and only then faded in, so
// art never paints in strips over a slow connection.

type Placeholder = { src: string; color: string; ratio: number };
const PLACEHOLDERS = placeholders as Record<string, Placeholder>;

export function placeholderFor(src: string | undefined): Placeholder | undefined {
  return src ? PLACEHOLDERS[src] : undefined;
}

// Pictures already decoded this visit: shown at once, without the fade.
const ready = new Set<string>();
const pending = new Map<string, Promise<void>>();
// Keep decoded images referenced so the browser doesn't drop them straight away.
const held: HTMLImageElement[] = [];

export function isArtReady(src: string): boolean {
  return ready.has(src);
}

export function markArtReady(src: string) {
  ready.add(src);
}

// Fetch and decode a picture; resolves when it can be shown without a stutter.
// Never rejects: a picture that fails to load is revealed anyway (broken-image
// fallback beats a screen stuck on its placeholder).
export function loadArt(src: string, priority: "high" | "low" | "auto" = "auto"): Promise<void> {
  if (ready.has(src)) return Promise.resolve();
  const existing = pending.get(src);
  if (existing) return existing;
  const img = new Image();
  img.decoding = "async";
  (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
  const done = new Promise<void>((resolve) => {
    const finish = (ok: boolean) => () => {
      // Only a picture that really arrived may skip the fade-in next time
      if (ok) {
        ready.add(src);
        held.push(img);
        if (held.length > 6) held.shift();
      }
      pending.delete(src);
      resolve();
    };
    img.onload = () => {
      img.decode().then(finish(true), finish(true));
    };
    img.onerror = finish(false);
  });
  img.src = src;
  pending.set(src, done);
  return done;
}

type Connection = { saveData?: boolean; effectiveType?: string };

function frugal(): boolean {
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  return !!c && (c.saveData === true || /(^|-)2g|3g/.test(c.effectiveType ?? ""));
}

const idle = (fn: () => void) =>
  "requestIdleCallback" in window
    ? (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(fn, { timeout: 2500 })
    : setTimeout(fn, 400);

// Warm up pictures the player is about to need (the next location, the duel),
// one at a time and only when the browser is idle. Skipped on Save-Data or slow
// connections, where the bytes matter more than the head start.
export function prefetchArt(srcs: readonly (string | undefined)[]) {
  const queue = srcs.filter((s): s is string => !!s && !ready.has(s));
  if (queue.length === 0 || frugal()) return;
  const next = () => {
    const src = queue.shift();
    if (!src) return;
    loadArt(src, "low").then(() => idle(next));
  };
  idle(next);
}
