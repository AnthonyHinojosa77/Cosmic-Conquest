import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { errorMessage } from "@/lib/game";
import { AURELIA_INVITE_FRAGMENTS, type AureliaLocation, type AureliaSpot } from "@shared/game";

// Aurelia's own look: indigo night, silver and gold (Art Deco), on the same paper.
const NIGHT = "hsl(240,40%,10%)";
const GOLD = "hsl(45,80%,58%)";

function OfficeLink() {
  return (
    <Link href="/bounties">
      <button
        className="inline-flex items-center gap-2 text-sm text-[hsl(240,20%,75%)] hover:text-[hsl(45,80%,60%)] transition-colors pulp-title tracking-wider"
        data-testid="button-back-office"
      >
        <span className="text-lg">←</span>
        <span>Bounty Office</span>
      </button>
    </Link>
  );
}

// Uninvited hunters only get as far as the gates.
function Gates({ message }: { message: string }) {
  return (
    <main className="max-w-4xl mx-auto px-4 pt-6 space-y-4 text-center">
      <div className="scene-container" data-testid="scene-aurelia-gates">
        <img
          src="./game/aurelia-gates.webp"
          alt="The golden Art Deco gates of Aurelia, guarded by robot doormen checking invitations"
          className="w-full h-auto block"
          draggable={false}
        />
      </div>
      <p className="marker-text text-[hsl(240,20%,80%)]" data-testid="text-aurelia-refused">
        A robot doorman checks his list, then checks it again. {message}
      </p>
      <OfficeLink />
    </main>
  );
}

export default function Aurelia() {
  const { data: locations, error, isLoading } = useQuery<AureliaLocation[]>({ queryKey: ["/api/aurelia"] });
  const [locationId, setLocationId] = useState<string | null>(null);
  const [open, setOpen] = useState<AureliaSpot | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [imgLoaded, setImgLoaded] = useState(false);

  const location = locations?.find((l) => l.id === locationId) ?? locations?.[0];
  const refused = error ? errorMessage(error) : null;

  return (
    <div className="min-h-screen pb-10 paper-texture" style={{ background: NIGHT }}>
      <div className="border-b-4 px-4 py-3" style={{ background: "hsl(245,45%,16%)", borderColor: GOLD }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <OfficeLink />
          <h1 className="pulp-title text-xl md:text-3xl tracking-[0.2em]" style={{ color: GOLD }}>Aurelia</h1>
          <span className="visitor-ticker text-xs" style={{ background: "hsl(245,40%,22%)" }}>✉ By invitation</span>
        </div>
      </div>

      {isLoading && <p className="text-center marker-text text-[hsl(240,20%,75%)] mt-10">Presenting your invitation…</p>}

      {refused && (
        <Gates
          message={
            refused.includes("list")
              ? `"I'm afraid your name isn't on the list." Hunters are invited once they've recovered ${AURELIA_INVITE_FRAGMENTS} pieces of Sterling's star map.`
              : `(${refused})`
          }
        />
      )}

      {location && (
        <main className="max-w-5xl mx-auto px-4 pt-6 space-y-4">
          <p className="text-center marker-text text-sm text-[hsl(240,20%,80%)]">
            The private planet of the solar system's finest. No contracts may be served inside these walls, so tonight, you're a guest.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {locations!.map((l) => (
              <button
                key={l.id}
                className={`retro-btn text-sm ${l.id === location.id ? "gold" : "teal"}`}
                aria-pressed={l.id === location.id}
                onClick={() => {
                  setLocationId(l.id);
                  setOpen(null);
                  setImgLoaded(false);
                }}
                data-testid={`button-aurelia-${l.id}`}
              >
                {l.name}
              </button>
            ))}
          </div>

          <div className="scene-container relative" data-testid={`scene-aurelia-${location.id}`}>
            <img
              key={location.image}
              src={location.image}
              alt={location.name}
              className="w-full h-auto block"
              onLoad={() => setImgLoaded(true)}
              draggable={false}
            />
            {imgLoaded && location.spots.map((spot) => (
              <button
                key={spot.id}
                className="hotspot"
                style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
                onClick={() => {
                  setOpen(spot);
                  setSeen((prev) => new Set(prev).add(`${location.id}/${spot.id}`));
                }}
                aria-label={`Look at ${spot.label}`}
                title={spot.label}
                data-testid={`hotspot-aurelia-${spot.id}`}
              >
                {!seen.has(`${location.id}/${spot.id}`) && (
                  <div className="hotspot-indicator" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} />
                )}
              </button>
            ))}
          </div>

          {open && (
            <div
              className="discovery-panel animate-slide-up"
              style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}
              data-testid="panel-aurelia-spot"
            >
              <div className="discovery-panel-header" style={{ background: "hsl(245,45%,22%)", color: GOLD }}>
                <span>✦ {open.label}</span>
              </div>
              <div className="discovery-panel-body text-[hsl(25,40%,20%)]">
                <p className="text-sm leading-relaxed">{open.text}</p>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
