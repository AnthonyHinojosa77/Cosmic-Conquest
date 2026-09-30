import { useSyncExternalStore } from "react";

// Chrome on Android offers to install the game once per page load, usually while
// the player is still on the hub. Catch the offer at startup so the Bounty Office
// tip (components/InstallHint.tsx) can use it later.
export type InstallPrompt = Event & { prompt: () => Promise<void> };

let offer: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // our own tip asks instead of the browser's banner
    offer = e as InstallPrompt;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    changed();
  });
}

export function useInstallPrompt(): InstallPrompt | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => offer,
    () => null,
  );
}
