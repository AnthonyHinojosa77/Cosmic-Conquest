import { useState } from "react";
import { usePlayer, useStarMap } from "@/lib/game";
import { MAP_FRAGMENTS, STAR_MAP_SIZE, fragmentsFor, type MapFragment } from "@shared/game";

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
export const numeral = (n: number) => NUMERALS[n - 1] ?? String(n);

const NIGHT = "hsl(220,45%,13%)";

// Sterling's star map: the player's own fragments plus how far the whole community has got.
export function StarMap() {
  const { data: player } = usePlayer();
  const { data: status } = useStarMap();
  const [open, setOpen] = useState<MapFragment | null>(null);

  const mine = new Set(fragmentsFor(player?.completedBounties ?? []).map((f) => f.id));
  const hunters = new Map(status?.fragments.map((f) => [f.id, f.hunters]) ?? []);
  const byNumber = new Map(MAP_FRAGMENTS.map((f) => [f.number, f]));
  const total = status?.total ?? STAR_MAP_SIZE;
  const recovered = status?.fragments.filter((f) => f.hunters > 0).length ?? 0;
  const searchers = status?.searchers ?? 0;

  return (
    <section data-testid="panel-star-map">
      <h2 className="pulp-title text-2xl text-[hsl(45,80%,55%)] tracking-wider">Sterling's Star Map</h2>
      <p className="marker-text text-xs text-[hsl(38,30%,70%)] mt-1">
        Her fortune waits among the stars. Every bounty turns up a piece of the map.
      </p>

      <div
        className="comic-panel p-3 mt-3"
        style={{ background: NIGHT }}
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
            const fragment = byNumber.get(n);
            const held = fragment && mine.has(fragment.id);
            const count = fragment ? hunters.get(fragment.id) ?? 0 : 0;
            if (held) {
              return (
                <button
                  key={n}
                  onClick={() => setOpen(open?.id === fragment.id ? null : fragment)}
                  aria-pressed={open?.id === fragment.id}
                  className="rounded-md p-2 text-left min-h-[84px] border-2 border-[hsl(45,80%,55%)] bg-[hsl(45,70%,86%)] hover:bg-[hsl(45,80%,80%)] transition-colors"
                  data-testid={`fragment-${n}-held`}
                >
                  <span className="pulp-title text-lg text-[hsl(0,72%,40%)] block leading-none">★ {numeral(n)}</span>
                  <span className="pulp-title text-xs text-[hsl(25,40%,15%)] block mt-1 leading-tight">{fragment.name}</span>
                </button>
              );
            }
            return (
              <div
                key={n}
                className="rounded-md p-2 min-h-[84px] border-2 border-dashed border-[hsl(210,25%,38%)] flex flex-col justify-between"
                style={{ background: "hsla(220, 40%, 22%, 0.55)" }}
                data-testid={`fragment-${n}-${count > 0 ? "community" : "lost"}`}
              >
                <span className="pulp-title text-lg text-[hsl(210,25%,62%)] leading-none">{numeral(n)}</span>
                <span className="text-[10px] leading-tight text-[hsl(210,25%,70%)]">
                  {count > 0 ? `Recovered by ${count} hunter${count === 1 ? "" : "s"}` : "Lost among the stars"}
                </span>
              </div>
            );
          })}
        </div>

        {open && (
          <div className="mt-3 rounded-md bg-[hsl(38,35%,90%)] p-3 animate-fade-in" data-testid="text-fragment-caption">
            <p className="pulp-title text-base text-[hsl(0,72%,40%)]">Fragment {numeral(open.number)}: {open.name}</p>
            <p className="text-sm text-[hsl(25,30%,25%)] mt-1 leading-relaxed">{open.caption}</p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[hsl(38,30%,85%)]">
          <span data-testid="text-map-mine">
            <span className="pulp-title text-[hsl(45,80%,60%)]">You:</span> {mine.size} of {total} fragments
          </span>
          <span data-testid="text-map-community">
            <span className="pulp-title text-[hsl(45,80%,60%)]">All hunters:</span> {recovered} of {total} recovered
            {" · "}
            {searchers} hunter{searchers === 1 ? "" : "s"} on the trail
          </span>
        </div>
      </div>
    </section>
  );
}
