import { useState } from "react";
import { useInstallPrompt } from "@/lib/install";

// A one-time tip for playing full screen: added to the Home Screen, the game opens
// with no browser bars (the only way to hide them on iPhone). Android offers its
// own install prompt, which the button triggers. Hidden once installed or dismissed.
const KEY = "cc_install_hint_dismissed";

function standalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)").matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function InstallHint() {
  const android = useInstallPrompt();
  const [hidden, setHidden] = useState(() => standalone() || dismissed());
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
  };

  if (hidden || (!ios && !android)) return null;

  return (
    <div className="install-hint rise-in" role="note" data-testid="install-hint">
      <span className="install-hint-icon" aria-hidden>🚀</span>
      <p className="flex-1 text-sm leading-snug">
        <strong className="pulp-title tracking-wider text-[hsl(45,90%,65%)]">Play full screen. </strong>
        {android ? "Install Cosmic Conquest and it opens like an app, with no browser bars." : <>Tap Share (the square with the arrow), then <em>Add to Home Screen</em>, and it opens like an app.</>}
      </p>
      {android && (
        <button className="retro-btn gold text-sm" onClick={() => android.prompt().finally(close)} data-testid="button-install">
          Install
        </button>
      )}
      <button className="install-hint-close" onClick={close} aria-label="Dismiss tip">✕</button>
    </div>
  );
}
