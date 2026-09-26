import { useEffect, useSyncExternalStore } from "react";
import { API_BASE } from "@/lib/queryClient";

// Background music per place, plus character voice lines. Everything starts muted;
// the player turns sound on with the button in the corner (browsers also require a
// click before any audio can play).
//
// Music volume goes through a Web Audio gain node: iPhones ignore changes to an audio
// element's own volume, so fades and ducking would do nothing there otherwise.

export type Track = "hub" | "office" | "investigate" | "showdown" | "aurelia" | "venus";

const ENABLED_KEY = "cc_sound_on";
const MUSIC_VOLUME = 0.45;
const DUCKED_VOLUME = 0.15; // music dips while someone is talking
const FADE_S = 0.7;

let enabled = readEnabled();
let available: Set<Track> | null = null; // tracks that actually exist (audio.json)
let hasVoices = false;
let wanted: Track | null = null;
let current: { track: Track; el: HTMLAudioElement; gain: GainNode | null } | null = null;
let voice: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
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

function audioContext(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
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

// Ramp music to a level (falls back to the element's own volume without Web Audio).
function level(to: number, m = current) {
  if (!m) return;
  if (m.gain && ctx) {
    const g = m.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(to, ctx.currentTime + FADE_S);
  } else {
    m.el.volume = Math.max(0, Math.min(1, to));
  }
}

// Bring the playing music in line with what the current screen wants.
function sync() {
  const target = enabled && wanted && available?.has(wanted) ? wanted : null;
  if (target === (current?.track ?? null)) return;
  const old = current;
  if (old) {
    level(0, old);
    setTimeout(() => old.el.pause(), FADE_S * 1000);
  }
  current = null;
  if (!target) return;

  const el = new Audio(`./audio/music/${target}.m4a`);
  el.loop = true;
  const ac = audioContext();
  let gain: GainNode | null = null;
  if (ac) {
    gain = ac.createGain();
    gain.gain.value = 0;
    ac.createMediaElementSource(el).connect(gain).connect(ac.destination);
  } else {
    el.volume = 0;
  }
  const m = { track: target, el, gain };
  current = m;
  el.play()
    .then(() => level(voice ? DUCKED_VOLUME : MUSIC_VOLUME, m))
    .catch(() => {
      // Blocked until the player clicks (e.g. after a reload); retried then.
      if (current === m) current = null;
    });
}

// Browsers only allow sound after a click or key press; retry on the next one.
for (const type of ["pointerdown", "keydown"]) {
  window.addEventListener(type, () => {
    if (!enabled) return;
    audioContext();
    if (!current) sync();
  });
}

export function setSoundOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
  if (on) audioContext(); // created during the click, so browsers allow it
  else stopVoice();
  sync();
  notify();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useSound() {
  const on = useSyncExternalStore(subscribe, () => enabled);
  const hasAudio = useSyncExternalStore(subscribe, () => (available?.size ?? 0) > 0 || hasVoices);
  return { on, hasAudio };
}

// Play this track while the calling screen is showing.
export function useMusic(track: Track | null) {
  useEffect(() => {
    wanted = track;
    manifest.then(sync);
    sync();
    return () => {
      // Let the next screen claim its track first, so a shared track keeps playing.
      if (wanted === track) wanted = null;
      setTimeout(sync, 50);
    };
  }, [track]);
}

export function stopVoice() {
  if (voice) {
    voice.pause();
    voice = null;
    level(MUSIC_VOLUME);
  }
}

// Speak a line (the server decides whether this hunter may hear it yet).
// Missing lines are simply silent.
export function playVoice(path: string) {
  if (!enabled) return;
  stopVoice();
  const el = new Audio(`${API_BASE}/api/voice/${path}`);
  voice = el;
  const done = () => {
    if (voice === el) stopVoice();
  };
  el.addEventListener("playing", () => voice === el && level(DUCKED_VOLUME)); // dip only once it really plays
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
