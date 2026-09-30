import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { captureInstallPrompt } from "./lib/install";

captureInstallPrompt();

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);

// Lift the loading splash (index.html) once the fonts are in, so the first thing
// a player sees is the game in its own lettering, not a flash of fallback type.
// Never waits more than 2.5 s; shows for at least 0.5 s so it doesn't flicker.
const boot = document.getElementById("boot");
if (boot) {
  const started = performance.now();
  const lift = () => {
    const wait = Math.max(0, 500 - (performance.now() - started));
    setTimeout(() => {
      boot.classList.add("done");
      setTimeout(() => boot.remove(), 600);
    }, wait);
  };
  const fonts = document.fonts
    ? Promise.all(["1em Bangers", "1em 'Permanent Marker'", "1em 'Space Grotesk'"].map((f) => document.fonts.load(f)))
    : Promise.resolve();
  Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(lift, lift);
}
