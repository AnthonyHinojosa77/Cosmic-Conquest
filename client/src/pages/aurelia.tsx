import { useCallback, useState } from "react";
import { OfficeLink } from "@/components/OfficeLink";
import { Scene } from "@/components/Scene";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { Sheet } from "@/components/Sheet";
import { prefetchArt } from "@/lib/art";
import { useAurelia, errorMessage, AURELIA_KEY } from "@/lib/game";
import { useMusic, useVoice } from "@/lib/sound";
import { queryClient } from "@/lib/queryClient";
import { AURELIA_INVITE_FRAGMENTS, type AureliaSpot } from "@shared/game";

// Aurelia's own look: indigo night, silver and gold (Art Deco), on the same paper.
const NIGHT = "hsl(240,40%,10%)";
const GOLD = "hsl(45,80%,58%)";


// "403: {...}" -> the fragments the hunter holds, if the server turned them away
function refusal(err: unknown): { have: number; needed: number } | null {
  const raw = err instanceof Error ? err.message : "";
  if (!raw.startsWith("403")) return null;
  try {
    const body = JSON.parse(raw.replace(/^\d+:\s*/, ""));
    return { have: body.have ?? 0, needed: body.needed ?? AURELIA_INVITE_FRAGMENTS };
  } catch {
    return { have: 0, needed: AURELIA_INVITE_FRAGMENTS };
  }
}

// Uninvited hunters only get as far as the gates.
function Gates({ message }: { message: string }) {
  return (
    <main className="max-w-4xl mx-auto px-4 game-main space-y-4 text-center">
      <div className="bleed rise-in">
        <Scene
          src="./game/aurelia-gates.webp"
          alt="The golden Art Deco gates of Aurelia, guarded by robot doormen checking invitations"
          testId="scene-aurelia-gates"
          maxHeight={460}
        />
      </div>
      <p className="marker-text text-[hsl(240,20%,80%)]" data-testid="text-aurelia-refused">
        A robot doorman checks his list, then checks it again. {message}
      </p>
      <OfficeLink className="text-[hsl(240,20%,75%)] hover:text-[hsl(45,80%,60%)]" />
    </main>
  );
}

export default function Aurelia() {
  const { data: locations, error, isLoading } = useAurelia();
  const [locationId, setLocationId] = useState<string | null>(null);
  const [open, setOpen] = useState<AureliaSpot | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const location = locations?.find((l) => l.id === locationId) ?? locations?.[0];
  useMusic("aurelia");
  useVoice(open && location ? `aurelia/${location.id}/${open.id}` : null);
  const refused = !locations && error ? refusal(error) : null;
  const failed = !locations && error && !refused ? errorMessage(error) : null;
  const closeSpot = useCallback(() => setOpen(null), []);

  return (
    <div className="game-page" style={{ background: NIGHT }}>
      <SceneBackdrop src={refused ? "./game/aurelia-gates.webp" : location?.image} tint="hsl(245 45% 6% / 0.5)" />
      <header className="game-header" style={{ background: "hsl(245 45% 14% / 0.75)", borderColor: GOLD }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <OfficeLink className="text-[hsl(240,20%,75%)] hover:text-[hsl(45,80%,60%)]" />
          <h1 className="pulp-title text-xl md:text-3xl tracking-[0.2em]" style={{ color: GOLD }}>Aurelia</h1>
          <span className="visitor-ticker text-xs" style={{ background: "hsl(245,40%,22%)" }}>✉ By invitation</span>
        </div>
      </header>

      {isLoading && <p className="text-center marker-text text-[hsl(240,20%,75%)] mt-10">Presenting your invitation…</p>}

      {refused && (
        <Gates
          message={`"I'm afraid your name isn't on the list." Hunters are invited once they've recovered ${refused.needed} pieces of Sterling's star map (you hold ${refused.have}).`}
        />
      )}

      {failed && (
        <div className="text-center mt-10 space-y-3" role="alert">
          <p className="marker-text text-[hsl(240,20%,80%)]">The line to Aurelia is crackling: {failed}</p>
          <button className="retro-btn gold text-sm" onClick={() => queryClient.invalidateQueries({ queryKey: AURELIA_KEY })}>
            Try again
          </button>
        </div>
      )}

      {location && (
        <main className="max-w-5xl mx-auto px-4 game-main space-y-4">
          <div className="bleed relative">
          <div className="scene-tabs" role="group" aria-label="Places in Aurelia">
            {locations!.map((l) => (
              <button
                key={l.id}
                className={`scene-tab ${l.id === location.id ? "is-current" : ""}`}
                aria-pressed={l.id === location.id}
                onClick={() => {
                  if (l.id === location.id) return;
                  setLocationId(l.id);
                  setOpen(null);
                }}
                data-testid={`button-aurelia-${l.id}`}
              >
                {l.name}
              </button>
            ))}
          </div>
            <Scene
              src={location.image}
              alt={location.name}
              testId={`scene-aurelia-${location.id}`}
              reserve={180}
              onReveal={() => prefetchArt(locations!.map((l) => l.image))}
            >
              {location.spots.map((spot) => {
                const unseen = !seen.has(`${location.id}/${spot.id}`);
                return (
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
                    data-unfound={unseen}
                    data-testid={`hotspot-aurelia-${spot.id}`}
                  >
                    {unseen && <span className="hotspot-indicator" style={{ top: "50%", left: "50%" }} />}
                  </button>
                );
              })}
            </Scene>
          </div>
          <p className="text-center marker-text text-sm text-[hsl(240,20%,80%)]">
            The private planet of the solar system's finest. No contracts may be served inside these walls, so tonight, you're a guest.
          </p>

          {open && (
            <Sheet
              title={`✦ ${open.label}`}
              onClose={closeSpot}
              tone="hsl(245 45% 22%)"
              titleColor={GOLD}
              testId="panel-aurelia-spot"
            >
              <p className="text-sm leading-relaxed animate-fade-in">{open.text}</p>
            </Sheet>
          )}
        </main>
      )}
    </div>
  );
}
