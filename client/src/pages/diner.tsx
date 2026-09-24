import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BackButton } from "@/components/BackButton";
import { getVisitorId, getVisitorName, shouldLogVisit } from "@/lib/visitor";
import type { MenuItem } from "@shared/schema";

// Hotspot definitions — positioned over the diner illustration
const hotspots = [
  {
    id: "jukebox",
    label: "Atomic Jukebox",
    description: "The Wurlitzer Galaxia stands seven feet tall, its vacuum tubes pulsing amber and violet with every downbeat. It plays hits beamed in from relay stations across the solar system — Martian blues, Venusian swing, the haunting theremin ballads of the outer rim. Drop in a credit and feel the bass rattle the chrome trim on every booth in the joint.",
    top: "25%", left: "2%", width: "22%", height: "55%",
    indicatorPos: { top: "40%", left: "50%" },
  },
  {
    id: "menu-board",
    label: "Today's Specials",
    description: "Hand-lettered every morning by the robot chef in crisp white paint on a slab of polished asteroid. The Nebula Noodle Soup glows a faint cerulean — perfectly safe, they assure you. The daily specials rotate with the station's orbit, so what's fresh depends on which cargo freighter docked last.",
    top: "5%", left: "30%", width: "20%", height: "30%",
    indicatorPos: { top: "50%", left: "50%" },
    showsMenu: true,
  },
  {
    id: "robot-waiter",
    label: "Servo the Robot Waiter",
    description: "Model T-800 hospitality unit, polished to a mirror finish and programmed with the manners of a Lunar Grand Hotel concierge. Servo glides between booths on magnetic rails, balancing six plates on each articulated arm without spilling a drop. Tips aren't required, but leave one and his optical sensors flash a grateful pink.",
    top: "20%", left: "42%", width: "18%", height: "60%",
    indicatorPos: { top: "30%", left: "50%" },
  },
  {
    id: "counter",
    label: "Chrome Counter",
    description: "The counter curves like a rocket's aileron, its chrome surface polished to a mirror finish by Servo's tireless buffing arm every night after closing. Twelve swiveling stools in cherry-red vinyl line the bar, each one worn smooth by a generation of spacers, engineers, and dreamers. Pull up a seat and invent something for the menu — the Diner runs on community spirit and cosmic creativity.",
    top: "55%", left: "25%", width: "50%", height: "25%",
    indicatorPos: { top: "40%", left: "50%" },
    showsForm: true,
  },
  {
    id: "window",
    label: "Observation Window",
    description: "Through the reinforced panoramic viewport, Saturn hangs in the velvet dark like a jeweled crown. The rings catch the sunlight at this angle, splitting it into bands of gold and ivory that stretch across the void. Regulars say the view is worth the trip alone — and they're not wrong. Sip your Lunar Lemonade and watch the cosmos put on a show.",
    top: "5%", left: "70%", width: "28%", height: "35%",
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
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [discoveredItems, setDiscoveredItems] = useState<Set<string>>(new Set());
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!shouldLogVisit("Astro Diner")) return;
    apiRequest("POST", "/api/visitors", {
      visitorId: getVisitorId(),
      visitorName: getVisitorName(),
      world: "Astro Diner",
      action: "arrived at",
      createdAt: new Date().toISOString(),
    }).catch(() => {});
  }, []);

  // Form state for community dish
  const [name, setName] = useState("");
  const [dishName, setDishName] = useState("");
  const [description, setDescription] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: communityItems = [] } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    refetchInterval: 5000,
  });

  const submitDish = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/menu-items", {
        visitorName: name,
        dishName,
        description,
        createdAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      setDishName("");
      setDescription("");
      setName("");
      setShowSuccess(true);
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const voteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/menu-items/${id}/vote`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
    },
  });

  const handleHotspotClick = useCallback((id: string) => {
    setDiscoveredItems(prev => new Set(prev).add(id));
    setActiveHotspot(prev => prev === id ? null : id);
  }, []);

  const activeData = hotspots.find(h => h.id === activeHotspot);

  return (
    <div className="min-h-screen bg-[hsl(25,30%,12%)] paper-texture">
      {/* Scene header */}
      <div className="bg-[hsl(350,30%,14%)] border-b-4 border-[hsl(45,80%,45%)] px-4 py-3">
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
      </div>

      {/* Scene illustration with hotspot overlays */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="scene-container relative" data-testid="scene-diner">
          <img
            src="./scenes/diner-scene.png"
            alt="Inside the Astro Diner — chrome counter, robot waiter, jukebox, observation window"
            className="w-full h-auto block"
            onLoad={() => setImgLoaded(true)}
            draggable={false}
          />

          {imgLoaded && hotspots.map((hs) => (
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
              data-testid={`hotspot-${hs.id}`}
            >
              <div
                className="hotspot-indicator"
                style={{ top: hs.indicatorPos.top, left: hs.indicatorPos.left, transform: "translate(-50%, -50%)" }}
              />
            </button>
          ))}
        </div>

        {/* Hotspot hint text */}
        {!activeHotspot && (
          <p className="text-center text-[hsl(38,20%,50%)] text-xs mt-3 marker-text animate-fade-in">
            ★ Click the glowing spots to explore the diner ★
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
                onClick={() => setActiveHotspot(null)}
                className="text-[hsl(40,40%,95%)] hover:text-white text-lg leading-none"
                data-testid="button-close-panel"
              >
                ✕
              </button>
            </div>
            <div className="discovery-panel-body">
              <p className="text-sm text-[hsl(25,40%,20%)] leading-relaxed mb-4">
                {activeData.description}
              </p>

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
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(0,72%,48%)] focus:outline-none"
                    data-testid="input-dish-chef"
                  />
                  <input
                    placeholder="Dish name (e.g., Supernova Spaghetti)"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(0,72%,48%)] focus:outline-none"
                    data-testid="input-dish-name"
                  />
                  <textarea
                    placeholder="Describe your creation..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
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

                  {showSuccess && (
                    <div className="text-center py-2 animate-fade-in">
                      <span className="pulp-title text-[hsl(45,80%,48%)] text-lg tracking-wider drop-shadow-sm">
                        TRANSMISSION RECEIVED!
                      </span>
                    </div>
                  )}

                  {/* Community dishes */}
                  {communityItems.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="pulp-title text-xs text-[hsl(195,65%,38%)] tracking-wider">
                        Community Menu ({communityItems.length})
                      </h4>
                      {communityItems.map(item => (
                        <div key={item.id} className="comic-panel p-3 bg-[hsl(38,35%,88%)] flex items-start gap-3" data-testid={`card-menu-${item.id}`}>
                          <button
                            onClick={() => voteMutation.mutate(item.id)}
                            disabled={voteMutation.isPending}
                            className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5 hover:scale-110 transition-transform"
                            data-testid={`button-vote-dish-${item.id}`}
                          >
                            <span className="text-lg">👍</span>
                            <span className="text-xs font-bold text-[hsl(25,40%,15%)]">{item.votes}</span>
                          </button>
                          <div>
                            <span className="pulp-title text-xs text-[hsl(25,40%,15%)]">{item.dishName}</span>
                            <p className="text-xs text-[hsl(25,20%,40%)] mt-0.5">{item.description}</p>
                            <p className="text-xs text-[hsl(25,15%,55%)] mt-1">— Chef {item.visitorName}</p>
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
