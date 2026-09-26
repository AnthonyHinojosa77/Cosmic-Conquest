import { useEffect, useSyncExternalStore } from "react";

// Background music per place, plus character voice lines. Everything starts muted;
// the player turns sound on with the button in the corner (browsers also require a
// click before any audio can play).

export type Track = "hub" | "office" | "investigate" | "showdown" | "aurelia" | "venus";

const ENABLED_KEY = "cc_sound_on";
const MUSIC_VOLUME = 0.45;
const DUCKED_VOLUME = 0.15; // music dips while someone is talking
const FADE_MS = 700;

let enabled = readEnabled();
let available: Set<Track> | null = null; // tracks that actually exist (audio.json)
let hasVoices = false;
let wanted: Track | null = null;
let music: HTMLAudioElement | null = null;
let musicTrack: Track | null = null;
let voice: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function notify() {
  listeners.forEach((l) => l());
}

// What audio exists, so the sound button only shows once there's something to hear.
const manifest: Promise<void> = fetch("./audio/audio.json")
  .then((r) => (r.ok ? r.json() : {}))
  .catch(() => ({}))
  .then((m: { music?: Track[]; voices?: boolean }) => {
    available = new Set(m.music ?? []);
    hasVoices = m.voices === true;
    notify();
    sync();
  });

function fade(el: HTMLAudioElement, to: number, done?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.max(0, Math.min(1, (now - start) / FADE_MS));
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

// Bring the playing music in line with what the current screen wants.
function sync() {
  const target = enabled && wanted && available?.has(wanted) ? wanted : null;
  if (target === musicTrack) return;
  const old = music;
  if (old) fade(old, 0, () => old.pause());
  music = null;
  musicTrack = target;
  if (!target) return;
  const el = new Audio(`./audio/music/${target}.m4a`);
  el.loop = true;
  el.volume = 0;
  music = el;
  el.play().then(() => fade(el, voice ? DUCKED_VOLUME : MUSIC_VOLUME)).catch(() => {});
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
  if (!on) stopVoice();
  sync();
  notify();
}

export function useSound() {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );
  const hasAudio = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (available?.size ?? 0) > 0 || hasVoices,
  );
  return { on, hasAudio };
}

// Play this track while the calling screen is showing.
export function useMusic(track: Track | null) {
  useEffect(() => {
    wanted = track;
    manifest.then(sync);
    sync();
  }, [track]);
}

export function stopVoice() {
  if (voice) {
    voice.pause();
    voice = null;
  }
  if (music) fade(music, MUSIC_VOLUME);
}

// Speak a line (the server decides whether this hunter may hear it yet).
// Missing lines are simply silent.
export function playVoice(path: string) {
  if (!enabled) return;
  stopVoice();
  const el = new Audio(`/api/voice/${path}`);
  voice = el;
  if (music) fade(music, DUCKED_VOLUME);
  const done = () => {
    if (voice === el) stopVoice();
  };
  el.addEventListener("ended", done);
  el.addEventListener("error", done);
  el.play().catch(done);
}

// Speak a line when the calling component shows it; stop when it goes away.
export function useVoice(path: string | null) {
  const { on } = useSound();
  useEffect(() => {
    if (!path || !on) return;
    playVoice(path);
    return () => stopVoice();
  }, [path, on]);
}
