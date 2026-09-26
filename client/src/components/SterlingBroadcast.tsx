import { useEffect, useRef } from "react";
import { setSoundOn, useSound, useVoice } from "@/lib/sound";
import { AURORA_BROADCAST } from "@shared/game";

// Aurora Sterling's last broadcast: the story hook new hunters hear first.
// Act I only — pure promise and wonder, no cracks (see GAME_PLAN.md).

const HEARD_KEY = "cc_sterling_broadcast_heard";

export function hasHeardBroadcast(): boolean {
  try {
    return localStorage.getItem(HEARD_KEY) === "1";
  } catch {
    return true; // storage blocked: don't pop it up on every visit
  }
}

export function markBroadcastHeard() {
  try {
    localStorage.setItem(HEARD_KEY, "1");
  } catch {
    // ignore
  }
}

export function SterlingBroadcast({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useVoice("aurora/broadcast");
  const { on: soundOn, hasAudio } = useSound();

  useEffect(() => {
    // Focus the dialog itself (not the button, which is still fading in) and
    // keep the scroll at the top so the broadcast is read from its start.
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        // Keep focus inside the dialog, cycling through its buttons.
        const buttons = Array.from(dialog.current?.querySelectorAll("button") ?? []);
        if (buttons.length === 0) return;
        e.preventDefault();
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
        buttons[next].focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  // Lines come in one after another, like a signal tuning in
  const line = (i: number) => ({ animationDelay: `${0.3 + i * 0.7}s` });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "hsla(25, 40%, 6%, 0.82)" }}
      role="presentation"
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-title"
        className="discovery-panel animate-slide-up"
        style={{ position: "relative", maxWidth: 560, width: "100%", maxHeight: "calc(100dvh - 2rem)", overflowY: "auto", outline: "none" }}
        data-testid="dialog-broadcast"
      >
        <div className="discovery-panel-header">
          <span id="broadcast-title">📻 Incoming Broadcast — All Frequencies</span>
        </div>
        <div className="discovery-panel-body text-[hsl(25,40%,20%)] space-y-3">
          <p className="text-xs uppercase tracking-widest text-[hsl(25,15%,42%)] animate-fade-in" style={line(0)}>
            Sterling Atomic Radio Network · relayed to every receiver in the solar system
          </p>
          <p className="text-sm animate-fade-in" style={line(1)}>
            The voice that built the monorails, the Moon colonies and the World's Fair of Tomorrow:
            <span className="font-semibold"> "{AURORA_BROADCAST.intro}"</span>
          </p>
          <blockquote
            className="pulp-title text-2xl leading-snug text-[hsl(0,72%,40%)] animate-fade-in"
            style={line(2)}
          >
            "{AURORA_BROADCAST.quote}"
          </blockquote>
          <p className="marker-text text-sm text-[hsl(25,15%,42%)] animate-fade-in" style={line(3)}>
            …and the signal dissolves into static. No one has seen her since.
          </p>
          <p className="text-sm animate-fade-in" style={line(4)}>
            Every bounty hunter, dreamer and crook in the system is searching now. Each bounty you
            close turns up a piece of her star map.
          </p>
          <div className="flex flex-wrap items-center gap-3 animate-fade-in" style={line(5)}>
            <button className="retro-btn gold" onClick={onClose} data-testid="button-join-search">
              ★ Join the search
            </button>
            {hasAudio && !soundOn && (
              // The corner sound button sits behind this dialog, so offer it here too.
              <button className="retro-btn teal text-sm" onClick={() => setSoundOn(true)} data-testid="button-broadcast-sound">
                🔊 Hear it with sound
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
