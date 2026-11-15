import { useEffect, useRef, useState } from "react";
import { ArtImage } from "@/components/ArtImage";
import { Sheet } from "@/components/Sheet";
import { errorMessage, playStandoffCard } from "@/lib/game";
import {
  STANDOFF_BASICS,
  STANDOFF_COMPOSURE,
  STANDOFF_NERVE,
  type StandoffBasicId,
  type StandoffCardKind,
  type StandoffOutcome,
  type StandoffPlay,
  type StandoffView,
} from "@shared/game";

// The card duel between naming the culprit and the draw. The server holds the villain's
// deck and decides every turn; this screen shows the face-up card and the hunter's hand.

type Entry = { id: string; label: string; text: string };

const KIND_NAME: Record<StandoffCardKind, string> = { evidence: "Evidence", gotcha: "Gotcha", basic: "Basic" };
// The same three inks as the spines on the cards
const KIND_TONE: Record<StandoffCardKind, { tone: string; title?: string }> = {
  evidence: { tone: "hsl(195 65% 38%)" },
  gotcha: { tone: "hsl(45 80% 52%)", title: "hsl(25 40% 12%)" },
  basic: { tone: "hsl(0 72% 48%)" },
};

// A hand card's face: the notebook entry it came from, or a basic card's rule.
function faceOf(card: { id: string; kind: StandoffCardKind }, entries: Entry[]): { title: string; text: string } {
  if (card.kind === "basic") {
    const basic = STANDOFF_BASICS[card.id as StandoffBasicId];
    return { title: basic?.name ?? card.id, text: basic?.rule ?? "" };
  }
  const entry = entries.find((e) => e.id === card.id);
  return { title: (entry?.label ?? card.id).replace(/^Breakthrough: /, ""), text: entry?.text ?? "" };
}

const minus = (n: number) => `−${Math.abs(n)}`;

// What the last card did, in a line.
function lastLine(last: StandoffPlay): string {
  const nerve = last.nerve < 0 ? ` Nerve ${minus(last.nerve)}.` : "";
  const composure = last.composure < 0 ? ` Composure ${minus(last.composure)}.` : last.composure > 0 ? ` Composure +${last.composure}.` : "";
  if (last.against === "opening") return last.hit ? `A jab before they can speak.${nerve}` : "You set that card aside and take another.";
  if (last.against === "alibi") {
    if (!last.hit) return `That doesn't touch the alibi.${composure}`;
    // Only a caught lie hits this hard
    return last.nerve <= -3 ? `Their own lie breaks the alibi.${nerve}` : `That breaks the alibi.${nerve}`;
  }
  if (!last.hit) return `Bluster doesn't care about evidence.${composure}`;
  // Evidence never answers Bluster, so a card that did and isn't a basic is a caught lie
  if (!(last.card in STANDOFF_BASICS)) return `You throw their own lie back at them.${nerve}`;
  if (last.card === "steady-hand") return `You let it roll off you.${composure || " Composure is already full."}`;
  if (last.card === "tip-of-the-hat") return "You tip your hat and take two more cards.";
  return `You stare it down.${nerve}`;
}

const VERDICT: Record<StandoffOutcome, { title: string; line: (name: string) => string }> = {
  broke: { title: "Their nerve broke", line: (name) => `${name} flinches first. You'll have longer on the draw.` },
  held: { title: "Nobody blinked", line: (name) => `${name} ran out of things to say. The draw is even.` },
  rattled: { title: "They got under your skin", line: (name) => `${name} talked you off balance. You'll draw rushed.` },
};

function Pips({ label, value, max, tone, testId }: { label: string; value: number; max: number; tone: "nerve" | "composure"; testId: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="img" aria-label={`${label} ${value} of ${max}`} data-testid={testId} data-value={value}>
      <span className="pulp-title text-sm tracking-wider">{label}</span>
      <span className={`standoff-pips is-${tone}`} aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <i key={i} className={`standoff-pip ${i < value ? "is-full" : ""}`} />
        ))}
      </span>
    </span>
  );
}

export function Standoff({
  bountyId,
  view,
  entries,
  opponent,
  portrait,
  windowMs,
  baseMs,
  onDone,
}: {
  bountyId: string;
  view: StandoffView;
  // The hunter's notebook: where Evidence and Gotcha cards get their words
  entries: Entry[];
  opponent: string;
  portrait?: string;
  // The draw window as it stands now, and what gear alone would give
  windowMs: number;
  baseMs: number;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The accusation above was a long page; the cards start at the top of the screen.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  // After a card is played it is gone from the hand, so keyboard focus moves to what
  // happened next: the result line, or the way into the street once it's over.
  const lastRef = useRef<HTMLParagraphElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const turnAtMount = useRef(view.turn);
  useEffect(() => {
    if (view.turn === turnAtMount.current) return;
    (view.outcome ? continueRef.current : lastRef.current)?.focus({ preventScroll: true });
  }, [view.turn, view.outcome]);

  const picked = view.hand.find((c) => c.id === selected) ?? null;
  const pickedFace = picked ? faceOf(picked, entries) : null;

  const play = async () => {
    if (!picked || pending) return;
    setPending(true);
    setError(null);
    try {
      await playStandoffCard(bountyId, picked.id, view.turn);
      setSelected(null);
    } catch (err) {
      setError(`That card didn't reach the table: ${errorMessage(err)}`);
    } finally {
      setPending(false);
    }
  };

  const change = windowMs - baseMs;
  const verdict = view.outcome ? VERDICT[view.outcome] : null;

  return (
    <section className="standoff" data-testid="panel-standoff" data-outcome={view.outcome ?? ""}>
      <h2 className="pulp-title text-2xl text-center text-[hsl(45,80%,58%)] tracking-wider drop-shadow-lg">The Standoff</h2>

      <div className="standoff-villain">
        {portrait && (
          <ArtImage src={portrait} alt={`Portrait of ${opponent}`} className="standoff-mug" imgClassName="object-cover" eager />
        )}
        <div className="min-w-0">
          <p className="pulp-title text-xl leading-tight text-[hsl(38,40%,92%)]">{opponent}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[hsl(38,40%,88%)]">
            <Pips label="Nerve" value={view.nerve} max={STANDOFF_NERVE} tone="nerve" testId="text-standoff-nerve" />
            {!view.outcome && (
              <span className="marker-text text-xs" data-testid="text-standoff-turn">
                {view.opening ? "Your move first" : `Card ${view.round} of ${view.rounds}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* What the last card did, then what the villain says next */}
      <p ref={lastRef} tabIndex={-1} className="standoff-last text-sm text-center" role="status" aria-live="polite" data-testid="text-standoff-last">
        {view.last ? lastLine(view.last) : ""}
      </p>

      {verdict ? (
        <div className="comic-panel bg-[hsl(38,35%,90%)] p-4 animate-slide-up" style={{ color: "hsl(25,40%,15%)" }} data-testid="panel-standoff-result">
          <p className="pulp-title text-2xl text-[hsl(0,72%,42%)]">{verdict.title}</p>
          <p className="text-sm leading-relaxed mt-1">{verdict.line(opponent)}</p>
          <p className="pulp-title text-lg mt-3" data-testid="text-standoff-window">
            {windowMs} ms to draw
            {change !== 0 && <span className="text-[hsl(25,15%,38%)]"> ({change > 0 ? `+${change}` : minus(change)} ms)</span>}
          </p>
          <button ref={continueRef} className="retro-btn gold mt-3 w-full sm:w-auto" onClick={onDone} data-testid="button-standoff-continue">
            Step into the street
          </button>
        </div>
      ) : (
        <div key={`${view.round}-${view.opening ? "open" : "said"}`} className="standoff-said animate-slide-up" data-testid="panel-standoff-villain-card" data-kind={view.villain?.kind ?? "opening"}>
          {view.villain ? (
            <>
              <span className={`standoff-stamp ${view.villain.kind === "bluster" ? "is-bluster" : ""}`}>
                {view.villain.kind === "alibi" ? "Alibi" : "Bluster"}
              </span>
              <p className="standoff-words">{view.villain.text}</p>
              <p className="marker-text text-xs mt-2 text-[hsl(25,15%,38%)]">
                {view.villain.kind === "alibi"
                  ? "Needs the clue that contradicts it, or a lie you caught."
                  : "Clues are no use. Needs a basic card, or a lie you caught."}
              </p>
            </>
          ) : (
            <>
              <span className="standoff-stamp is-opening">Your move</span>
              <p className="standoff-words">
                Your Hair-Trigger Holster gets a card on the table before {opponent} can speak.
              </p>
              <p className="marker-text text-xs mt-2 text-[hsl(25,15%,38%)]">
                A Stare Down or a lie you caught lands a jab. Any other card is swapped for a new one.
              </p>
            </>
          )}
        </div>
      )}

      {!view.outcome && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[hsl(38,40%,88%)]">
            <Pips label="Your composure" value={view.composure} max={STANDOFF_COMPOSURE} tone="composure" testId="text-standoff-composure" />
            <span className="marker-text text-xs">
              {view.deckLeft === 0 ? "No cards left to draw" : `${view.deckLeft} more in your notebook`}
            </span>
          </div>

          <div className="standoff-hand" role="group" aria-label="Your hand">
            {view.hand.map((card) => {
              const face = faceOf(card, entries);
              return (
                <button
                  key={card.id}
                  className={`standoff-card is-${card.kind}`}
                  aria-pressed={card.id === selected}
                  disabled={pending}
                  onClick={() => {
                    setSelected(card.id === selected ? null : card.id);
                    setError(null);
                  }}
                  data-testid={`button-standoff-card-${card.id}`}
                  data-kind={card.kind}
                >
                  <span className="standoff-card-kind">{KIND_NAME[card.kind]}</span>
                  <span className="standoff-card-title">{face.title}</span>
                </button>
              );
            })}
          </div>

          <p className="marker-text text-xs text-center text-[hsl(38,30%,75%)]">Tap a card to read it, then play it.</p>
          {error && <p className="text-sm text-center text-[hsl(0,65%,65%)]" role="alert">{error}</p>}

          {picked && pickedFace && (
            // The card's words slide up from the bottom, so the villain's card stays in view above
            <Sheet
              title={`${KIND_NAME[picked.kind]}: ${pickedFace.title}`}
              onClose={() => setSelected(null)}
              tone={KIND_TONE[picked.kind].tone}
              titleColor={KIND_TONE[picked.kind].title}
              testId="sheet-standoff-card"
              returnFocusTo={`button-standoff-card-${picked.id}`}
            >
              <p className="text-sm leading-relaxed" data-testid="text-standoff-card">{pickedFace.text}</p>
              {view.villain && (
                // On a small phone this sheet covers the table, so their words come along
                <p className="standoff-against" data-testid="text-standoff-against">
                  <strong>Against their {view.villain.kind === "alibi" ? "Alibi" : "Bluster"}:</strong> {view.villain.text}
                </p>
              )}
              <button
                className="retro-btn gold w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={play}
                disabled={pending}
                data-testid="button-standoff-play"
              >
                {pending ? "Playing…" : "Play this card"}
              </button>
            </Sheet>
          )}
        </>
      )}
    </section>
  );
}
