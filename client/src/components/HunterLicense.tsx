import { useEffect, useRef, useState } from "react";
import { HOST_LINES } from "@shared/game";
import { usePlayer, useUpdatePlayer, errorMessage } from "@/lib/game";
import { useVoice } from "@/lib/sound";
import { isDefaultCallsign, markSigned } from "@/lib/onboarding";
import { HeroArt } from "@/components/HeroArt";

// Meeting your hunter: the host asks for a name, and the new hunter signs the Bounty
// Guild's license, which gets stamped. The name is the callsign on the leaderboard.
export function HunterLicense({ onDone }: { onDone: () => void }) {
  const { data: player } = usePlayer();
  const update = useUpdatePlayer();
  const [name, setName] = useState("");
  const [signed, setSigned] = useState<string | null>(null);
  const sending = useRef(false); // a double tap mustn't sign twice
  useVoice(signed ? null : "host/license");

  // Keep a name they already chose (signed earlier, then left before the office)
  useEffect(() => {
    if (player && !isDefaultCallsign(player.callsign)) setName((n) => n || player.callsign);
  }, [player?.callsign]);

  const trimmed = name.trim();
  const sign = (e: React.FormEvent) => {
    e.preventDefault();
    if (signed) return onDone(); // Enter after signing moves on
    if (!trimmed || !player || sending.current) return;
    sending.current = true;
    update.mutate(
      { callsign: trimmed },
      {
        onSuccess: (p) => {
          markSigned();
          setSigned(p.callsign);
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  };

  return (
    <section className="license-stage" aria-label="Your bounty hunter's license">
      <p className="host-caption rise-in">“{signed ? `${signed}. Has a ring to it.` : HOST_LINES.license}”</p>

      <form className="license paper-texture" onSubmit={sign} data-testid="panel-license">
        <div className="license-head">
          <span className="pulp-title license-title">Bounty Hunter's License</span>
          <span className="license-issuer">Bounty Guild of Aurelia</span>
        </div>
        <div className="license-body">
          <div className="license-photo">
            <HeroArt pose="standing" className="license-photo-img" />
          </div>
          <div className="license-fields">
            <label className="license-label" htmlFor="hunter-name">Name</label>
            <input
              id="hunter-name"
              className="license-name"
              value={name}
              maxLength={24}
              autoComplete="nickname"
              placeholder="Sign here"
              readOnly={signed !== null}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-hunter-name"
            />
            <span className="license-label">Rank</span>
            <span className="license-value">Greenhorn</span>
            <span className="license-label">Good for</span>
            <span className="license-value">Every world in the Sterling system</span>
          </div>
        </div>
        {signed && <span className="license-stamp pulp-title" aria-hidden>Licensed</span>}
      </form>

      {update.isError && (
        <p className="license-error" role="alert">{errorMessage(update.error)}</p>
      )}

      {/* Keyed, so Continue is a new button and takes the focus */}
      {signed ? (
        <button key="continue" className="retro-btn gold license-action" onClick={onDone} autoFocus data-testid="button-license-continue">
          Continue
        </button>
      ) : (
        <button
          key="sign"
          className="retro-btn gold license-action"
          onClick={sign}
          disabled={!trimmed || !player || update.isPending}
          data-testid="button-sign-license"
        >
          {update.isPending ? "Signing…" : "Sign the license"}
        </button>
      )}
    </section>
  );
}
