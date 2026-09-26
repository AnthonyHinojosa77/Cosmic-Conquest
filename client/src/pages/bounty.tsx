import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { HeroArt, preloadHeroPoses, type HeroPose } from "@/components/HeroArt";
import { usePlayer, useProgress, accuse, claimBounty, searchClue, decodeClue, unlockClue, errorMessage, type ClaimOutcome } from "@/lib/game";
import {
  bountyById,
  DRAW_WINDOW_MS,
  DRAW_WINDOW_RAYGUN_MS,
  type Bounty,
  type CaseSolution,
  type Clue,
  STAR_MAP_SIZE,
  numeral,
  cluesNeeded,
  bountyEarnedInvite,
  DEFAULT_SUIT,
  ITEMS,
  shiftLetters,
  type SuitId,
} from "@shared/game";
import NotFound from "@/pages/not-found";
import { useMusic, useVoice } from "@/lib/sound";
import { useIsTouch, useTapWord } from "@/lib/device";
import { OfficeLink } from "@/components/OfficeLink";

const INK = "hsl(25,40%,15%)";
type Stage = "briefing" | "investigate" | "accuse" | "showdown" | "done";


function Panel({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="discovery-panel animate-slide-up" style={{ position: "relative", maxWidth: 640, margin: "0 auto" }} data-testid={testId}>
      <div className="discovery-panel-header"><span>{title}</span></div>
      <div className="discovery-panel-body text-[hsl(25,40%,20%)]">{children}</div>
    </div>
  );
}

// --- Coded clues --------------------------------------------------------------

function Decoder({
  bountyId,
  clue,
  hasTool,
  coded,
  solvedText,
}: {
  bountyId: string;
  clue: Clue;
  hasTool: boolean;
  coded?: string;
  solvedText?: string;
}) {
  const [dial, setDial] = useState(0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const tape = (text: string) => (
    <p
      className="font-mono text-sm leading-relaxed tracking-wider bg-[hsl(45,40%,94%)] border-2 border-dashed border-[hsl(30,20%,68%)] rounded px-3 py-2 break-words"
      aria-live="polite"
      data-testid="text-telegram"
    >
      {text}
    </p>
  );

  if (solvedText) {
    return (
      <>
        {tape(solvedText)}
        <p className="pulp-title text-[hsl(120,50%,32%)] mt-2" role="status">✓ Decoded!</p>
      </>
    );
  }

  if (coded === undefined) {
    return <p className="text-sm marker-text text-[hsl(25,15%,42%)]">Searching…</p>;
  }

  if (!hasTool) {
    return (
      <>
        {tape(coded)}
        <p className="text-sm mt-2">It's in code. You'll need something to decode it with.</p>
      </>
    );
  }

  const tool = ITEMS[clue.cipher!.requires];
  const tryKey = () => {
    setChecking(true);
    setMessage(null);
    decodeClue(bountyId, clue.id, dial)
      .then((ok) => !ok && setMessage(`Key ${dial} just gives gibberish. Keep turning.`))
      .catch((err) => setMessage(errorMessage(err)))
      .finally(() => setChecking(false));
  };

  return (
    <>
      {tape(shiftLetters(coded, -dial))}
      <p className="text-xs text-[hsl(25,15%,42%)] mt-2 italic">
        {tool.name}: {tool.description}
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          className="retro-btn teal text-sm px-3"
          onClick={() => setDial((d) => (d + 25) % 26)}
          aria-label="Turn the dial back"
          data-testid="button-dial-down"
        >
          ◀
        </button>
        <span className="pulp-title text-lg w-20 text-center" style={{ color: INK }} data-testid="text-dial">
          Key {dial}
        </span>
        <button
          className="retro-btn teal text-sm px-3"
          onClick={() => setDial((d) => (d + 1) % 26)}
          aria-label="Turn the dial forward"
          data-testid="button-dial-up"
        >
          ▶
        </button>
        <button className="retro-btn gold text-sm" onClick={tryKey} disabled={checking} data-testid="button-decode">
          {checking ? "Checking…" : `Decode with key ${dial}`}
        </button>
      </div>
      {message && <p className="text-sm mt-2" role="status" data-testid="text-decode-result">{message}</p>}
    </>
  );
}

function Lock({ bountyId, clue, openedText }: { bountyId: string; clue: Clue; openedText?: string }) {
  const [digits, setDigits] = useState<number[]>(() => Array(clue.lock!.dials).fill(0));
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (openedText) {
    return (
      <>
        <p className="text-sm leading-relaxed">{openedText}</p>
        <p className="pulp-title text-[hsl(120,50%,32%)] mt-2" role="status">✓ Unlocked!</p>
      </>
    );
  }

  const turn = (i: number, by: number) => {
    setMessage(null);
    setDigits((d) => d.map((v, j) => (j === i ? (v + by + 10) % 10 : v)));
  };
  const tryCode = () => {
    setChecking(true);
    setMessage(null);
    unlockClue(bountyId, clue.id, digits.join(""))
      .then((ok) => !ok && setMessage("The lock won't budge. Wrong combination."))
      .catch((err) => setMessage(errorMessage(err)))
      .finally(() => setChecking(false));
  };

  return (
    <>
      <p className="text-sm">A chunky padlock with {clue.lock!.dials} number dials. Someone had to write the combination down somewhere…</p>
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <div className="flex gap-2" role="group" aria-label="Combination dials">
          {digits.map((v, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <button className="retro-btn teal text-xs px-2 py-1" onClick={() => turn(i, 1)} aria-label={`Dial ${i + 1} up`} data-testid={`button-lock-up-${i}`}>▲</button>
              <span
                className="pulp-title text-2xl w-10 text-center rounded border-2 border-[hsl(25,40%,20%)] bg-[hsl(45,40%,94%)]"
                style={{ color: INK }}
                aria-label={`Dial ${i + 1}: ${v}`}
                data-testid={`text-lock-dial-${i}`}
              >
                {v}
              </span>
              <button className="retro-btn teal text-xs px-2 py-1" onClick={() => turn(i, -1)} aria-label={`Dial ${i + 1} down`} data-testid={`button-lock-down-${i}`}>▼</button>
            </div>
          ))}
        </div>
        <button className="retro-btn gold text-sm" onClick={tryCode} disabled={checking} data-testid="button-unlock">
          {checking ? "Trying…" : "Try the combination"}
        </button>
      </div>
      {message && <p className="text-sm mt-2" role="status" data-testid="text-unlock-result">{message}</p>}
    </>
  );
}

// --- Investigation ---------------------------------------------------------

function Investigation({
  bounty,
  found,
  onReady,
}: {
  bounty: Bounty;
  found: Record<string, string>;
  onReady: () => void;
}) {
  const locations = bounty.locations ?? [];
  const [locationId, setLocationId] = useState(locations[0]?.id);
  const [openClue, setOpenClue] = useState<Clue | null>(null);
  const [searching, setSearching] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [codedText, setCodedText] = useState<Record<string, string>>({});
  const [imgLoaded, setImgLoaded] = useState(false);
  const location = locations.find((l) => l.id === locationId) ?? locations[0];
  const { data: player } = usePlayer();
  const tap = useTapWord();
  const allClues = locations.flatMap((l) => l.clues);
  useVoice(openClue && found[openClue.id] !== undefined ? `clue/${bounty.id}/${openClue.id}` : null);
  const foundCount = allClues.filter((c) => found[c.id] !== undefined).length;
  const needed = cluesNeeded(bounty);
  const ready = foundCount >= needed;

  const search = (clue: Clue) => {
    setOpenClue(clue);
    setSearchError(null);
    // Already in hand, or a lock (nothing to fetch until it's opened)
    if (found[clue.id] !== undefined || codedText[clue.id] !== undefined || clue.lock) return;
    setSearching(clue.id);
    searchClue(bounty.id, clue.id)
      .then((r) => r.coded !== undefined && setCodedText((prev) => ({ ...prev, [clue.id]: r.coded })))
      .catch((err) => setSearchError(errorMessage(err)))
      .finally(() => setSearching(null));
  };

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
            {l.name} ({l.clues.filter((c) => found[c.id] !== undefined).length}/{l.clues.length})
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
            className={`hotspot ${found[clue.id] !== undefined ? "border-[hsl(120,50%,45%)]/60" : ""}`}
            style={{ top: clue.top, left: clue.left, width: clue.width, height: clue.height }}
            onClick={() => search(clue)}
            aria-label={`Search ${clue.label}`}
            title={clue.label}
            data-testid={`hotspot-clue-${clue.id}`}
          >
            {found[clue.id] === undefined && (
              <div className="hotspot-indicator" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
            )}
          </button>
        ))}
      </div>

      {openClue && (
        <Panel title={`🔍 ${openClue.label}`} testId="panel-clue">
          {openClue.lock ? (
            <Lock key={openClue.id} bountyId={bounty.id} clue={openClue} openedText={found[openClue.id]} />
          ) : openClue.cipher && searchError === null ? (
            <Decoder
              key={openClue.id}
              bountyId={bounty.id}
              clue={openClue}
              hasTool={player?.items.includes(openClue.cipher.requires) ?? false}
              coded={codedText[openClue.id]}
              solvedText={found[openClue.id]}
            />
          ) : found[openClue.id] !== undefined ? (
            <p className="text-sm leading-relaxed">{found[openClue.id]}</p>
          ) : searching === openClue.id ? (
            <p className="text-sm marker-text text-[hsl(25,15%,42%)]">Searching…</p>
          ) : (
            <p className="text-sm" role="alert">
              Couldn't search here{searchError ? `: ${searchError}` : ""}.{" "}
              <button className="underline" onClick={() => search(openClue)}>Try again</button>
            </p>
          )}
          {openClue.grants && player?.items.includes(openClue.grants) && (
            <p className="text-sm mt-3 pulp-title text-[hsl(0,72%,40%)]" role="status" data-testid="text-item-found">
              🎒 In your satchel: {ITEMS[openClue.grants].name}
            </p>
          )}
        </Panel>
      )}

      <section className="comic-panel bg-[hsl(38,35%,88%)] p-4 max-w-2xl mx-auto" data-testid="panel-notebook">
        <div className="flex justify-between items-baseline">
          <h2 className="pulp-title text-lg" style={{ color: INK }}>Hunter's Notebook</h2>
          <span className="pulp-title text-sm" style={{ color: ready ? "hsl(120,50%,32%)" : INK }}>
            {foundCount}/{allClues.length} clues
          </span>
        </div>
        {foundCount === 0 ? (
          <p className="text-sm text-[hsl(25,15%,42%)] marker-text mt-2">{tap} the glowing spots in each location to search.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-[hsl(25,30%,22%)] list-disc pl-5">
            {allClues.filter((c) => found[c.id] !== undefined).map((c) => (
              <li key={c.id}><strong>{c.label}:</strong> {found[c.id]}</li>
            ))}
          </ul>
        )}
        <button
          className="retro-btn mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!ready}
          onClick={onReady}
          data-testid="button-ready-accuse"
        >
          {ready ? "★ Name your suspect" : `Find ${needed - foundCount} more clue${needed - foundCount === 1 ? "" : "s"}`}
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
  suit,
  onWin,
}: {
  showdown: CaseSolution["showdown"];
  windowMs: number;
  suit: SuitId;
  onWin: () => void;
}) {
  const isTouch = useIsTouch();
  const [state, setState] = useState<DrawState>("idle");
  const [reaction, setReaction] = useState<number | null>(null);
  const drawAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    preloadHeroPoses(["ready", "firing", "too-slow"], [suit]);
    new Image().src = showdown.image;
    if (showdown.scene) new Image().src = showdown.scene;
  }, [showdown.image, showdown.scene, suit]);

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
        <img src={showdown.scene ?? "./game/showdown-street.webp"} alt="The main street at high noon, cleared for a showdown" className="w-full h-auto block" draggable={false} />
        {state === "draw" && <div className="absolute inset-0 bg-[hsl(0,72%,48%)]/35 pointer-events-none" aria-hidden />}
        <HeroArt pose={heroPose} suit={suit} className="absolute bottom-[3%] left-[4%] drop-shadow-2xl pointer-events-none" style={SPRITE} />
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
        // Fire on press, not release: on phones the finger's time on the glass
        // would otherwise count against the draw. Keyboard/assistive clicks still work.
        onPointerDown={(e) => {
          e.preventDefault();
          fire();
        }}
        onClick={(e) => e.detail === 0 && fire()}
        disabled={state === "won"}
        data-testid="button-draw"
      >
        {label[state]}
      </button>
      <p className="text-xs text-[hsl(38,20%,60%)]">
        {isTouch ? "Tap the button" : "Click (or press Space)"} the instant you see DRAW! You have {windowMs} ms
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
  const { data: progress } = useProgress(bounty?.available ? bounty.id : null);
  const [suspect, setSuspect] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ClaimOutcome | null>(null);
  const [solution, setSolution] = useState<CaseSolution | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(doneTimer.current), []);

  // Venus gets its own lounge music; every duel gets the showdown theme.
  useMusic(!bounty?.available ? null : stage === "showdown" ? "showdown" : bounty.id === "venus-fog" ? "venus" : "investigate");
  useVoice(
    !bounty?.available ? null
      : stage === "briefing" ? `briefing/${bounty.id}`
      : stage === "showdown" && solution ? `taunt/${bounty.id}`
      : stage === "done" && outcome === "paid" ? `outro/${bounty.id}`
      : null,
  );

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
          <h1 className="pulp-title text-base sm:text-lg md:text-2xl text-[hsl(45,80%,55%)] tracking-wider text-center leading-tight">{bounty.title}</h1>
          <div className="visitor-ticker text-xs sm:text-sm whitespace-nowrap shrink-0">💰 {bounty.reward} CR</div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-6">
        {stage === "briefing" && (
          <Panel title={`Case File — ${bounty.planet}`} testId="panel-briefing">
            <p className="text-sm leading-relaxed">{bounty.briefing}</p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button className="retro-btn gold" onClick={() => setStage("investigate")} data-testid="button-start-investigation">
                ★ Take the job
              </button>
              {progress?.accused && (
                // Named the culprit before a refresh: go straight back to the duel
                <button
                  className="retro-btn"
                  onClick={() => {
                    const { suspect: id, ...sol } = progress.accused!;
                    setSuspect(id);
                    setSolution(sol);
                    setStage("showdown");
                  }}
                  data-testid="button-resume-showdown"
                >
                  Back to the showdown
                </button>
              )}
            </div>
          </Panel>
        )}

        {stage === "investigate" && (
          <Investigation bounty={bounty} found={progress?.found ?? {}} onReady={() => setStage("accuse")} />
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
            <Showdown showdown={solution.showdown} windowMs={windowMs} suit={player?.suit ?? DEFAULT_SUIT} onWin={collect} />
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
            {bounty.fragment && (
              <div className="mt-4 pt-3 border-t-2 border-dashed border-[hsl(30,20%,68%)]" data-testid="panel-fragment">
                <p className="pulp-title text-lg text-[hsl(0,72%,40%)]">
                  ★ Star map fragment {numeral(bounty.fragment.number)} of {STAR_MAP_SIZE}: {bounty.fragment.name}
                </p>
                <p className="text-sm leading-relaxed mt-1">{bounty.fragment.caption}</p>
                <p className="marker-text text-xs text-[hsl(25,15%,42%)] mt-2">
                  It's pinned to Sterling's Star Map in the Bounty Office.
                </p>
                {outcome === "paid" && player && bountyEarnedInvite(player.completedBounties, bounty.id) && (
                  <p className="pulp-title text-base text-[hsl(245,45%,30%)] mt-3" data-testid="text-aurelia-invite">
                    ✉ Along with your reward comes an envelope sealed in gold wax: an invitation to Aurelia.
                  </p>
                )}
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
