import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isArtReady, markArtReady, placeholderFor } from "@/lib/art";

// An explorable illustrated scene, shown edge to edge.
//
// On a phone held upright the 3:2 art is drawn taller than the screen is wide and
// the player swipes sideways to look around (as mobile adventure games do),
// instead of shrinking it into a small framed picture. On wider screens it fits
// the width. Hotspots are children positioned in percent of the art, so they stay
// on their objects at any size.
//
// Loading: a tiny blurred copy of the art shows at once; the real picture is
// decoded before it fades in, then the hotspots appear. A picture already seen
// this visit appears immediately.

// Share of the art's width visible at once on an upright phone. Lower zooms in
// further (more swiping, softer art: the source is 1536px wide).
const VISIBLE_SHARE = 0.54;
const PAN_HINT_KEY = "cc_pan_hint_seen";
const panned = new Set<string>();

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

type State = "loading" | "revealing" | "shown";

type SceneProps = {
  src: string;
  alt: string;
  testId?: string;
  // Horizontal point of the art (0 = left edge, 1 = right) to centre on phones
  focus?: number;
  // Screen height (px) to keep free for the header and what sits under the scene
  reserve?: number;
  // Upper limit on the scene's height (px)
  maxHeight?: number;
  // Always fit the width (no zoom or swiping), e.g. a magazine cover
  fit?: boolean;
  className?: string;
  children?: React.ReactNode;
  onReveal?: () => void;
};

// A new picture is a fresh scene (loading state, pan position and hints start over).
export function Scene(props: SceneProps) {
  return <SceneView key={props.src} {...props} />;
}

function SceneView({
  src,
  alt,
  testId,
  focus = 0.5,
  reserve = 0,
  maxHeight,
  fit: fitWidth = false,
  className = "",
  children,
  onReveal,
}: SceneProps) {
  const ph = placeholderFor(src);
  const ratio = ph?.ratio ?? 1.5;
  const viewport = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; pan: boolean } | null>(null);
  const [state, setState] = useState<State>(() => (isArtReady(src) ? "shown" : "loading"));
  const [slow, setSlow] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false, hiddenLeft: 0, hiddenRight: 0, unfound: 0 });
  const [hint, setHint] = useState(false);
  const panAnim = useRef<number>();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Has the player touched, scrolled or clicked the scene yet (ends the pan, skips the tip)
  const interacted = useRef(false);

  // Size the art for this screen (width changes and rotation, not the address bar
  // sliding in and out, which would make the scene jump while scrolling).
  const lastWidth = useRef(0);
  const measure = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const cw = el.clientWidth;
    const vh = window.innerHeight;
    const upright = cw < 768 && vh > cw;
    // A phone on its side has little height to spare: use all of it below the header
    const avail = vh < 520 ? vh - 60 : Math.max(220, vh - reserve);
    const fit = cw / ratio;
    let h = fitWidth ? fit : upright ? Math.max(fit, Math.min(avail, cw / ratio / VISIBLE_SHARE)) : Math.min(avail, fit);
    if (maxHeight) h = Math.min(h, maxHeight);
    const w = h * ratio;
    lastWidth.current = cw;
    setSize({ w: Math.round(w), h: Math.round(h), pan: w > cw + 2 });
  }, [ratio, reserve, maxHeight, fitWidth]);

  useLayoutEffect(() => {
    measure();
    const onResize = () => {
      const cw = viewport.current?.clientWidth ?? 0;
      if (Math.abs(cw - lastWidth.current) > 1) measure();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);

  // Only mention loading if it takes a moment; quick loads just fade in.
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setSlow(true), 350);
    return () => clearTimeout(t);
  }, [state, src]);

  const reveal = useCallback(() => {
    const img = art.current;
    const show = () => {
      if (img && img.naturalWidth > 0) markArtReady(src);
      setState((s) => (s === "loading" ? "revealing" : s));
      onReveal?.();
    };
    if (img && img.decode) img.decode().then(show, show);
    else show();
  }, [onReveal, src]);

  // Cached (or failed) pictures can finish before React attaches onLoad/onError
  useEffect(() => {
    if (state === "loading" && art.current?.complete) reveal();
  }, [state, reveal, src]);

  useEffect(() => {
    if (state !== "revealing") return;
    const t = setTimeout(() => setState("shown"), reducedMotion() ? 0 : 900);
    return () => clearTimeout(t);
  }, [state]);

  const updateEdges = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    // Unfound hotspots out of view on either side
    let hiddenLeft = 0;
    let hiddenRight = 0;
    const view = el.getBoundingClientRect();
    const spots = el.querySelectorAll<HTMLElement>("[data-unfound='true']");
    const unfound = spots.length;
    spots.forEach((h) => {
      const r = h.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      if (mid < view.left + 8) hiddenLeft++;
      else if (mid > view.right - 8) hiddenRight++;
    });
    setEdges((e) =>
      e.left === left && e.right === right && e.hiddenLeft === hiddenLeft && e.hiddenRight === hiddenRight && e.unfound === unfound
        ? e
        : { left, right, hiddenLeft, hiddenRight, unfound },
    );
  }, []);

  // Hotspots appear, get found, or move with the layout: recount what's off screen
  useEffect(() => {
    updateEdges();
  });

  // Centre the chosen point, then (first time this visit) a slow establishing pan
  // across it so the player sees there's more to the scene than the screen shows.
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || !size?.pan) return;
    const target = Math.max(0, Math.min(size.w - el.clientWidth, focus * size.w - el.clientWidth / 2));
    el.scrollLeft = target;
    updateEdges();
  }, [size, focus, src, updateEdges]);

  useEffect(() => {
    const el = viewport.current;
    if (!el || !size?.pan || state !== "revealing" || panned.has(src) || reducedMotion() || interacted.current) return;
    panned.add(src);
    const max = size.w - el.clientWidth;
    const end = Math.max(0, Math.min(max, focus * size.w - el.clientWidth / 2));
    const start = Math.max(0, Math.min(max, end - el.clientWidth * 0.35 * (end > max / 2 ? 1 : -1)));
    const t0 = performance.now();
    const dur = 1600;
    el.scrollLeft = start;
    const step = (t: number) => {
      if (interacted.current) return;
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      el.scrollLeft = start + (end - start) * e;
      if (k < 1) panAnim.current = requestAnimationFrame(step);
    };
    panAnim.current = requestAnimationFrame(step);
    // Deliberately no cleanup here: the pan outlives the "revealing" state and stops
    // only when the player takes over or the scene closes (below).
  }, [state, size, src, focus]);

  useEffect(() => {
    const el = viewport.current;
    const takeOver = () => {
      interacted.current = true;
      if (panAnim.current) cancelAnimationFrame(panAnim.current);
    };
    el?.addEventListener("pointerdown", takeOver);
    el?.addEventListener("touchstart", takeOver, { passive: true });
    el?.addEventListener("wheel", takeOver, { passive: true });
    return () => {
      el?.removeEventListener("pointerdown", takeOver);
      el?.removeEventListener("touchstart", takeOver);
      el?.removeEventListener("wheel", takeOver);
      if (panAnim.current) cancelAnimationFrame(panAnim.current);
    };
  }, []);

  // First pannable scene ever: say it can be swiped
  useEffect(() => {
    if (!size?.pan || state === "loading") return;
    let seen = true;
    try {
      seen = localStorage.getItem(PAN_HINT_KEY) === "1";
    } catch {
      // storage blocked: skip the hint
    }
    if (seen) return;
    const show = setTimeout(() => !interacted.current && setHint(true), 1700);
    const hide = setTimeout(() => setHint(false), 6500);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [size?.pan, state]);

  const dismissHint = useCallback(() => {
    if (!hint && !interacted.current) return;
    setHint(false);
    try {
      localStorage.setItem(PAN_HINT_KEY, "1");
    } catch {
      // ignore
    }
  }, [hint]);

  const nudge = (dir: -1 | 1) => {
    const el = viewport.current;
    if (!el) return;
    interacted.current = true;
    if (panAnim.current) cancelAnimationFrame(panAnim.current);
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  // "Look closer": briefly outline every spot still worth searching, then recharge.
  const [looking, setLooking] = useState(false);
  const [recharging, setRecharging] = useState(false);
  const lookCloser = () => {
    if (recharging) return;
    setLooking(true);
    setRecharging(true);
    later(() => setLooking(false), 2200);
    later(() => setRecharging(false), 8000);
  };

  // A tap on bare scenery answers with a small ripple, so no tap goes unacknowledged
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const box = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [...r.slice(-3), { id, x: e.clientX - box.left, y: e.clientY - box.top }]);
    later(() => setRipples((r) => r.filter((p) => p.id !== id)), 650);
  };

  const shown = state !== "loading";

  return (
    <div className={`scene-shell ${className}`} data-testid={testId} data-state={state}>
      <div
        ref={viewport}
        className={`scene-viewport ${size?.pan ? "is-pannable" : ""}`}
        style={{ height: size?.h ?? "auto" }}
        onScroll={() => {
          updateEdges();
          if (interacted.current) dismissHint();
        }}
        data-edge-left={edges.left}
        data-edge-right={edges.right}
      >
        <div
          className={`scene-canvas ${looking ? "is-looking" : ""}`}
          style={{
            width: size ? size.w : "100%",
            height: size ? size.h : undefined,
            aspectRatio: size ? undefined : String(ratio),
            background: ph?.color,
            ["--focus" as string]: `${Math.round(focus * 100)}%`,
          }}
          onClick={onCanvasClick}
        >
          {ph && state !== "shown" && <img className="scene-ph" src={ph.src} alt="" aria-hidden draggable={false} />}
          {state === "loading" && slow && <div className="scene-sheen" aria-hidden />}
          {/* Art and hotspots drift together, so hotspots stay on their objects */}
          <div className="scene-drift">
            <img
              ref={art}
              key={src}
              className="scene-art"
              src={src}
              alt={alt}
              draggable={false}
              decoding="async"
              // React 18 warns on the camelCase prop; the lowercase attribute works everywhere
              {...{ fetchpriority: "high" }}
              onLoad={reveal}
              onError={reveal}
            />
            {shown && <div className="scene-hotspots" onPointerDown={dismissHint}>{children}</div>}
          </div>
          {ripples.map((r) => (
            <span key={r.id} className="scene-ripple" style={{ left: r.x, top: r.y }} aria-hidden />
          ))}
          <div className="scene-vignette" aria-hidden />
        </div>
      </div>

      {shown && edges.unfound > 0 && (
        <button
          className={`scene-look ${recharging ? "is-recharging" : ""}`}
          // Sit on the art itself when it is narrower than the column (wide screens)
          style={size && !size.pan && viewport.current ? { left: `max(10px, calc((100% - ${size.w}px) / 2 + 10px))` } : undefined}
          onClick={lookCloser}
          disabled={recharging}
          aria-label="Look closer: show the spots worth searching"
          data-testid="button-look-closer"
        >
          🔍 <span>Look closer</span>
        </button>
      )}

      {state === "loading" && slow && (
        <div className="scene-tuning" role="status" aria-live="polite">
          <span className="scene-tuning-bars" aria-hidden><i /><i /><i /><i /></span>
          Tuning in…
        </div>
      )}

      {size?.pan && shown && (
        <>
          {/* The fade is see-through to taps, so hotspots at the screen's edge still work */}
          {edges.left && (
            <>
              <div className="scene-fade left" aria-hidden />
              <button className="scene-edge left" onClick={() => nudge(-1)} aria-label="Look left" data-testid="button-pan-left">
                ‹{edges.hiddenLeft > 0 && <span className="scene-edge-count">{edges.hiddenLeft}</span>}
              </button>
            </>
          )}
          {edges.right && (
            <>
              <div className="scene-fade right" aria-hidden />
              <button className="scene-edge right" onClick={() => nudge(1)} aria-label="Look right" data-testid="button-pan-right">
                ›{edges.hiddenRight > 0 && <span className="scene-edge-count">{edges.hiddenRight}</span>}
              </button>
            </>
          )}
        </>
      )}

      {hint && (
        <div className="scene-pan-hint" aria-hidden onClick={dismissHint}>
          <span className="scene-pan-hand">👆</span> Swipe to look around
        </div>
      )}
    </div>
  );
}
