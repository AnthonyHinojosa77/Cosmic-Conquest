import { useEffect, useRef, useState } from "react";
import { HOST_LINES, STAR_MAP_SIZE, numeral, type HostLine } from "@shared/game";
import { useVoice } from "@/lib/sound";
import { ArtImage } from "@/components/ArtImage";
import { HeroArt } from "@/components/HeroArt";
import { SceneBackdrop } from "@/components/SceneBackdrop";

// The host walks a new hunter through a case, one illustrated panel at a time, using
// art the game already has. Also opened from the start menu's "How to play".

// `backdrop` is the art whose colours fill the screen around the panel
type Panel = { id: HostLine; title: string; art: React.ReactNode; backdrop?: string };

const OFFICE = "./game/bounty-office-no-hero.webp";

const cover = (src: string, alt: string) => (
  <ArtImage src={src} alt={alt} className="howto-cover" imgClassName="howto-cover-img" eager />
);

const PANELS: Panel[] = [
  {
    id: "how-office",
    title: "Take a job",
    art: cover(OFFICE, "The Bounty Office, with wanted posters pinned to a cork board"),
    backdrop: OFFICE,
  },
  {
    id: "how-search",
    title: "Search for clues",
    art: cover("./scenes/expo-scene.webp", "The Atomic Expo, one of the places you search"),
    backdrop: "./scenes/expo-scene.webp",
  },
  {
    id: "how-puzzles",
    title: "Crack the tough ones",
    art: cover("./scenes/venus-conservatory.webp", "A misty conservatory with a locked staff locker"),
    backdrop: "./scenes/venus-conservatory.webp",
  },
  {
    id: "how-accuse",
    title: "Name the culprit",
    art: (
      <div className="howto-suspects">
        {["gearhart", "vela", "cookie"].map((s, i) => (
          <ArtImage key={s} src={`./game/suspect-${s}.webp`} alt="A suspect's wanted poster" className="howto-suspect" delay={i * 120} eager />
        ))}
      </div>
    ),
    backdrop: "./game/suspect-vela.webp",
  },
  {
    id: "how-showdown",
    title: "Win the quick-draw",
    art: (
      <>
        {cover("./game/showdown-street.webp", "A dusty Moon-colony street at high noon")}
        <HeroArt pose="ready" className="howto-hero" />
      </>
    ),
    backdrop: "./game/showdown-street.webp",
  },
  {
    id: "how-reward",
    title: "Get paid, follow the map",
    art: (
      // Looks like the star map in the Bounty Office, with the first two pieces found
      <div className="howto-map" aria-label="Aurora Sterling's star map, with two of its pieces found" role="img">
        {Array.from({ length: STAR_MAP_SIZE }, (_, i) => (
          <span key={i} className={i < 2 ? "is-found pulp-title" : "pulp-title"}>
            {i < 2 ? `★ ${numeral(i + 1)}` : numeral(i + 1)}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "how-ready",
    title: "Your first job is waiting",
    art: (
      <>
        {cover(OFFICE, "The Bounty Office")}
        <HeroArt pose="standing" className="howto-hero" />
      </>
    ),
    backdrop: OFFICE,
  },
];

export function HowToPlay({
  finishLabel,
  onFinish,
  leaveLabel,
  onLeave,
}: {
  finishLabel: string;
  onFinish: () => void;
  // A way out before the last panel ("Skip" during sign-up, "Close" from the menu)
  leaveLabel: string;
  onLeave: () => void;
}) {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = PANELS[step];
  const last = step === PANELS.length - 1;
  useVoice(`host/${panel.id}`);

  // Each step starts reading from its title (keyboards and screen readers included)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && !last) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
      if (e.key === "Escape") onLeave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onLeave]);

  return (
    <>
      <SceneBackdrop src={panel.backdrop} tint={panel.backdrop ? undefined : "hsl(220 45% 8%)"} />
      <section className="howto" aria-label="How to play" data-testid="panel-howto">
        {!last && (
          <button className="title-skip" onClick={onLeave} data-testid="button-howto-leave">
            {leaveLabel}
          </button>
        )}
        <div key={panel.id} className="howto-art iris-in">
          {panel.art}
        </div>
        <div className="howto-card paper-texture">
          <div className="howto-steps" aria-hidden>
            {PANELS.map((p, i) => (
              <span key={p.id} className={i === step ? "is-current" : i < step ? "is-done" : ""} />
            ))}
          </div>
          <h2 ref={heading} tabIndex={-1} className="pulp-title howto-title">
            <span className="sr-only">
              Step {step + 1} of {PANELS.length}:{" "}
            </span>
            {panel.title}
          </h2>
          <p className="howto-line" aria-live="polite" data-testid="text-howto-line">
            {HOST_LINES[panel.id]}
          </p>
          <div className="howto-nav">
            {step > 0 ? (
              <button className="howto-back" onClick={() => setStep(step - 1)} data-testid="button-howto-back">
                Back
              </button>
            ) : (
              <span />
            )}
            {last ? (
              <button className="retro-btn gold" onClick={onFinish} data-testid="button-howto-finish">
                {finishLabel}
              </button>
            ) : (
              <button className="retro-btn" onClick={() => setStep(step + 1)} data-testid="button-howto-next">
                Next
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
