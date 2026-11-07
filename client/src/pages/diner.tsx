import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
import { getVotedIds, rememberVote } from "@/lib/visitor";
import { errorMessage, useCallsignName } from "@/lib/game";
import { keepDraft, showEmptyError, trackVote } from "@/lib/votes";
import { useDiscovered, useRestoreFocus } from "@/lib/discovered";
import type { MenuItem } from "@shared/schema";
import { ContractLink } from "@/components/ContractLink";
import { HotspotHint } from "@/components/HotspotHint";
import { Scene } from "@/components/Scene";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { useMusic } from "@/lib/sound";

// Hotspot definitions — positioned over the diner illustration
const hotspots = [
  {
    id: "jukebox",
    label: "Atomic Jukebox",
    description: "The Wurlitzer Galaxia stands seven feet tall, its vacuum tubes pulsing amber and violet with every downbeat. It plays hits beamed in from relay stations across the solar system — Martian blues, Venusian swing, the haunting theremin ballads of the outer rim. Drop in a credit and feel the bass rattle the chrome trim on every booth in the joint.",
    top: "36%", left: "3%", width: "14%", height: "32%",
    indicatorPos: { top: "40%", left: "50%" },
  },
  {
    id: "menu-board",
    label: "Today's Specials",
    description: "Hand-lettered every morning by the robot chef in crisp white paint on a slab of polished asteroid. The Nebula Noodle Soup glows a faint cerulean — perfectly safe, they assure you. The daily specials rotate with the station's orbit, so what's fresh depends on which cargo freighter docked last.",
    top: "4%", left: "24%", width: "36%", height: "32%",
    indicatorPos: { top: "50%", left: "50%" },
    showsMenu: true,
  },
  {
    id: "robot-waiter",
    label: "Servo the Robot Waiter",
    description: "Model T-800 hospitality unit, polished to a mirror finish and programmed with the manners of a Lunar Grand Hotel concierge. Servo glides between booths on magnetic rails, balancing six plates on each articulated arm without spilling a drop. Tips aren't required, but leave one and his optical sensors flash a grateful pink.",
    top: "22%", left: "62%", width: "34%", height: "50%",
    indicatorPos: { top: "30%", left: "50%" },
  },
  {
    id: "counter",
    label: "Chrome Counter",
    description: "The counter curves like a rocket's aileron, its chrome surface polished to a mirror finish by Servo's tireless buffing arm every night after closing. Twelve swiveling stools in cherry-red vinyl line the bar, each one worn smooth by a generation of spacers, engineers, and dreamers. Pull up a seat and invent something for the menu — the Diner runs on community spirit and cosmic creativity.",
    top: "74%", left: "20%", width: "40%", height: "20%",
    indicatorPos: { top: "40%", left: "50%" },
    showsForm: true,
  },
  {
    id: "window",
    label: "Observation Window",
    description: "Through the reinforced viewport, Earth hangs close and blue, the clouds sliding over the oceans. Regulars say the view is worth the trip alone. Sip your Lunar Lemonade and watch home put on a show.",
    top: "42%", left: "28%", width: "30%", height: "16%",
    indicatorPos: { top: "50%", left: "50%" },
  },
];

const houseMenu = [
  { name: "Nebula Noodle Soup", price: "3 Credits", desc: "Swirling broth infused with cosmic dust. Glows faintly." },
  { name: "Saturn Ring Onion Rings", price: "2 Credits", desc: "Deep-fried in zero-gravity oil. Perfectly circular." },
  { name: "Meteor Meatloaf", price: "4 Credits", desc: "Dense, savory, impacts your plate with authority." },
  { name: "Lunar Lemonade", price: "1 Credit", desc: "Carbonated citrus from the Moon's hydroponic gardens." },
  { name: "Plutonium Pudding", price: "3 Credits", desc: "Glows green. Tastes like butterscotch. Totally safe." },
  { name: "Galactic Grilled Cheese", price: "2 Credits", desc: "Cheese from six planets. Melted perfectly." },
];



export default function Diner() {
  useMusic("hub");
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [discoveredItems, markDiscovered] = useDiscovered("diner");

  // Form state for community dish
  const { name, setName, resetName } = useCallsignName("Astro Diner");
  const [dishName, setDishName] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: communityItems = [], isError: menuError, refetch: refetchMenu } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    refetchInterval: 5000,
  });

  const draft = useRef({ name, dishName, description });
  draft.current = { name, dishName, description };
  const submitDish = useMutation({
    mutationFn: async () => {
      const sent = { name, dishName, description };
      const res = await apiRequest("POST", "/api/menu-items", {
        visitorName: sent.name,
        dishName: sent.dishName,
        description: sent.description,
      });
      await res.json();
      return sent;
    },
    onSuccess: (sent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      setDishName((now) => keepDraft(sent.dishName, now));
      setDescription((now) => keepDraft(sent.description, now));
      if (draft.current.name === sent.name) resetName();
      setShowSuccess(true);
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const [votedIds, setVotedIds] = useState(() => getVotedIds("menuItem"));
  const [pendingVotes, setPendingVotes] = useState<Set<number>>(() => new Set());
  const [voteErrors, setVoteErrors] = useState<Record<number, string>>({});
  const markVoted = (id: number) => {
    rememberVote("menuItem", id);
    setVotedIds(prev => new Set(prev).add(id));
  };

  const voteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/menu-items/${id}/vote`);
      return res.json();
    },
    onMutate: (id) => {
      setPendingVotes((current) => trackVote(current, id, true));
      setVoteErrors((current) => {
        if (!(id in current)) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
    },
    onSuccess: (_data, id) => {
      markVoted(id);
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
    },
    onError: (err, id) => {
      // 409 = the server already has this visitor's vote
      if (err instanceof Error && err.message.startsWith("409")) {
        markVoted(id);
        return;
      }
      setVoteErrors((current) => ({ ...current, [id]: `${errorMessage(err)} Try again.` }));
    },
    onSettled: (_data, _err, id) => {
      setPendingVotes((current) => trackVote(current, id, false));
    },
  });

  const handleHotspotClick = useCallback((id: string) => {
    markDiscovered(id);
    setActiveHotspot(prev => prev === id ? null : id);
  }, [markDiscovered]);

  const closePanel = useRestoreFocus(activeHotspot, setActiveHotspot);

  const activeData = hotspots.find(h => h.id === activeHotspot);

  return (
    <div className="game-page">
      <SceneBackdrop src="./scenes/diner-scene.webp" />
      {/* Scene header */}
      <header className="game-header bg-[hsl(350,30%,14%)]/80 border-[hsl(45,80%,45%)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <BackButton />
          <h1 className="pulp-title text-xl md:text-2xl text-[hsl(45,80%,55%)] tracking-wider">
            Astro Diner
          </h1>
          <div className="visitor-ticker text-xs" style={{ fontSize: "0.85rem" }}>
            <span className="hidden md:inline">Discovered:</span>{" "}
            <span className="pulp-title text-base" style={{ color: discoveredItems.size === hotspots.length ? "hsl(120, 60%, 55%)" : "hsl(45, 80%, 55%)" }}>
              {discoveredItems.size}/{hotspots.length}
            </span>
          </div>
        </div>
      </header>
      {/* Scene illustration with hotspot overlays */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bleed rise-in">
          <Scene src="./scenes/diner-scene.webp" alt="Inside the Astro Diner — chrome counter, robot waiter, jukebox, observation window" testId="scene-diner" reserve={200}>
            {hotspots.map((hs) => (
            <button
              key={hs.id}
              className={`hotspot ${discoveredItems.has(hs.id) ? "border-[hsl(120,50%,45%)]/40" : ""} ${activeHotspot === hs.id ? "bg-[hsl(45,80%,55%)]/20 border-[hsl(45,80%,55%)]" : ""}`}
              style={{
                top: hs.top, left: hs.left,
                width: hs.width, height: hs.height,
              }}
              onClick={() => handleHotspotClick(hs.id)}
              aria-label={`Explore ${hs.label}`}
              title={hs.label}
              data-unfound={!discoveredItems.has(hs.id)}
              data-testid={`hotspot-${hs.id}`}
            >
              {!discoveredItems.has(hs.id) && (
                <div
                  className="hotspot-indicator"
                  style={{ top: hs.indicatorPos.top, left: hs.indicatorPos.left, transform: "translate(-50%, -50%)" }}
                />
              )}
            </button>
          ))}
          </Scene>
        </div>

        {/* Hotspot hint text */}
        {!activeHotspot && (
          <p className="text-center text-[hsl(38,20%,50%)] text-xs mt-3 marker-text animate-fade-in">
            <HotspotHint place="diner" />
          </p>
        )}
      </div>

      {/* Discovery panel — opens when a hotspot is clicked */}
      {activeData && (
        <div className="max-w-5xl mx-auto px-4 mt-4 pb-8 animate-slide-up">
          <div className="discovery-panel relative mx-auto" style={{ position: "relative", maxWidth: 600 }}>
            <div className="discovery-panel-header">
              <span>{activeData.label}</span>
              <button
                onClick={closePanel}
                className="panel-close text-[hsl(40,40%,95%)] hover:text-white text-lg leading-none"
                aria-label="Close"
                data-testid="button-close-panel"
              >
                ✕
              </button>
            </div>
            <div className="discovery-panel-body">
              <p className="text-sm text-[hsl(25,40%,20%)] leading-relaxed mb-4">
                {activeData.description}
              </p>
              {(activeData.id === "jukebox" || activeData.id === "counter" || activeData.id === "robot-waiter") && (
                <ContractLink bountyId="heart-of-luna" />
              )}

              {/* Menu Board hotspot reveals the house menu */}
              {activeData.showsMenu && (
                <div className="space-y-2">
                  <h3 className="pulp-title text-sm text-[hsl(0,72%,48%)] tracking-wider">House Specials</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {houseMenu.map(item => (
                      <div key={item.name} className="comic-panel p-3 bg-[hsl(38,35%,88%)]">
                        <div className="flex justify-between items-start gap-1 mb-1">
                          <span className="pulp-title text-xs text-[hsl(25,40%,15%)]">{item.name}</span>
                        </div>
                        <span className="text-xs font-bold text-[hsl(195,65%,38%)]">{item.price}</span>
                        <p className="text-xs text-[hsl(25,20%,40%)] mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Counter hotspot reveals the dish creation form */}
              {activeData.showsForm && (
                <div className="space-y-3">
                  <h3 className="pulp-title text-sm text-[hsl(0,72%,48%)] tracking-wider">Invent a Dish</h3>
                  <p className="text-xs text-[hsl(25,15%,42%)]">Dream up a space-age creation for the community menu.</p>
                  <input
                    placeholder="Your name (Chef, Space Cook...)"
                    value={name}
                    maxLength={50}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitDish.isPending}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(0,72%,48%)] focus:outline-none"
                    data-testid="input-dish-chef"
                  />
                  <input
                    placeholder="Dish name (e.g., Supernova Spaghetti)"
                    value={dishName}
                    maxLength={100}
                    onChange={(e) => setDishName(e.target.value)}
                    disabled={submitDish.isPending}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(0,72%,48%)] focus:outline-none"
                    data-testid="input-dish-name"
                  />
                  <textarea
                    placeholder="Describe your creation..."
                    value={description}
                    maxLength={500}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={submitDish.isPending}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(0,72%,48%)] focus:outline-none resize-none"
                    data-testid="input-dish-desc"
                  />
                  <button
                    onClick={() => submitDish.mutate()}
                    disabled={!name.trim() || !dishName.trim() || !description.trim() || submitDish.isPending}
                    className="retro-btn text-sm"
                    data-testid="button-submit-dish"
                  >
                    {submitDish.isPending ? "Adding..." : "★ Add to Menu"}
                  </button>
                  {submitDish.isError && (
                    <p className="text-xs text-[hsl(0,65%,40%)]" role="alert">{errorMessage(submitDish.error)} Try again.</p>
                  )}

                  {showSuccess && (
                    <div className="text-center py-2 animate-fade-in">
                      <span className="pulp-title text-[hsl(45,80%,48%)] text-lg tracking-wider drop-shadow-sm">
                        TRANSMISSION RECEIVED!
                      </span>
                    </div>
                  )}

                  {/* Community dishes */}
                  {showEmptyError(menuError, communityItems.length) && (
                    <p className="text-xs text-[hsl(0,65%,40%)]" role="alert" data-testid="text-feed-error">
                      Couldn't load these. <button className="underline" onClick={() => refetchMenu()}>Try again</button>
                    </p>
                  )}
                  {communityItems.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="pulp-title text-xs text-[hsl(195,65%,38%)] tracking-wider">
                        Community Menu ({communityItems.length})
                      </h4>
                      {communityItems.map(item => (
                        <div key={item.id} className="comic-panel p-3 bg-[hsl(38,35%,88%)] flex items-start gap-3" data-testid={`card-menu-${item.id}`}>
                          <button
                            onClick={() => voteMutation.mutate(item.id)}
                            disabled={votedIds.has(item.id) || pendingVotes.has(item.id)}
                            className="flex flex-col items-center justify-center gap-0.5 shrink-0 mt-0.5 hover:scale-110 transition-transform min-h-11 min-w-11"
                            aria-label={`Vote for ${item.visitorName}'s dish`}
                            data-testid={`button-vote-dish-${item.id}`}
                          >
                            <span className="text-lg">👍</span>
                            <span className="text-xs font-bold text-[hsl(25,40%,15%)]">{item.votes}</span>
                          </button>
                          <div>
                            <span className="pulp-title text-xs text-[hsl(25,40%,15%)]">{item.dishName}</span>
                            <p className="text-xs text-[hsl(25,20%,40%)] mt-0.5">{item.description}</p>
                            <p className="text-xs text-[hsl(25,15%,55%)] mt-1">— Chef {item.visitorName}</p>
                            {voteErrors[item.id] && (
                              <p className="text-xs text-[hsl(0,65%,40%)] mt-1" role="alert" data-testid="text-vote-error">{voteErrors[item.id]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Generic hotspot — no special content, just the description */}
              {!activeData.showsMenu && !activeData.showsForm && (
                <div className="flex gap-2 mt-2">
                  <div className="starburst-badge" style={{ width: 44, height: 44, fontSize: "0.5rem" }}>
                    FOUND!
                  </div>
                  <p className="text-xs text-[hsl(25,15%,50%)] italic">
                    You discovered the {activeData.label}. Keep exploring — there's more to find.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
