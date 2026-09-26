import { setSoundOn, useSound } from "@/lib/sound";

// Corner button to turn music and voices on or off (off by default).
export function SoundToggle() {
  const { on, hasAudio } = useSound();
  if (!hasAudio) return null;
  return (
    <button
      className="retro-btn text-sm fixed z-40 shadow-lg"
      style={{
        right: "calc(1rem + env(safe-area-inset-right, 0px))",
        bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
      }}
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      data-testid="button-sound"
    >
      {on ? "🔊 Sound on" : "🔈 Sound off"}
    </button>
  );
}
