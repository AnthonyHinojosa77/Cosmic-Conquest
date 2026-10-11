import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { HOST_LINES, type HostLine } from "@shared/game";
import { usePlayer, useLeaderboard } from "@/lib/game";
import { useMusic, useSound, useVoice, setSoundOn, playVoice, stopVoice } from "@/lib/sound";
import { introSeen, markIntroSeen, markOnboarded, hasHunter } from "@/lib/onboarding";
import { SterlingBroadcast, markBroadcastHeard } from "@/components/SterlingBroadcast";
import { HunterLicense } from "@/components/HunterLicense";
import { HowToPlay } from "@/components/HowToPlay";
import { Sheet } from "@/components/Sheet";
import { ArtImage } from "@/components/ArtImage";
import { SceneBackdrop } from "@/components/SceneBackdrop";

// The front of the game, hosted by the radio announcer:
//   first launch: turn on the radio > the announcer's intro > start menu
//   Start: sign your hunter's license > Aurora Sterling's broadcast > how to play > Bounty Office
//   returning hunters: start menu > Continue > Bounty Office
type Stage = "gate" | "intro" | "menu" | "license" | "story" | "howto" | "guide";

export default function Title() {
  const [stage, setStage] = useState<Stage>(() => (introSeen() ? "menu" : "gate"));
  const [titleUp, setTitleUp] = useState(false);
  const [, navigate] = useLocation();
  // Music comes in with the title card, not over the radio tuning in
  useMusic(stage === "gate" || (stage === "intro" && !titleUp) ? null : "hub");

  const endIntro = useCallback(() => {
    markIntroSeen();
    setStage("menu");
  }, []);
  const toOffice = () => {
    markOnboarded();
    navigate("/bounties");
  };

  switch (stage) {
    case "gate":
      return (
        <RadioGate
          onTune={(withSound) => {
            setSoundOn(withSound); // during the tap, so browsers allow the sound
            setStage("intro");
          }}
        />
      );
    case "intro":
      return <RadioIntro onTitle={() => setTitleUp(true)} onDone={endIntro} />;
    case "license":
      return (
        <div className="title-screen">
          <SceneBackdrop src="./game/bounty-office-no-hero.webp" />
          <HunterLicense onDone={() => setStage("story")} />
        </div>
      );
    case "story":
      return <Story onDone={() => setStage("howto")} />;
    case "howto":
      return (
        <div className="title-screen">
          <HowToPlay finishLabel="Open the Bounty Office" onFinish={toOffice} onLeave={toOffice} leaveLabel="Skip" />
        </div>
      );
    case "guide":
      return (
        <div className="title-screen">
          <HowToPlay finishLabel="Back to the menu" onFinish={() => setStage("menu")} onLeave={() => setStage("menu")} leaveLabel="Close" />
        </div>
      );
    default:
      return (
        <StartMenu
          onStart={() => setStage("license")}
          onContinue={() => navigate("/bounties")}
          onGuide={() => setStage("guide")}
        />
      );
  }
}

// --- The radio -----------------------------------------------------------------

function RadioSet({ on }: { on: boolean }) {
  return (
    <div className="radio-set" aria-hidden>
      <div className={`radio-dial${on ? " is-on" : ""}`}>
        <div className="radio-scale">
          {[55, 60, 70, 80, 100, 120, 140, 160].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className="radio-needle" />
      </div>
      <div className="radio-grille">
        <span className="radio-knob" />
        <span className="radio-knob" />
      </div>
    </div>
  );
}

function RadioGate({ onTune }: { onTune: (withSound: boolean) => void }) {
  return (
    <section className="radio-night" aria-label="Cosmic Conquest" data-testid="screen-radio-gate">
      <RadioSet on={false} />
      <div className="gate-actions">
        <button className="retro-btn gold gate-on" onClick={() => onTune(true)} autoFocus data-testid="button-radio-on">
          Turn on the radio
        </button>
        <button className="gate-quiet" onClick={() => onTune(false)} data-testid="button-radio-quiet">
          Play without sound
        </button>
      </div>
    </section>
  );
}

// How long a line stays up when there's no voice to wait for: time to read it.
const readMs = (text: string) => Math.max(2600, 1200 + text.length * 45);

// One beat of the intro: show the line, play the host's voice, and move on once both
// the reading time has passed and the voice has finished (or never came).
function useHostBeat(id: HostLine, onDone: () => void) {
  const { on } = useSound();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let voiceOver = !on;
    let timeOver = false;
    let finished = false;
    const finish = () => {
      if (voiceOver && timeOver && !finished) {
        finished = true;
        done.current();
      }
    };
    const timer = setTimeout(() => {
      timeOver = true;
      finish();
    }, readMs(HOST_LINES[id]));
    if (on) {
      playVoice(`host/${id}`, () => {
        voiceOver = true;
        finish();
      });
    }
    // A voice that never reports back (a stalled download) mustn't hold the show
    const cap = setTimeout(() => {
      voiceOver = timeOver = true;
      finish();
    }, 12000);
    return () => {
      clearTimeout(timer);
      clearTimeout(cap);
      stopVoice();
    };
  }, [id, on]);
}

const INTRO: HostLine[] = ["intro-tune", "intro-title", "intro-tagline"];

function Beat({ id, onDone }: { id: HostLine; onDone: () => void }) {
  useHostBeat(id, onDone);
  return null;
}

function RadioIntro({ onTitle, onDone }: { onTitle: () => void; onDone: () => void }) {
  const [beat, setBeat] = useState(0);
  const next = useCallback(() => setBeat((b) => b + 1), []);

  useEffect(() => {
    if (beat >= 1) onTitle();
    if (beat >= INTRO.length) onDone();
  }, [beat, onTitle, onDone]);

  const id = INTRO[Math.min(beat, INTRO.length - 1)];
  return (
    <section className="radio-night" aria-label="Intro" data-testid="screen-intro">
      <button className="title-skip" onClick={onDone} data-testid="button-skip-intro">
        Skip intro
      </button>
      {beat < INTRO.length && <Beat key={id} id={id} onDone={next} />}
      {beat === 0 ? (
        <>
          <RadioSet on />
          <p key={id} className="host-caption rise-in" aria-live="polite">“{HOST_LINES[id]}”</p>
        </>
      ) : (
        <div className="title-card">
          <p className="title-presents">Sterling Atomic presents</p>
          <h1 className="title-logo">
            <span>Cosmic</span> <span>Conquest</span>
          </h1>
          <p className={`host-caption${beat >= 2 ? " rise-in" : " is-hidden"}`} aria-live="polite">
            {beat >= 2 ? `“${HOST_LINES["intro-tagline"]}”` : ""}
          </p>
        </div>
      )}
    </section>
  );
}

// --- Start menu -------------------------------------------------------------------

function StartMenu({ onStart, onContinue, onGuide }: { onStart: () => void; onContinue: () => void; onGuide: () => void }) {
  const { data: player, isLoading } = usePlayer();
  const [board, setBoard] = useState(false);
  const returning = hasHunter(player);

  return (
    <section className="title-screen menu" aria-label="Start menu" data-testid="screen-menu">
      <SceneBackdrop src="./scenes/hub-cover.webp" />
      <div className="menu-cover rise-in">
        <ArtImage
          src="./scenes/hub-cover.webp"
          alt="Cosmic Conquest, Thrilling Tales of the Future: a 25-cent pulp magazine cover with a rocket, a city of tomorrow and a robot waitress"
          className="menu-cover-art"
          imgClassName="menu-cover-img"
          eager
        />
      </div>
      <nav className="menu-actions" aria-label="Menu">
        {returning && player && <p className="menu-welcome marker-text">Welcome back, {player.callsign}.</p>}
        <button
          className="retro-btn gold menu-primary"
          onClick={returning ? onContinue : onStart}
          disabled={isLoading}
          data-testid={returning ? "button-continue" : "button-start"}
        >
          {isLoading ? "Tuning in…" : returning ? "Continue" : "Start"}
        </button>
        <div className="menu-secondary">
          <button className="retro-btn teal" onClick={onGuide} data-testid="button-how-to-play">
            How to play
          </button>
          <button className="retro-btn teal" onClick={() => setBoard(true)} data-testid="button-top-hunters">
            Top hunters
          </button>
        </div>
        <p className="menu-tagline marker-text">The future isn't what it used to be</p>
      </nav>
      {board && (
        <Sheet title="Top hunters" onClose={() => setBoard(false)} testId="sheet-top-hunters">
          <TopHunters />
        </Sheet>
      )}
    </section>
  );
}

function TopHunters() {
  const { data, isLoading, isError } = useLeaderboard();
  if (isLoading) return <p className="text-sm">Tuning in…</p>;
  if (isError) return <p className="text-sm">The signal's down. Try again in a moment.</p>;
  if (!data?.length) return <p className="text-sm">No bounties collected yet. The top spot is yours for the taking.</p>;
  return (
    <ol className="top-hunters">
      {data.map((e, i) => (
        <li key={`${e.callsign}-${i}`}>
          <span className="pulp-title">{i + 1}.</span>
          <span className="top-hunters-name">{e.callsign}</span>
          <span className="top-hunters-earned">{e.earned.toLocaleString()} CR</span>
        </li>
      ))}
    </ol>
  );
}

// --- The story: Aurora Sterling's broadcast, introduced by the host ------------------

function Story({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"before" | "broadcast" | "after">("before");
  useVoice(phase === "before" ? "host/story-before" : phase === "after" ? "host/story-after" : null);
  return (
    <section className="radio-night" aria-label="The story" data-testid="screen-story">
      <RadioSet on={phase !== "before"} />
      <p key={phase === "after" ? "after" : "before"} className="host-caption rise-in" aria-live="polite">
        “{phase === "after" ? HOST_LINES["story-after"] : HOST_LINES["story-before"]}”
      </p>
      {phase === "before" && (
        <button className="retro-btn gold" onClick={() => setPhase("broadcast")} data-testid="button-tune-in">
          Tune in
        </button>
      )}
      {phase === "after" && (
        <button className="retro-btn gold" onClick={onDone} autoFocus data-testid="button-story-continue">
          Continue
        </button>
      )}
      {phase === "broadcast" && (
        <SterlingBroadcast
          onClose={() => {
            markBroadcastHeard();
            setPhase("after");
          }}
        />
      )}
    </section>
  );
}
