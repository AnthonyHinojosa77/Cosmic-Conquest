import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { BackButton } from "@/components/BackButton";
import { HeroArt, preloadHeroPoses } from "@/components/HeroArt";
import { StarMap } from "@/components/StarMap";
import { useMusic } from "@/lib/sound";
import { SterlingBroadcast, hasHeardBroadcast, markBroadcastHeard } from "@/components/SterlingBroadcast";
import { usePlayer, useLeaderboard, useUpdatePlayer, useBuyItem, errorMessage } from "@/lib/game";
import { BOUNTIES, SHOP_ITEMS, SUITS, SUIT_IDS, ITEMS, ownsSuit, hunterRank, fragmentsFor, AURELIA_INVITE_FRAGMENTS } from "@shared/game";

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
  const changeSuit = useUpdatePlayer(); // separate state so errors show next to the right control
  const [callsign, setCallsign] = useState("");
  const ownedSuits = SUIT_IDS.filter((s) => ownsSuit(player?.owned ?? [], s));

  useEffect(() => {
    if (ownedSuits.length > 1) preloadHeroPoses(["standing"], ownedSuits);
  }, [ownedSuits.join()]);

  useEffect(() => {
    if (player) setCallsign(player.callsign);
  }, [player?.callsign]);

  if (!player) return <div className="comic-panel bg-[hsl(38,35%,88%)] p-6 h-full animate-pulse" />;

  const trimmed = callsign.trim();

  return (
    <section className="comic-panel bg-[hsl(38,35%,88%)] p-4 flex flex-col items-center" data-testid="panel-hero">
      <HeroArt pose="standing" suit={player.suit} className="w-36 h-auto drop-shadow-lg" />
      <RankBadge bounties={player.completedBounties.length} />
      {player.owned.includes("raygun") && (
        <p className="marker-text text-xs text-[hsl(0,72%,40%)] mt-1">★ Packing the Lucky Ray-Gun</p>
      )}

      {ownedSuits.length > 1 && (
        <div className="mt-3 flex items-center gap-2" role="group" aria-label="Suit" data-testid="picker-suit">
          <span className="pulp-title text-xs" style={{ color: INK }}>Suit:</span>
          {ownedSuits.map((s) => (
            <button
              key={s}
              aria-pressed={player.suit === s}
              aria-label={`${SUITS[s].name} suit`}
              title={SUITS[s].name}
              disabled={changeSuit.isPending}
              onClick={() => player.suit !== s && changeSuit.mutate({ suit: s })}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                background: SUITS[s].color,
                borderColor: SUITS[s].trim,
                boxShadow: player.suit === s ? `0 0 0 3px hsl(38,35%,88%), 0 0 0 5px ${INK}` : undefined,
              }}
              data-testid={`button-suit-${s}`}
            />
          ))}
        </div>
      )}
      {player.items.length > 0 && (
        <div className="w-full mt-3 border-t-2 border-dashed border-[hsl(30,20%,68%)] pt-2" data-testid="panel-satchel">
          <p className="pulp-title text-xs" style={{ color: INK }}>🎒 Satchel</p>
          <ul className="mt-1 space-y-1">
            {player.items.map((id) => (
              <li key={id} className="text-xs text-[hsl(25,30%,25%)]" title={ITEMS[id]?.description}>
                <span className="font-semibold">{ITEMS[id]?.name ?? id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {changeSuit.isError && (
        <p className="text-xs text-[hsl(0,65%,45%)] mt-2" role="alert">{errorMessage(changeSuit.error)}</p>
      )}

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

      {update.isError && (
        <p className="text-xs text-[hsl(0,65%,45%)] mt-2" role="alert">{errorMessage(update.error)}</p>
      )}
    </section>
  );
}

function RankBadge({ bounties }: { bounties: number }) {
  const rank = hunterRank(bounties);
  return (
    <div className="text-center mt-2" data-testid="text-rank">
      <p className="pulp-title text-base text-[hsl(0,72%,40%)] tracking-wider">★ {rank.title}</p>
      {rank.next && (
        <p className="text-[11px] text-[hsl(25,15%,42%)]">
          {rank.next.needed} more bount{rank.next.needed === 1 ? "y" : "ies"} to {rank.next.title}
        </p>
      )}
    </div>
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

// Aurelia, the private planet of the rich: invitation only.
function AureliaCard() {
  const { data: player } = usePlayer();
  const held = player ? fragmentsFor(player.completedBounties).length : 0;
  const invited = held >= AURELIA_INVITE_FRAGMENTS;
  const have = Math.min(held, AURELIA_INVITE_FRAGMENTS);
  return (
    <section data-testid="panel-aurelia">
      <h2 className="pulp-title text-2xl text-[hsl(45,80%,55%)] tracking-wider">Aurelia</h2>
      <div className="comic-panel mt-3 overflow-hidden" style={{ background: "hsl(245,45%,16%)" }}>
        <img
          src="./game/aurelia-gates.webp"
          alt="The golden Art Deco gates of Aurelia, guarded by robot doormen"
          className="w-full h-auto block"
          draggable={false}
        />
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[hsl(240,20%,85%)] flex-1 min-w-[14rem]">
            {!player
              ? "The private planet where Aurora Sterling's world lives in style."
              : invited
              ? "✉ An engraved invitation has arrived. The private planet of the solar system's finest is expecting you."
              : `The private planet where Aurora Sterling's world lives in style. Hunters are admitted by invitation only: recover ${AURELIA_INVITE_FRAGMENTS} pieces of her star map to earn yours (you hold ${have}).`}
          </p>
          {!player ? null : invited ? (
            <Link href="/aurelia">
              <button className="retro-btn gold" data-testid="button-enter-aurelia">✦ Enter Aurelia</button>
            </Link>
          ) : (
            <span className="pulp-title text-sm text-[hsl(45,80%,60%)]" data-testid="text-aurelia-locked">
              Invitation only · {have}/{AURELIA_INVITE_FRAGMENTS}
            </span>
          )}
        </div>
      </div>
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
            <div
              key={item.id}
              className="comic-panel bg-[hsl(38,35%,88%)] p-3 flex flex-col"
              style={{ opacity: item.comingSoon ? 0.6 : 1 }}
              data-testid={`card-shop-${item.id}`}
            >
              <div className="flex justify-between items-baseline gap-2">
                <h3 className="pulp-title text-base" style={{ color: INK }}>{item.name}</h3>
                <span className="pulp-title text-sm text-[hsl(0,72%,42%)] shrink-0">{item.price} CR</span>
              </div>
              <p className="text-xs text-[hsl(25,30%,30%)] mt-1 flex-1">{item.description}</p>
              <button
                className="retro-btn gold text-sm mt-2 self-start disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!player || item.comingSoon || owned || !affordable || buy.isPending}
                onClick={() => buy.mutate(item.id)}
                data-testid={`button-buy-${item.id}`}
              >
                {item.comingSoon ? "Coming soon" : owned ? "✓ Owned" : affordable ? "Buy" : "Need more credits"}
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
              <span>
                <span className="pulp-title mr-2">{i + 1}.</span>{e.callsign}
                <span className="text-[10px] uppercase tracking-wider text-[hsl(25,15%,42%)] ml-1">{hunterRank(e.bounties).title}</span>
              </span>
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
  useMusic("office");
  // New hunters hear Aurora Sterling's broadcast once; the desk radio replays it.
  const [broadcast, setBroadcast] = useState(() => !hasHeardBroadcast());
  const closeBroadcast = useCallback(() => {
    markBroadcastHeard();
    setBroadcast(false);
  }, []);
  return (
    <div className="min-h-screen bg-[hsl(25,30%,12%)] paper-texture pb-10">
      <div className="bg-[hsl(0,45%,18%)] border-b-4 border-[hsl(45,80%,48%)] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <BackButton />
          <h1 className="pulp-title text-xl md:text-2xl text-[hsl(45,80%,55%)] tracking-wider">Bounty Office</h1>
          <CreditsBadge credits={player?.credits ?? 0} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="scene-container" data-testid="scene-bounty-office">
          <img
            src="./game/bounty-office-no-hero.webp"
            alt="The Bounty Office on a Moon outpost: a cork board of wanted posters, a desk with a radio, and Saturn through the porthole"
            className="w-full h-auto block"
            draggable={false}
          />
          <button
            className="hotspot"
            style={{ top: "57%", left: "70%", width: "16%", height: "17%" }}
            onClick={() => setBroadcast(true)}
            aria-label="Play Aurora Sterling's broadcast on the radio"
            title="Aurora Sterling's broadcast"
            data-testid="hotspot-radio"
          >
            <span className="hotspot-indicator" style={{ bottom: "10%", left: "50%", transform: "translateX(-50%)" }} />
          </button>
        </div>
        <p className="marker-text text-xs text-center text-[hsl(38,25%,60%)] mt-2">
          📻 Tap the radio to hear Aurora Sterling's last broadcast
        </p>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-6 grid md:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-6">
          <HeroCard />
          <Leaderboard />
        </div>
        <div className="space-y-8">
          <BountyBoard />
          <StarMap />
          <AureliaCard />
          <Shop />
        </div>
      </main>

      {broadcast && <SterlingBroadcast onClose={closeBroadcast} />}
    </div>
  );
}
