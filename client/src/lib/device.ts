import { useSyncExternalStore } from "react";

// True when any touchscreen is available (phones, tablets, touch laptops); updates if
// that changes (e.g. a keyboard/trackpad is attached to a tablet).
const query = typeof window !== "undefined" ? window.matchMedia?.("(any-pointer: coarse)") : undefined;

export function useIsTouch(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      query?.addEventListener("change", onChange);
      return () => query?.removeEventListener("change", onChange);
    },
    () => query?.matches === true,
    () => false,
  );
}

// "Tap" on touchscreens, "Click" with a mouse, for instructions shown to the player.
export function useTapWord(): "Tap" | "Click" {
  return useIsTouch() ? "Tap" : "Click";
}
