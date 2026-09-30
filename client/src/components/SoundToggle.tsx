import { setSoundOn, useSound } from "@/lib/sound";

// Corner button to turn music and voices on or off (off by default). A small
// round icon on phones so it stays clear of the scene, sheets and the draw button.
export function SoundToggle() {
  const { on, hasAudio } = useSound();
  if (!hasAudio) return null;
  return (
    <button
      className="sound-toggle"
      style={{
        right: "calc(0.75rem + env(safe-area-inset-right, 0px))",
        bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
      }}
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      data-testid="button-sound"
    >
      <span aria-hidden>{on ? "🔊" : "🔈"}</span>
      <span className="sound-toggle-label">{on ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
