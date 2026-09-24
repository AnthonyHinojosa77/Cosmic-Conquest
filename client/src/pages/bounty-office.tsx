import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BackButton } from "@/components/BackButton";
import { SpaceCowboy } from "@/components/SpaceCowboy";
import { usePlayer, useLeaderboard, useUpdatePlayer, useBuyItem, errorMessage } from "@/lib/game";
import { BOUNTIES, SHOP_ITEMS, SUITS, ownsSuit, type SuitId } from "@shared/game";

const INK = "hsl(25,40%,15%)";

function CreditsBadge({ credits }: { credits: number }) {
  return (
    <div className="visitor-ticker text-base" data-testid="text-credits">
      <span aria-hidden>💰</span> {credits.toLocaleString()} credits
    </div>
  );
}

function HeroCard() {
  const { data: player } = usePlayer();
  const update = useUpdatePlayer();
  const [callsign, setCallsign] = useState("");

  useEffect(() => {
    if (player) setCallsign(player.callsign);
  }, [player?.callsign]);

  if (!player) return <div className="comic-panel bg-[hsl(38,35%,88%)] p-6 h-full animate-pulse" />;

  const trimmed = callsign.trim();

  return (
    <section className="comic-panel bg-[hsl(38,35%,88%)] p-4 flex flex-col items-center" data-testid="panel-hero">
      <SpaceCowboy
        suit={player.suit}
        bandana={player.owned.includes("bandana")}
        raygun={player.owned.includes("raygun")}
        className="w-40 h-auto animate-float"
      />

      <form
        className="w-full mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed && trimmed !== player.callsign) update.mutate({ callsign: trimmed });
        }}
      >
        <label className="sr-only" htmlFor="callsign">Callsign</label>
        <input
          id="callsign"
          value={callsign}
          maxLength={24}
          onChange={(e) => setCallsign(e.target.value)}
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(45,80%,48%)] focus:outline-none"
          data-testid="input-callsign"
        />
        <button
          type="submit"
          className="retro-btn text-sm"
          disabled={!trimmed || trimmed === player.callsign || update.isPending}
          data-testid="button-save-callsign"
        >
          Save
        </button>
      </form>

      <div className="w-full mt-3">
        <h3 className="pulp-title text-sm tracking-wider" style={{ color: INK }}>Suit</h3>
        <div className="flex gap-2 mt-1">
          {(Object.keys(SUITS) as SuitId[]).map((id) => {
            const owned = ownsSuit(player.owned, id);
            const worn = player.suit === id;
            return (
              <button
                key={id}
                type="button"
                title={owned ? SUITS[id].name : `${SUITS[id].name} — buy it in the shop`}
                aria-label={`${SUITS[id].name}${worn ? " (wearing)" : owned ? "" : " (locked)"}`}
                aria-pressed={worn}
                disabled={!owned || worn || update.isPending}
                onClick={() => update.mutate({ suit: id })}
                className="w-9 h-9 rounded-full border-4 relative disabled:cursor-default"
                style={{
                  background: SUITS[id].color,
                  borderColor: worn ? "hsl(45,80%,52%)" : INK,
                  opacity: owned ? 1 : 0.35,
                }}
                data-testid={`button-suit-${id}`}
              >
                {!owned && <span className="absolute inset-0 flex items-center justify-center text-xs">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>
      {update.isError && (
        <p className="text-xs text-[hsl(0,65%,45%)] mt-2" role="alert">{errorMessage(update.error)}</p>
      )}
    </section>
  );
}

function BountyBoard() {
  const { data: player } = usePlayer();
  return (
    <section className="space-y-3" data-testid="panel-bounty-board">
      <h2 className="pulp-title text-2xl text-[hsl(45,80%,55%)] tracking-wider">Wanted</h2>
      {BOUNTIES.map((b) => {
        const done = player?.completedBounties.includes(b.id);
        return (
          <div
            key={b.id}
            className="comic-panel bg-[hsl(38,35%,88%)] p-4 flex gap-4 items-start"
            style={{ opacity: b.available ? 1 : 0.6 }}
            data-testid={`card-bounty-${b.id}`}
          >
            <div className="starburst-badge shrink-0" style={{ width: 64, height: 64, fontSize: "0.7rem" }}>
              {b.reward}<br />CR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-[hsl(25,15%,42%)]">{b.planet}</p>
              <h3 className="pulp-title text-lg" style={{ color: INK }}>{b.title}</h3>
              <p className="text-sm text-[hsl(25,30%,25%)] mt-1">{b.teaser}</p>
              <div className="mt-3">
                {!b.available ? (
                  <span className="marker-text text-xs text-[hsl(25,15%,42%)]">Coming soon</span>
                ) : (
                  <Link href={`/bounty/${b.id}`}>
                    <button className={`retro-btn text-sm ${done ? "teal" : ""}`} data-testid={`button-take-${b.id}`}>
                      {done ? "✓ Collected — replay" : "Take the job"}
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Shop() {
  const { data: player } = usePlayer();
  const buy = useBuyItem();
  return (
    <section data-testid="panel-shop">
      <h2 className="pulp-title text-2xl text-[hsl(45,80%,55%)] tracking-wider">Outfitters</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {SHOP_ITEMS.map((item) => {
          const owned = player?.owned.includes(item.id) ?? false;
          const affordable = (player?.credits ?? 0) >= item.price;
          return (
            <div key={item.id} className="comic-panel bg-[hsl(38,35%,88%)] p-3 flex flex-col" data-testid={`card-shop-${item.id}`}>
              <div className="flex justify-between items-baseline gap-2">
                <h3 className="pulp-title text-base" style={{ color: INK }}>{item.name}</h3>
                <span className="pulp-title text-sm text-[hsl(0,72%,42%)] shrink-0">{item.price} CR</span>
              </div>
              <p className="text-xs text-[hsl(25,30%,30%)] mt-1 flex-1">{item.description}</p>
              <button
                className="retro-btn gold text-sm mt-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!player || owned || !affordable || buy.isPending}
                onClick={() => buy.mutate(item.id)}
                data-testid={`button-buy-${item.id}`}
              >
                {owned ? "✓ Owned" : affordable ? "Buy" : "Need more credits"}
              </button>
            </div>
          );
        })}
      </div>
      {buy.isError && <p className="text-sm text-[hsl(0,65%,60%)] mt-2" role="alert">{errorMessage(buy.error)}</p>}
    </section>
  );
}

function Leaderboard() {
  const { data: board = [] } = useLeaderboard();
  return (
    <section className="comic-panel bg-[hsl(38,35%,88%)] p-4" data-testid="panel-leaderboard">
      <h2 className="pulp-title text-xl tracking-wider" style={{ color: INK }}>Top Hunters</h2>
      {board.length === 0 ? (
        <p className="text-sm text-[hsl(25,15%,42%)] mt-2 marker-text">No bounties collected yet. Be the first!</p>
      ) : (
        <ol className="mt-2 space-y-1">
          {board.map((e, i) => (
            <li key={`${e.callsign}-${i}`} className="flex justify-between text-sm" style={{ color: INK }}>
              <span><span className="pulp-title mr-2">{i + 1}.</span>{e.callsign}</span>
              <span className="pulp-title">{e.earned.toLocaleString()} CR</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function BountyOffice() {
  const { data: player } = usePlayer();
  return (
    <div className="min-h-screen bg-[hsl(25,30%,12%)] paper-texture pb-10">
      <div className="bg-[hsl(0,45%,18%)] border-b-4 border-[hsl(45,80%,48%)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <BackButton />
          <h1 className="pulp-title text-xl md:text-2xl text-[hsl(45,80%,55%)] tracking-wider">Bounty Office</h1>
          <CreditsBadge credits={player?.credits ?? 0} />
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-6 grid md:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-6">
          <HeroCard />
          <Leaderboard />
        </div>
        <div className="space-y-8">
          <BountyBoard />
          <Shop />
        </div>
      </main>
    </div>
  );
}
