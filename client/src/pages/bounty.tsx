import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { HeroArt, preloadHeroPoses, type HeroPose } from "@/components/HeroArt";
import { usePlayer, accuse, claimBounty, errorMessage, type ClaimOutcome } from "@/lib/game";
import {
  bountyById,
  DRAW_WINDOW_MS,
  DRAW_WINDOW_RAYGUN_MS,
  type Bounty,
  type CaseSolution,
  type Clue,
  STAR_MAP_SIZE,
} from "@shared/game";
import NotFound from "@/pages/not-found";
import { numeral } from "@/components/StarMap";

const INK = "hsl(25,40%,15%)";
type Stage = "briefing" | "investigate" | "accuse" | "showdown" | "done";

function OfficeLink() {
  return (
    <Link href="/bounties">
      <button
        className="inline-flex items-center gap-2 text-sm text-[hsl(38,25%,65%)] hover:text-[hsl(45,80%,55%)] transition-colors pulp-title tracking-wider"
        data-testid="button-back-office"
      >
        <span className="text-lg">←</span>
        <span>Bounty Office</span>
      </button>
    </Link>
  );
}

function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="discovery-panel animate-slide-up" style={{ position: "relative", maxWidth: 640, margin: "0 auto" }} data-testid={testId}>
      <div className="discovery-panel-header"><span>{title}</span></div>
      <div className="discovery-panel-body text-[hsl(25,40%,20%)]">{children}</div>
    </div>
  );
}

// --- Investigation ---------------------------------------------------------

function Investigation({
  bounty,
  found,
  onFind,
  onReady,
}: {
  bounty: Bounty;
  found: Set<string>;
  onFind: (clue: Clue) => void;
  onReady: () => void;
}) {
  const locations = bounty.locations ?? [];
  const [locationId, setLocationId] = useState(locations[0]?.id);
  const [openClue, setOpenClue] = useState<Clue | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const location = locations.find((l) => l.id === locationId) ?? locations[0];
  const allClues = locations.flatMap((l) => l.clues);
  const needed = bounty.cluesNeeded ?? allClues.length;
  const ready = found.size >= needed;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center flex-wrap">
        {locations.map((l) => (
          <button
            key={l.id}
            className={`retro-btn text-sm ${l.id === location.id ? "gold" : "teal"}`}
            aria-pressed={l.id === location.id}
            onClick={() => {
              setLocationId(l.id);
              setOpenClue(null);
              setImgLoaded(false);
            }}
            data-testid={`button-location-${l.id}`}
          >
            {l.name} ({l.clues.filter((c) => found.has(c.id)).length}/{l.clues.length})
          </button>
        ))}
      </div>

      <div className="scene-container relative" data-testid={`scene-${location.id}`}>
        <img
          key={location.image}
          src={location.image}
          alt={`${location.name} — search for clues`}
          className="w-full h-auto block"
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />
        {imgLoaded && location.clues.map((clue) => (
          <button
            key={clue.id}
            className={`hotspot ${found.has(clue.id) ? "border-[hsl(120,50%,45%)]/60" : ""}`}
            style={{ top: clue.top, left: clue.left, width: clue.width, height: clue.height }}
            onClick={() => {
              onFind(clue);
              setOpenClue(clue);
            }}
            aria-label={`Search ${clue.label}`}
            title={clue.label}
            data-testid={`hotspot-clue-${clue.id}`}
          >
            {!found.has(clue.id) && (
              <div className="hotspot-indicator" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            )}
          </button>
        ))}
      </div>

      {openClue && (
        <Panel title={`🔍 ${openClue.label}`} testId="panel-clue">
          <p className="text-sm leading-relaxed">{openClue.text}</p>
        </Panel>
      )}

      <section className="comic-panel bg-[hsl(38,35%,88%)] p-4 max-w-2xl mx-auto" data-testid="panel-notebook">
        <div className="flex justify-between items-baseline">
          <h2 className="pulp-title text-lg" style={{ color: INK }}>Hunter's Notebook</h2>
          <span className="pulp-title text-sm" style={{ color: ready ? "hsl(120,50%,32%)" : INK }}>
            {found.size}/{allClues.length} clues
          </span>
        </div>
        {found.size === 0 ? (
          <p className="text-sm text-[hsl(25,15%,42%)] marker-text mt-2">Click the glowing spots in each location to search.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-[hsl(25,30%,22%)] list-disc pl-5">
            {allClues.filter((c) => found.has(c.id)).map((c) => (
              <li key={c.id}><strong>{c.label}:</strong> {c.text}</li>
            ))}
          </ul>
        )}
        <button
          className="retro-btn mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!ready}
          onClick={onReady}
          data-testid="button-ready-accuse"
        >
          {ready ? "★ Name your suspect" : `Find ${needed - found.size} more clue${needed - found.size === 1 ? "" : "s"}`}
        </button>
      </section>
    </div>
  );
}

// --- Accusation ------------------------------------------------------------

function Accusation({
  bounty,
  onCorrect,
}: {
  bounty: Bounty;
  onCorrect: (suspectId: string, solution: CaseSolution) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const choose = async (suspectId: string, name: string) => {
    setPending(suspectId);
    setMessage(null);
    try {
      const solution = await accuse(bounty.id, suspectId);
      if (solution) onCorrect(suspectId, solution);
      else setMessage(`${name} has an airtight alibi. The sheriff laughs you out of the room — check your notebook.`);
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h2 className="pulp-title text-2xl text-center text-[hsl(45,80%,55%)] tracking-wider">{bounty.accusePrompt ?? "Who did it?"}</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {(bounty.suspects ?? []).map((s) => (
          <button
            key={s.id}
            className="comic-panel bg-[hsl(38,35%,88%)] p-4 text-left flex flex-col justify-start hover:-translate-y-1 transition-transform disabled:opacity-60"
            disabled={pending !== null}
            onClick={() => choose(s.id, s.name)}
            data-testid={`button-suspect-${s.id}`}
          >
            <p className="pulp-title text-center text-[hsl(0,72%,42%)] tracking-widest text-sm">WANTED?</p>
            <img
              src={s.portrait}
              alt={`Portrait of ${s.name}`}
              className="w-full aspect-square object-cover my-2 border-2 border-[hsl(25,40%,18%)] rounded"
              draggable={false}
            />
            <h3 className="pulp-title text-lg text-center" style={{ color: INK }}>{s.name}</h3>
            <p className="text-xs text-center uppercase tracking-wider text-[hsl(25,15%,42%)]">{s.title}</p>
            <p className="text-xs text-[hsl(25,30%,25%)] mt-2">{s.description}</p>
          </button>
        ))}
      </div>
      {message && (
        <p className="text-center text-sm text-[hsl(38,40%,80%)] marker-text animate-fade-in" role="status" data-testid="text-accuse-result">
          {message}
        </p>
      )}
    </div>
  );
}

// --- Quick-draw showdown ---------------------------------------------------

// Inline so it beats `.scene-container img { width: 100% }` from index.css
const SPRITE: React.CSSProperties = { height: "78%", width: "auto" };

type DrawState = "idle" | "waiting" | "draw" | "early" | "slow" | "won";

function Showdown({
  showdown,
  windowMs,
  onWin,
}: {
  showdown: CaseSolution["showdown"];
  windowMs: number;
  onWin: () => void;
}) {
  const [state, setState] = useState<DrawState>("idle");
  const [reaction, setReaction] = useState<number | null>(null);
  const drawAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    preloadHeroPoses();
    new Image().src = showdown.image;
  }, [showdown.image]);

  const start = useCallback(() => {
    setState("waiting");
    setReaction(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      drawAt.current = performance.now();
      setState("draw");
    }, 1500 + Math.random() * 2500);
  }, []);

  const fire = useCallback(() => {
    if (state === "waiting") {
      clearTimeout(timer.current);
      setState("early");
    } else if (state === "draw") {
      const ms = Math.round(performance.now() - drawAt.current);
      setReaction(ms);
      if (ms <= windowMs) {
        setState("won");
        onWin();
      } else {
        setState("slow");
      }
    } else if (state !== "won") {
      start();
    }
  }, [state, windowMs, onWin, start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        fire();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  const heroPose: HeroPose = state === "won" ? "firing" : state === "early" || state === "slow" ? "too-slow" : "ready";
  const callout = state === "draw" ? "DRAW!" : state === "won" ? "BANG!" : state === "early" ? "TOO JUMPY!" : state === "slow" ? "TOO SLOW!" : "";

  const label: Record<DrawState, string> = {
    idle: "Step into the street",
    waiting: "Steady… wait for it…",
    draw: "DRAW!",
    early: "Too jumpy! You drew early. Try again",
    slow: `Too slow (${reaction} ms)! ${showdown.opponent} got away. Try again`,
    won: `Got him! (${reaction} ms)`,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 text-center">
      <p className="text-[hsl(38,40%,80%)] marker-text">{showdown.taunt}</p>
      <div className="scene-container relative select-none" data-testid="scene-showdown">
        <img src="./game/showdown-street.webp" alt="A dusty Moon-colony main street at high noon" className="w-full h-auto block" draggable={false} />
        {state === "draw" && <div className="absolute inset-0 bg-[hsl(0,72%,48%)]/35 pointer-events-none" aria-hidden />}
        <HeroArt pose={heroPose} className="absolute bottom-[3%] left-[4%] drop-shadow-2xl pointer-events-none" style={SPRITE} />
        {state !== "slow" && (
          <img
            src={showdown.image}
            alt={showdown.opponent}
            className="absolute bottom-[3%] right-[4%] drop-shadow-2xl pointer-events-none"
            style={state === "won" ? { ...SPRITE, transform: "rotate(14deg) translateY(6%)", filter: "grayscale(0.6)", transition: "all 0.25s" } : SPRITE}
            draggable={false}
          />
        )}
        <span
          className="absolute top-[5%] left-1/2 -translate-x-1/2 whitespace-nowrap pulp-title text-4xl md:text-7xl tracking-wider drop-shadow-lg"
          style={{ color: state === "draw" ? "#fff" : "hsl(45,80%,55%)", WebkitTextStroke: "2px hsl(25,40%,12%)" }}
          aria-live="assertive"
          data-testid="text-showdown-callout"
        >
          {callout}
        </span>
      </div>
      <button
        className={`retro-btn text-xl px-8 py-4 ${state === "draw" ? "gold" : ""}`}
        onClick={fire}
        disabled={state === "won"}
        data-testid="button-draw"
      >
        {label[state]}
      </button>
      <p className="text-xs text-[hsl(38,20%,60%)]">
        Click (or press Space) the instant you see DRAW! You have {windowMs} ms
        {windowMs > DRAW_WINDOW_MS ? " thanks to your Lucky Ray-Gun." : ". A better blaster from the Outfitters buys you more time."}
      </p>
    </div>
  );
}

// --- Page --------------------------------------------------------------------

export default function BountyPage() {
  const params = useParams<{ id: string }>();
  const bounty = bountyById(params.id);
  const { data: player } = usePlayer();
  const [stage, setStage] = useState<Stage>("briefing");
  const [found, setFound] = useState<Set<string>>(new Set());
  const [suspect, setSuspect] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(null);
  const [solution, setSolution] = useState<CaseSolution | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  const onFind = useCallback((clue: Clue) => setFound((prev) => new Set(prev).add(clue.id)), []);

  // Collect the reward; on failure the player can retry without replaying the duel.
  const collect = useCallback(() => {
    if (!bounty || !suspect) return;
    setClaiming(true);
    setClaimError(null);
    claimBounty(bounty.id, suspect)
      .then((o) => {
        setOutcome(o);
        doneTimer.current = setTimeout(() => setStage("done"), 900);
      })
      .catch((err) => setClaimError(errorMessage(err)))
      .finally(() => setClaiming(false));
  }, [bounty, suspect]);

  if (!bounty?.available) return <NotFound />;

  const windowMs = player?.owned.includes("raygun") ? DRAW_WINDOW_RAYGUN_MS : DRAW_WINDOW_MS;

  return (
    <div className="min-h-screen bg-[hsl(25,30%,12%)] paper-texture pb-10">
      <div className="bg-[hsl(0,45%,18%)] border-b-4 border-[hsl(45,80%,48%)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <OfficeLink />
          <h1 className="pulp-title text-lg md:text-2xl text-[hsl(45,80%,55%)] tracking-wider text-center">{bounty.title}</h1>
          <div className="visitor-ticker text-sm">💰 {bounty.reward} CR</div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-6">
        {stage === "briefing" && (
          <Panel title={`Case File — ${bounty.planet}`} testId="panel-briefing">
            <p className="text-sm leading-relaxed">{bounty.briefing}</p>
            <button className="retro-btn gold mt-4" onClick={() => setStage("investigate")} data-testid="button-start-investigation">
              ★ Take the job
            </button>
          </Panel>
        )}

        {stage === "investigate" && (
          <Investigation bounty={bounty} found={found} onFind={onFind} onReady={() => setStage("accuse")} />
        )}

        {stage === "accuse" && (
          <Accusation
            bounty={bounty}
            onCorrect={(id, sol) => {
              setSuspect(id);
              setSolution(sol);
              setStage("showdown");
            }}
          />
        )}

        {stage === "showdown" && solution && (
          <>
            <Showdown showdown={solution.showdown} windowMs={windowMs} onWin={collect} />
            {claimError && (
              <div className="text-center mt-3 space-y-2" role="alert">
                <p className="text-sm text-[hsl(0,65%,65%)]">Couldn't collect the bounty: {claimError}</p>
                <button className="retro-btn gold text-sm" onClick={collect} disabled={claiming} data-testid="button-retry-claim">
                  {claiming ? "Collecting…" : "Try collecting again"}
                </button>
              </div>
            )}
          </>
        )}

        {stage === "done" && (
          <Panel title="Bounty Collected!" testId="panel-done">
            <div className="flex items-center gap-4">
              <div className="starburst-badge shrink-0" style={{ width: 80, height: 80, fontSize: "0.8rem" }}>
                {outcome === "paid" ? <>+{bounty.reward}<br />CR</> : <>CASE<br />CLOSED</>}
              </div>
              <p className="text-sm leading-relaxed">
                {outcome === "paid"
                  ? `${solution?.outro ?? "Case closed."} ${bounty.reward} credits are yours — spend them at the Outfitters.`
                  : "Nice shooting — but you already collected this bounty. Each bounty only pays once per hunter."}
              </p>
            </div>
            {outcome === "paid" && bounty.fragment && (
              <div className="mt-4 pt-3 border-t-2 border-dashed border-[hsl(30,20%,68%)]" data-testid="panel-fragment">
                <p className="pulp-title text-lg text-[hsl(0,72%,40%)]">
                  ★ Star map fragment {numeral(bounty.fragment.number)} of {STAR_MAP_SIZE}: {bounty.fragment.name}
                </p>
                <p className="text-sm leading-relaxed mt-1">{bounty.fragment.caption}</p>
                <p className="marker-text text-xs text-[hsl(25,15%,42%)] mt-2">
                  It's pinned to Sterling's Star Map in the Bounty Office.
                </p>
              </div>
            )}
            <Link href="/bounties">
              <button className="retro-btn gold mt-4" data-testid="button-return-office">Back to the Bounty Office</button>
            </Link>
          </Panel>
        )}
      </main>
    </div>
  );
}
