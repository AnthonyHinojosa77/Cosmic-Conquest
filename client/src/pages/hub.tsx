import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PublicVisitor as Visitor } from "@shared/schema";
import { useMusic } from "@/lib/sound";
import { useTapWord } from "@/lib/device";
import { Scene } from "@/components/Scene";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { usePlayer } from "@/lib/game";
import { BOUNTIES, chartLine, fragmentsFor, hunterRank, hubBadgeState, tickerLines, type WireEntry } from "@shared/game";

// The Bounty Office entrance, with the hunter's standing once they've started playing.
function HunterDispatch() {
  const { data: player } = usePlayer();
  const playing = !!player && (player.startedBounties.length > 0 || player.owned.length > 0);
  return (
    <div className="comic-panel bg-[hsl(0,45%,18%)] border-[hsl(45,80%,48%)] p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="panel-hunter-dispatch">
      <p className="flex-1 min-w-0 text-sm text-[hsl(38,30%,85%)]" data-testid="text-hunter-status">
        {playing ? (
          <>
            <span className="pulp-title text-[hsl(45,80%,60%)]">{player.callsign}</span>
            {" · "}{hunterRank(player.completedBounties.length).title}
            {" · "}💰 {player.credits.toLocaleString()} CR
            {" · "}★ {chartLine(fragmentsFor(player.completedBounties).length)}
          </>
        ) : (
          <span className="marker-text">Aurora Sterling's fortune is out there among the stars. The Bounty Office is hiring.</span>
        )}
      </p>
      <Link href="/bounties" className="retro-btn gold w-full sm:w-auto py-3 text-base md:text-lg text-center" data-testid="button-enter-bounties">
        ★ Bounty Office — Take a job, hunter ★
      </Link>
    </div>
  );
}

// Arrivals in the worlds and case closures from the Guild Wire, in one ticker.
function VisitorTicker({ visitors, wire }: { visitors: Visitor[]; wire: WireEntry[] }) {
  const recent = useMemo(
    () => tickerLines(wire, visitors.slice(0, 5).map((v) => `${v.visitorName} ${v.action} ${v.world}`)),
    [visitors, wire],
  );
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (recent.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(prev => (prev + 1) % recent.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(timer);
  }, [recent.length]);

  if (recent.length === 0) {
    return (
      <div className="visitor-ticker mx-auto mt-3" data-testid="text-visitor-ticker">
        <span className="inline-block w-2 h-2 rounded-full bg-[hsl(38,20%,45%)]" />
        No visitors yet — be the first explorer!
      </div>
    );
  }

  const v = recent[index % recent.length];
  return (
    <div className="visitor-ticker mx-auto mt-3" data-testid="text-visitor-ticker">
      <span className="inline-block w-2 h-2 rounded-full bg-[hsl(120,60%,50%)] animate-pulse" />
      <span
        style={{
          transition: "opacity 0.4s ease",
          opacity: visible ? 1 : 0,
        }}
      >
        {v}
      </span>
    </div>
  );
}

// The Hub is a pulp magazine cover — three clickable comic panels lead to each world
export default function Hub() {
  useMusic("hub");
  const tap = useTapWord();
  const { data: player, isError: profileError, refetch: refetchProfile } = usePlayer();
  const [hoveredWorld, setHoveredWorld] = useState<string | null>(null);
  const badge = hubBadgeState(player ?? null, profileError, BOUNTIES);

  const { data: recentVisitors, isError: visitorsError, refetch: refetchVisitors } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
    refetchInterval: 8000,
  });
  // A failed wire just leaves the arrivals; it is decoration, not a blocker.
  const { data: wire } = useQuery<WireEntry[]>({ queryKey: ["/api/wire"], refetchInterval: 30000 });

  // World panel definitions — positioned over the magazine cover illustration
  const worlds = [
    {
      id: "voyages",
      path: "/voyages",
      title: "Cosmic Voyages",
      subtitle: "Posters for the open contracts",
      // "Blast-off to the planets!" band of the magazine cover
      top: "19%", left: "3%", width: "94%", height: "20%",
    },
    {
      id: "expo",
      path: "/expo",
      title: "The Atomic Expo",
      subtitle: "The Heart of Luna was stolen here",
      // "City of Tomorrow!" band
      top: "40%", left: "3%", width: "94%", height: "21%",
    },
    {
      id: "diner",
      path: "/diner",
      title: "Astro Diner",
      subtitle: "Cookie's diner, on the Luna job",
      // "Robot waitress of Space Diner!" band
      top: "62%", left: "3%", width: "94%", height: "34%",
    },
  ];

  return (
    <div className="game-page flex flex-col items-center">
      <SceneBackdrop src="./scenes/hub-cover.webp" />
      {/* Magazine masthead */}
      <header className="w-full text-center pb-2 px-4 relative z-10" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))" }}>
        {badge.kind === "error" ? (
          <button
            type="button"
            className="starburst-badge mx-auto mb-2"
            style={{ width: 48, height: 48, fontSize: "0.42rem" }}
            onClick={() => refetchProfile()}
            aria-label="Hunter profile did not load. Try again"
            data-testid="button-retry-jobs"
          >
            ?<br/>RETRY
          </button>
        ) : (
          <div
            className="starburst-badge mx-auto mb-2"
            style={{ width: 48, height: 48, fontSize: badge.kind === "ready" && badge.figure === "REPLAY" ? "0.42rem" : "0.55rem" }}
            data-testid="text-jobs-badge"
          >
            {badge.kind === "loading" ? <>…<br/>JOBS</> : <>{badge.figure}<br/>{badge.caption}</>}
          </div>
        )}
        <h1 className="pulp-title text-4xl md:text-6xl text-[hsl(45,80%,55%)] drop-shadow-lg tracking-wider">
          Cosmic Conquest
        </h1>
        <p className="marker-text text-[hsl(38,30%,75%)] text-sm md:text-base mt-1 tracking-wide">
          Take a bounty. Name the culprit. Draw.
        </p>
        {!(visitorsError && !recentVisitors && !wire?.length) && <VisitorTicker visitors={recentVisitors ?? []} wire={wire ?? []} />}
        {visitorsError && !recentVisitors && (
          <p className="text-xs text-[hsl(0,65%,65%)] mt-2" role="alert" data-testid="text-feed-error">
            Couldn't load the arrivals. <button className="underline" onClick={() => refetchVisitors()}>Try again</button>
          </p>
        )}
      </header>

      {/* Magazine cover illustration with clickable panels */}
      <main className="w-full max-w-4xl mx-auto px-4 pb-8 relative z-10">
        <HunterDispatch />
        <div className="bleed rise-in relative">
          <Scene src="./scenes/hub-cover.webp" alt="A pulp science fiction magazine cover with three illustrated panels" testId="scene-hub-cover" fit maxHeight={Math.max(560, window.innerHeight - 170)}>

          {/* Clickable world panels overlay */}
          {worlds.map((world) => (
            <Link
              key={world.id}
              href={world.path}
              className="hotspot"
              aria-label={`Enter ${world.title} — ${world.subtitle}`}
              title={world.title}
              style={{
                top: world.top,
                left: world.left,
                width: world.width,
                height: world.height,
              }}
              onMouseEnter={() => setHoveredWorld(world.id)}
              onMouseLeave={() => setHoveredWorld(null)}
              data-testid={`hotspot-world-${world.id}`}
            >
              <div className="hotspot-indicator" style={{ top: "82%", left: "50%" }} />
            </Link>
          ))}
          </Scene>

          {/* Hover tooltip */}
          {hoveredWorld && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-slide-up"
            >
              <div className="bg-[hsl(25,40%,14%)] border-2 border-[hsl(45,80%,55%)] rounded-lg px-5 py-2 shadow-xl">
                <span className="pulp-title text-[hsl(45,80%,55%)] text-lg tracking-wider">
                  {worlds.find(w => w.id === hoveredWorld)?.title}
                </span>
                <span className="block text-[hsl(38,25%,65%)] text-xs mt-0.5">
                  {worlds.find(w => w.id === hoveredWorld)?.subtitle}
                </span>
                <span className="block text-[hsl(38,25%,65%)] text-xs">
                  {tap} to enter
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom navigation strip — fallback / mobile-friendly */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {worlds.map((world) => (
            <Link
              key={world.id}
              href={world.path}
              className="retro-btn w-full text-center text-sm py-3"
              data-testid={`button-enter-${world.id}`}
            >
              {world.title}
            </Link>
          ))}
        </div>

        {/* Footer tagline */}
        <p className="text-center text-[hsl(38,20%,45%)] text-xs tracking-widest uppercase mt-6 marker-text">
          ★ The future isn't what it used to be ★
        </p>
      </main>
    </div>
  );
}
