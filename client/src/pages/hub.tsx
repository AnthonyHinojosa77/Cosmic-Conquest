import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PublicVisitor as Visitor } from "@shared/schema";

function VisitorTicker({ visitors }: { visitors: Visitor[] }) {
  const recent = useMemo(() => visitors.slice(0, 5), [visitors]);
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
        {v.visitorName} {v.action} {v.world}
      </span>
    </div>
  );
}

// The Hub is a pulp magazine cover — three clickable comic panels lead to each world
export default function Hub() {
  const [hoveredWorld, setHoveredWorld] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const { data: recentVisitors } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
    refetchInterval: 8000,
  });

  // World panel definitions — positioned over the magazine cover illustration
  const worlds = [
    {
      id: "voyages",
      path: "/voyages",
      title: "Cosmic Voyages",
      subtitle: "Interplanetary Tourism Bureau",
      // "Blast-off to the planets!" band of the magazine cover
      top: "19%", left: "3%", width: "94%", height: "20%",
    },
    {
      id: "expo",
      path: "/expo",
      title: "The Atomic Expo",
      subtitle: "World's Fair of Tomorrow",
      // "City of Tomorrow!" band
      top: "40%", left: "3%", width: "94%", height: "21%",
    },
    {
      id: "diner",
      path: "/diner",
      title: "Astro Diner",
      subtitle: "Orbital Dining & Refreshments",
      // "Robot waitress of Space Diner!" band
      top: "62%", left: "3%", width: "94%", height: "34%",
    },
  ];

  return (
    <div className="min-h-screen bg-[hsl(25,30%,12%)] flex flex-col items-center paper-texture">
      {/* Magazine masthead */}
      <header className="w-full text-center pt-6 pb-2 px-4 relative z-10">
        <div className="starburst-badge mx-auto mb-2" style={{ width: 48, height: 48, fontSize: "0.55rem" }}>
          EXPLORE<br/>3 WORLDS
        </div>
        <h1 className="pulp-title text-4xl md:text-6xl text-[hsl(45,80%,55%)] drop-shadow-lg tracking-wider">
          Cosmic Conquest
        </h1>
        <p className="marker-text text-[hsl(38,30%,75%)] text-sm md:text-base mt-1 tracking-wide">
          A Social Voyage Through Tomorrow's Past
        </p>
        <VisitorTicker visitors={recentVisitors ?? []} />
      </header>

      {/* Magazine cover illustration with clickable panels */}
      <main className="w-full max-w-4xl mx-auto px-4 pb-8 relative z-10">
        <div className="scene-container relative" data-testid="scene-hub-cover">
          <img
            ref={imgRef}
            src="./scenes/hub-cover.webp"
            alt="A pulp science fiction magazine cover with three illustrated panels"
            className="w-full h-auto block"
            onLoad={() => setImgLoaded(true)}
            draggable={false}
          />

          {/* Clickable world panels overlay */}
          {imgLoaded && worlds.map((world) => (
            <Link key={world.id} href={world.path}>
              <div
                className="hotspot"
                role="button"
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
                {/* Pulsing indicator dot */}
                <div
                  className="hotspot-indicator"
                  style={{ bottom: "10%", left: "50%", transform: "translateX(-50%)" }}
                />
              </div>
            </Link>
          ))}

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
                  Click to enter
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom navigation strip — fallback / mobile-friendly */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {worlds.map((world) => (
            <Link key={world.id} href={world.path}>
              <button
                className="retro-btn w-full text-center text-sm py-3"
                data-testid={`button-enter-${world.id}`}
              >
                {world.title}
              </button>
            </Link>
          ))}
        </div>

        {/* Bounty Hunter game entry */}
        <Link href="/bounties">
          <button
            className="retro-btn gold w-full mt-4 py-4 text-lg md:text-xl"
            data-testid="button-enter-bounties"
          >
            ★ Bounty Office — Take a job, hunter ★
          </button>
        </Link>

        {/* Footer tagline */}
        <p className="text-center text-[hsl(38,20%,45%)] text-xs tracking-widest uppercase mt-6 marker-text">
          ★ The future isn't what it used to be ★
        </p>
      </main>
    </div>
  );
}
