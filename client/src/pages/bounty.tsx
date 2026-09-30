import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { HeroArt, heroSrc, preloadHeroPoses, type HeroPose } from "@/components/HeroArt";
import { usePlayer, useProgress, accuse, claimBounty, searchClue, decodeClue, unlockClue, askSuspect, presentClue, errorMessage, type ClaimOutcome } from "@/lib/game";
import {
  bountyById,
  DRAW_WINDOW_MS,
  DRAW_WINDOW_RAYGUN_MS,
  type Bounty,
  type CaseSolution,
  type Clue,
  type SeaChart,
  chartCell,
  chartColumn,
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
import { Scene } from "@/components/Scene";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { Sheet } from "@/components/Sheet";
import { ArtImage } from "@/components/ArtImage";
import { loadArt, prefetchArt } from "@/lib/art";

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

// --- Sea chart: work out the square, then send the diving bell down ------------

type ChartMark = SeaChart["marks"][number];

function MarkIcon({ icon }: { icon: ChartMark["icon"] }) {
  const paths: Record<ChartMark["icon"], React.ReactNode> = {
    dome: <path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 11V6M9 18v-4M15 18v-4" />,
    arch: <path d="M4 20v-8a8 8 0 0 1 16 0v8M9 20v-7a3 3 0 0 1 6 0v7" />,
    beacon: <path d="M10 20l1-10h2l1 10M8 20h8M10.5 10V7h3v3M12 4v1M6 5l2.5 2M18 5l-2.5 2" />,
    wreck: <path d="M2 13l19-4-1.5 5.5L5.5 18zM11 11L9.5 3.5M10 4.5l5.5 5" />,
    kelp: <path d="M7 21c-2-4 2-6 0-10s2-6 0-8M12 21c2-4-2-6 0-10s-2-6 0-8M17 21c-2-4 2-6 0-10" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[icon]}
    </svg>
  );
}

const SHALLOW = "hsl(185,38%,80%)";
const DEEP = "hsl(200,55%,30%)";
// The Beacon's light: gold stripes over the water, so deep and shallow still show through
const GLOW = "repeating-linear-gradient(45deg, hsla(45,95%,58%,0.85) 0 5px, transparent 5px 11px)";

function Chart({ bountyId, clue, foundText }: { bountyId: string; clue: Clue; foundText?: string }) {
  const chart = clue.chart!;
  const [cell, setCell] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (foundText) {
    return (
      <>
        <p className="text-sm leading-relaxed">{foundText}</p>
        <p className="pulp-title text-[hsl(120,50%,32%)] mt-2" role="status">✓ Found it!</p>
      </>
    );
  }

  const deep = new Set(chart.deep);
  const lit = new Set(chart.lit);
  const marks = new Map(chart.marks.map((m) => [m.cell, m]));
  const cols = Array.from({ length: chart.cols }, (_, i) => i + 1);
  const rows = Array.from({ length: chart.rows }, (_, i) => i + 1);

  const dive = () => {
    if (!cell) return;
    setChecking(true);
    setMessage(null);
    unlockClue(bountyId, clue.id, cell)
      .then((ok) => !ok && setMessage(`The diving bell finds nothing at ${cell} but sand and one very surprised octopus.`))
      .catch((err) => setMessage(errorMessage(err)))
      .finally(() => setChecking(false));
  };

  return (
    <>
      <p className="text-sm">Pick a square on the chart, then send the diving bell down to search it. North is up; east is to the right.</p>
      <div
        className="grid gap-0.5 mt-3 p-1 max-w-[26rem] mx-auto rounded border-2 border-[hsl(25,40%,20%)] bg-[hsl(38,35%,86%)]"
        style={{ gridTemplateColumns: `1.25rem repeat(${chart.cols}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Sea chart"
        data-testid="chart-grid"
      >
        <span />
        {cols.map((c) => (
          <span key={c} className="pulp-title text-xs text-center" style={{ color: INK }}>{chartColumn(c)}</span>
        ))}
        {rows.map((r) => (
          <div key={r} className="contents">
            <span className="pulp-title text-xs self-center text-center" style={{ color: INK }}>{r}</span>
            {cols.map((c) => {
              const id = chartCell(c, r);
              const mark = marks.get(id);
              const isDeep = deep.has(id);
              const base = isDeep ? DEEP : SHALLOW;
              return (
                <button
                  key={id}
                  className={`aspect-square flex items-center justify-center rounded-sm ${cell === id ? "ring-4 ring-[hsl(0,72%,48%)] z-10" : ""}`}
                  style={{ background: lit.has(id) ? `${GLOW}, ${base}` : base, color: isDeep ? "hsl(45,60%,92%)" : INK }}
                  onClick={() => {
                    setCell(id);
                    setMessage(null);
                  }}
                  aria-pressed={cell === id}
                  aria-label={`${id}${mark ? `, ${mark.name}` : ""}, ${isDeep ? "deep water" : "shallows"}${lit.has(id) ? ", in the Beacon's light" : ""}`}
                  data-testid={`chart-cell-${id}`}
                >
                  {mark && <MarkIcon icon={mark.icon} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: INK }}>
        {chart.marks.map((m) => (
          <li key={m.cell} className="flex items-center gap-1.5"><MarkIcon icon={m.icon} /> {m.name}</li>
        ))}
        <li className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-sm shrink-0" style={{ background: DEEP }} /> Dark water: the Deep</li>
        <li className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-sm shrink-0" style={{ background: SHALLOW }} /> Pale water: the shallows</li>
        <li className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-sm shrink-0" style={{ background: `${GLOW}, ${SHALLOW}` }} /> Gold stripes: the Beacon's light</li>
      </ul>
      <button className="retro-btn gold text-sm mt-3" onClick={dive} disabled={!cell || checking} data-testid="button-dive">
        {checking ? "Diving…" : cell ? `Send the diving bell to ${cell}` : "Pick a square first"}
      </button>
      {message && <p className="text-sm mt-2" role="status" data-testid="text-dive-result">{message}</p>}
    </>
  );
}

// --- Questioning suspects ------------------------------------------------------

function Interviews({
  bounty,
  found,
  caughtTopics,
}: {
  bounty: Bounty;
  found: Record<string, string>;
  // Lies already caught (from the server): "<suspect>/<topic>" -> breakthrough id
  caughtTopics: Record<string, string>;
}) {
  const suspects = bounty.suspects ?? [];
  const clues = (bounty.locations ?? []).flatMap((l) => l.clues).filter((c) => found[c.id] !== undefined);
  const [suspectId, setSuspectId] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");

  const interview = bounty.interviews?.find((i) => i.suspect === suspectId);
  const suspect = suspects.find((s) => s.id === suspectId);
  const key = `${suspectId}/${topicId}`;
  const caughtId = caughtTopics[key];
  const caught = caughtId && found[caughtId] !== undefined ? { id: caughtId, text: found[caughtId] } : null;
  useVoice(
    caught ? `breakthrough/${bounty.id}/${caught.id}`
      : topicId && answers[key] !== undefined ? `testimony/${bounty.id}/${suspectId}--${topicId}`
      : null,
  );

  const ask = (id: string) => {
    setTopicId(id);
    setMessage(null);
    setEvidence("");
    if (answers[`${suspectId}/${id}`] !== undefined) return;
    setBusy(true);
    askSuspect(bounty.id, suspectId!, id)
      .then((text) => setAnswers((a) => ({ ...a, [`${suspectId}/${id}`]: text })))
      .catch((err) => setMessage(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  const present = () => {
    if (!evidence || !topicId) return;
    setBusy(true);
    setMessage(null);
    presentClue(bounty.id, suspectId!, topicId, evidence)
      .then((r) => {
        if (!r.correct) setMessage(`${suspect?.name ?? "They"} doesn't flinch. That doesn't contradict their story.`);
      })
      .catch((err) => setMessage(errorMessage(err)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="panel-interviews">
      <p className="text-center marker-text text-sm text-[hsl(38,40%,80%)]">
        Ask what they know. If a story doesn't match your notebook, show them the clue that proves it.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {suspects.map((s) => (
          <button
            key={s.id}
            className={`comic-panel bg-[hsl(38,35%,88%)] p-2 text-center transition-transform ${s.id === suspectId ? "ring-4 ring-[hsl(45,80%,55%)]" : "hover:-translate-y-1"}`}
            onClick={() => {
              setSuspectId(s.id);
              setTopicId(null);
              setMessage(null);
            }}
            aria-pressed={s.id === suspectId}
            data-testid={`button-question-${s.id}`}
          >
            <ArtImage src={s.portrait} alt={`Portrait of ${s.name}`} className="w-full aspect-square rounded border-2 border-[hsl(25,40%,18%)]" imgClassName="object-cover" />
            <p className="pulp-title text-xs sm:text-sm mt-1 leading-tight" style={{ color: INK }}>{s.name}</p>
          </button>
        ))}
      </div>

      {interview && suspect && (
        <Panel title={`🗣 ${suspect.name}`} testId="panel-interview">
          <div className="flex flex-col gap-2">
            {interview.topics.map((t) => {
              const locked = t.after !== undefined && found[t.after] === undefined;
              return (
                <button
                  key={t.id}
                  className={`retro-btn text-sm text-left ${t.id === topicId ? "gold" : "teal"} disabled:opacity-50`}
                  disabled={locked || busy}
                  onClick={() => ask(t.id)}
                  data-testid={`button-topic-${t.id}`}
                >
                  {locked ? "🔒 Find more clues to ask about this" : t.label}
                </button>
              );
            })}
          </div>

          {topicId && answers[key] !== undefined && (
            <div className="mt-4 space-y-3">
              <blockquote className="border-l-4 border-[hsl(0,72%,48%)] pl-3 text-sm leading-relaxed italic" data-testid="text-answer">
                "{answers[key]}"
              </blockquote>
              {caught ? (
                <p className="text-sm leading-relaxed" role="status" data-testid="text-breakthrough">
                  <span className="pulp-title text-[hsl(120,50%,30%)]">★ Breakthrough! </span>
                  {caught.text}
                </p>
              ) : clues.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs pulp-title" htmlFor="evidence" style={{ color: INK }}>Show them:</label>
                  <select
                    id="evidence"
                    value={evidence}
                    onChange={(e) => {
                      setEvidence(e.target.value);
                      setMessage(null);
                    }}
                    className="text-sm px-2 py-1 bg-[hsl(38,30%,90%)] border-2 border-[hsl(30,20%,68%)] rounded max-w-full"
                    data-testid="select-evidence"
                  >
                    <option value="">Pick a clue…</option>
                    {clues.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                  <button className="retro-btn gold text-sm" onClick={present} disabled={!evidence || busy} data-testid="button-present">
                    Present evidence
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[hsl(25,15%,42%)]">Find clues you can use to test their story.</p>
              )}
            </div>
          )}
          {message && <p className="text-sm mt-3" role="status" data-testid="text-interview-result">{message}</p>}
        </Panel>
      )}
    </div>
  );
}

// --- Investigation ---------------------------------------------------------

function Investigation({
  bounty,
  found,
  caughtTopics,
  onReady,
  onScene,
}: {
  bounty: Bounty;
  found: Record<string, string>;
  caughtTopics: Record<string, string>;
  onReady: () => void;
  // The picture on screen, so the page behind can take its colours
  onScene: (src: string) => void;
}) {
  const locations = bounty.locations ?? [];
  const [locationId, setLocationId] = useState(locations[0]?.id);
  const [openClue, setOpenClue] = useState<Clue | null>(null);
  const [searching, setSearching] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [codedText, setCodedText] = useState<Record<string, string>>({});
  const location = locations.find((l) => l.id === locationId) ?? locations[0];
  const questioning = locationId === "interviews" && bounty.interviews !== undefined;
  const breakthroughs = (bounty.breakthroughs ?? []).filter((id) => found[id] !== undefined);
  const { data: player } = usePlayer();
  const tap = useTapWord();
  const allClues = locations.flatMap((l) => l.clues);
  useVoice(openClue && found[openClue.id] !== undefined ? `clue/${bounty.id}/${openClue.id}` : null);
  const foundCount = allClues.filter((c) => found[c.id] !== undefined).length + breakthroughs.length;
  const totalCount = allClues.length + (bounty.breakthroughs?.length ?? 0);
  const needed = cluesNeeded(bounty);
  const ready = foundCount >= needed;

  useEffect(() => {
    if (!questioning && location) onScene(location.image);
  }, [questioning, location, onScene]);

  // Once this place is on screen, quietly fetch the other locations and the suspects
  const warmUp = useCallback(() => {
    prefetchArt([...locations.map((l) => l.image), ...(bounty.suspects ?? []).map((s) => s.portrait)]);
  }, [locations, bounty.suspects]);

  const search = (clue: Clue) => {
    setOpenClue(clue);
    setSearchError(null);
    // Already in hand, or a lock or chart (nothing to fetch until it's solved)
    if (found[clue.id] !== undefined || codedText[clue.id] !== undefined || clue.lock || clue.chart) return;
    setSearching(clue.id);
    searchClue(bounty.id, clue.id)
      .then((r) => r.coded !== undefined && setCodedText((prev) => ({ ...prev, [clue.id]: r.coded })))
      .catch((err) => setSearchError(errorMessage(err)))
      .finally(() => setSearching(null));
  };

  const closeClue = useCallback(() => setOpenClue(null), []);

  const tabs = (overlay: boolean) => (
    <div className={overlay ? "scene-tabs" : "flex gap-2 justify-center flex-wrap"} role="group" aria-label="Places to search">
      {locations.map((l) => {
        const current = !questioning && l.id === location.id;
        return (
          <button
            key={l.id}
            className={overlay ? `scene-tab ${current ? "is-current" : ""}` : `retro-btn text-sm ${current ? "gold" : "teal"}`}
            aria-pressed={current}
            onClick={() => {
              setLocationId(l.id);
              setOpenClue(null);
            }}
            data-testid={`button-location-${l.id}`}
          >
            {l.name} <span className="scene-tab-count">{l.clues.filter((c) => found[c.id] !== undefined).length}/{l.clues.length}</span>
          </button>
        );
      })}
      {bounty.interviews && (
        <button
          className={overlay ? "scene-tab" : `retro-btn text-sm ${questioning ? "gold" : "teal"}`}
          aria-pressed={questioning}
          onClick={() => {
            setLocationId("interviews");
            setOpenClue(null);
          }}
          data-testid="button-location-interviews"
        >
          🗣 Question suspects <span className="scene-tab-count">{breakthroughs.length}/{bounty.breakthroughs?.length ?? 0}</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {questioning ? (
        <>
          {tabs(false)}
          <div className="iris-in" key="interviews">
            <Interviews bounty={bounty} found={found} caughtTopics={caughtTopics} />
          </div>
        </>
      ) : (
        <div className="bleed relative">
          {tabs(true)}
          <Scene
            key={location.image}
            src={location.image}
            alt={`${location.name} — search for clues`}
            testId={`scene-${location.id}`}
            reserve={210}
            onReveal={warmUp}
          >
            {location.clues.map((clue) => {
              const done = found[clue.id] !== undefined;
              return (
                <button
                  key={clue.id}
                  className={`hotspot ${done ? "is-found" : ""}`}
                  style={{ top: clue.top, left: clue.left, width: clue.width, height: clue.height }}
                  onClick={() => search(clue)}
                  aria-label={`Search ${clue.label}`}
                  title={clue.label}
                  data-unfound={!done}
                  data-testid={`hotspot-clue-${clue.id}`}
                >
                  {!done && <span className="hotspot-indicator" style={{ top: "50%", left: "50%" }} />}
                </button>
              );
            })}
          </Scene>
        </div>
      )}

      {openClue && (
        <Sheet title={`🔍 ${openClue.label}`} onClose={closeClue} testId="panel-clue">
          {openClue.lock ? (
            <Lock key={openClue.id} bountyId={bounty.id} clue={openClue} openedText={found[openClue.id]} />
          ) : openClue.chart ? (
            <Chart key={openClue.id} bountyId={bounty.id} clue={openClue} foundText={found[openClue.id]} />
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
            <p className="text-sm leading-relaxed animate-fade-in">{found[openClue.id]}</p>
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
        </Sheet>
      )}

      <section className="notebook max-w-2xl mx-auto" data-testid="panel-notebook">
        <div className="flex justify-between items-baseline">
          <h2 className="pulp-title text-lg" style={{ color: INK }}>Hunter's Notebook</h2>
          <span className="pulp-title text-sm" style={{ color: ready ? "hsl(120,50%,32%)" : INK }}>
            {foundCount}/{totalCount} clues
          </span>
        </div>
        {foundCount === 0 ? (
          <p className="text-sm text-[hsl(25,15%,42%)] marker-text mt-2">
            {tap} the twinkling spots in each place to search. Stuck? 🔍 Look closer.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-[hsl(25,30%,22%)] list-disc pl-5">
            {allClues.filter((c) => found[c.id] !== undefined).map((c) => (
              <li key={c.id} className="animate-fade-in"><strong>{c.label}:</strong> {found[c.id]}</li>
            ))}
            {breakthroughs.map((id) => (
              <li key={id} className="animate-fade-in"><strong>★ Breakthrough:</strong> {found[id]}</li>
            ))}
          </ul>
        )}
        <button
          className={`retro-btn mt-4 disabled:opacity-50 disabled:cursor-not-allowed ${ready ? "is-ready" : ""}`}
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
    <div className="space-y-4 max-w-3xl mx-auto pt-2">
      <h2 className="pulp-title text-3xl text-center text-[hsl(45,80%,58%)] tracking-wider drop-shadow-lg">{bounty.accusePrompt ?? "Who did it?"}</h2>
      <p className="text-center marker-text text-xs text-[hsl(38,30%,75%)] sm:hidden">Swipe through the suspects, then tap your culprit</p>
      <div className="poster-rail">
        {(bounty.suspects ?? []).map((s, i) => (
          <button
            key={s.id}
            className="wanted-poster comic-panel bg-[hsl(38,35%,88%)] p-4 text-left flex flex-col justify-start disabled:opacity-60 rise-in"
            style={{ animationDelay: `${i * 90}ms` }}
            disabled={pending !== null}
            onClick={() => choose(s.id, s.name)}
            data-testid={`button-suspect-${s.id}`}
          >
            <p className="pulp-title text-center text-[hsl(0,72%,42%)] tracking-widest text-sm">WANTED?</p>
            <ArtImage
              src={s.portrait}
              alt={`Portrait of ${s.name}`}
              className="w-full aspect-square my-2 border-2 border-[hsl(25,40%,18%)] rounded"
              imgClassName="object-cover"
              eager
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
  // The duel only opens once the street and both gunslingers are loaded
  const [set, setSet] = useState(false);
  const drawAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scene = showdown.scene ?? "./game/showdown-street.webp";

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    let live = true;
    preloadHeroPoses(["firing", "too-slow"], [suit]);
    Promise.all([loadArt(scene, "high"), loadArt(showdown.image, "high"), loadArt(heroSrc("ready", suit), "high")]).then(() => live && setSet(true));
    return () => {
      live = false;
    };
  }, [scene, showdown.image, suit]);

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
    if (!set) return;
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
  }, [set, state, windowMs, onWin, start]);

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
    early: "Too jumpy! Try again",
    slow: `Too slow (${reaction} ms)! Try again`,
    won: `Got 'em! (${reaction} ms)`,
  };

  return (
    <div className="bleed">
      <div className="duel-stage select-none" data-state={state} data-set={set} data-testid="scene-showdown">
        <ArtImage src={scene} alt="The street, cleared for a showdown" className="duel-bg" imgClassName="object-cover" eager />
        <div className="duel-flash" aria-hidden />
        {set && (
          <>
            <HeroArt pose={heroPose} suit={suit} className="duel-sprite duel-hero" />
            {state !== "slow" && (
              <img
                src={showdown.image}
                alt={showdown.opponent}
                className={`duel-sprite duel-villain ${state === "won" ? "is-down" : ""}`}
                draggable={false}
              />
            )}
          </>
        )}
        <p className="duel-taunt">{showdown.taunt}</p>
        <span className="duel-callout pulp-title" aria-live="assertive" data-testid="text-showdown-callout">
          {callout}
        </span>
        {!set && (
          <div className="scene-tuning" role="status">
            <span className="scene-tuning-bars" aria-hidden><i /><i /><i /><i /></span>
            The street clears…
          </div>
        )}
        <button
          className={`duel-draw retro-btn ${state === "draw" ? "gold" : ""}`}
          // Fire on press, not release: on phones the finger's time on the glass
          // would otherwise count against the draw. Keyboard/assistive clicks still work.
          onPointerDown={(e) => {
            e.preventDefault();
            fire();
          }}
          onClick={(e) => e.detail === 0 && fire()}
          disabled={state === "won" || !set}
          data-testid="button-draw"
        >
          {set ? label[state] : "…"}
        </button>
      </div>
      <p className="text-xs text-center text-[hsl(38,20%,65%)] mt-3 pl-4 pr-16 sm:px-4">
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
  const [sceneSrc, setSceneSrc] = useState<string | undefined>(bounty?.locations?.[0]?.image);
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
  const firstPlace = bounty.locations?.[0];
  const backdrop = stage === "showdown" || stage === "done" ? solution?.showdown.scene ?? sceneSrc : sceneSrc;

  return (
    <div className="game-page">
      <SceneBackdrop src={backdrop} />
      <header className="game-header">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <OfficeLink />
          <h1 className="pulp-title text-base sm:text-lg md:text-2xl text-[hsl(45,80%,58%)] tracking-wider text-center leading-tight">{bounty.title}</h1>
          <div className="visitor-ticker text-xs sm:text-sm whitespace-nowrap shrink-0">💰 {bounty.reward} CR</div>
        </div>
      </header>

      <main className="game-main max-w-5xl mx-auto px-4">
       <div key={stage} className={stage === "briefing" ? "rise-in" : "iris-in"}>
        {stage === "briefing" && (
          <>
          {firstPlace && (
            // Establishing shot of the first place to search, while the case is read
            <div className="bleed mb-4">
              <Scene
                src={firstPlace.image}
                alt={firstPlace.name}
                testId="scene-briefing"
                reserve={260}
                maxHeight={360}
                onReveal={() => prefetchArt((bounty.locations ?? []).map((l) => l.image))}
              />
            </div>
          )}
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
          </>
        )}

        {stage === "investigate" && (
          <Investigation
            bounty={bounty}
            found={progress?.found ?? {}}
            caughtTopics={progress?.caught ?? {}}
            onReady={() => setStage("accuse")}
            onScene={setSceneSrc}
          />
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
       </div>
      </main>
    </div>
  );
}
