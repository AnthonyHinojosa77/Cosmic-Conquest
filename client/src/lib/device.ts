// "Tap" on touchscreens, "Click" with a mouse, for instructions shown to the player.
export const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
export const TAP = isTouch ? "Tap" : "Click";
