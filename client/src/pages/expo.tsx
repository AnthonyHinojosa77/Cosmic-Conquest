import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getVotedIds, rememberVote } from "@/lib/visitor";
import { errorMessage, useCallsignName } from "@/lib/game";
import { keepDraft, showEmptyError, trackVote } from "@/lib/votes";
import { useDiscovered, useRestoreFocus } from "@/lib/discovered";
import { BackButton } from "@/components/BackButton";
import type { Prediction } from "@shared/schema";
import { ContractLink } from "@/components/ContractLink";
import { HotspotHint } from "@/components/HotspotHint";
import { Scene } from "@/components/Scene";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { useMusic } from "@/lib/sound";

const exhibits = [
  { name: "The Jet-Pack Commuter", icon: "🚀", desc: "Personal flight devices for daily travel — no more traffic jams." },
  { name: "Robot Butler Service", icon: "🤖", desc: "Automated household helpers for cooking, cleaning, and childcare." },
  { name: "Atomic Home Reactor", icon: "⚛️", desc: "A pocket-sized nuclear reactor powers your entire home for pennies." },
  { name: "Videophone Exchange", icon: "📺", desc: "See the face of anyone you call, anywhere in the world." },
  { name: "Moon Colony Alpha", icon: "🌙", desc: "Permanent lunar settlement with schools, shops, and parks." },
  { name: "The Moving Sidewalk", icon: "🛤️", desc: "City-wide conveyor walkways replace buses — walk at 30mph." },
];

// Hotspots positioned over the expo illustration
const hotspots = [
  {
    id: "jetpack",
    label: "Jet-Pack Demonstration",
    description: "A brave volunteer straps on the JP-3000 and lifts off the exhibit floor to thunderous applause. Twin hydrogen jets roar to life, painting blue-white contrails across the inside of the geodesic dome. The crowd cranes their necks as he banks, spirals, and touches down again with the casual grace of a man stepping off a streetcar. The future of commuting, ladies and gentlemen — no traffic, no trains, just sky.",
    top: "12%", left: "6%", width: "18%", height: "36%",
    indicatorPos: { top: "35%", left: "50%" },
    exhibitIndex: 0,
  },
  {
    id: "robot-butler",
    label: "Robot Butler Pavilion",
    description: "The RB-9 Household Companion glides across the pavilion floor, serving canapés with mechanical precision and a courteous bow of its chrome dome. It can vacuum your parlor, prepare a four-course dinner, and read your children to sleep with a voice like warm brass. The sign above the display reads: 'WHY DO IT YOURSELF WHEN SCIENCE CAN DO IT BETTER?'",
    top: "28%", left: "66%", width: "13%", height: "55%",
    indicatorPos: { top: "30%", left: "50%" },
    exhibitIndex: 1,
  },
  {
    id: "moving-sidewalk",
    label: "The Moving Sidewalk",
    description: "The sidewalk rolls under the crowd at a walking clip, a ribbon of chrome and red rubber. Step on and the fair slides past: the dome, the robot, the videophone booth. A sign invites you to say where the walk will have carried the city by 2050.",
    top: "71%", left: "3%", width: "38%", height: "23%",
    indicatorPos: { top: "40%", left: "50%" },
    exhibitIndex: 5,
    showsPredictionForm: true,
  },
  {
    id: "moon-colony",
    label: "Moon Colony Alpha Model",
    description: "Under a spotlight the size of a dinner plate, a meticulous scale model of humanity's first permanent lunar settlement stretches across a table twelve feet long. Tiny geodesic domes cluster around a central plaza, connected by pressurized walkways. Miniature hydroponic farms glow green under artificial sunlight, and if you lean close, you can see a little school with windows facing Earth — so the children never forget where they came from.",
    top: "37%", left: "30%", width: "30%", height: "33%",
    indicatorPos: { top: "40%", left: "50%" },
    exhibitIndex: 4,
  },
  {
    id: "videophone",
    label: "Videophone of Tomorrow",
    description: "Pick up the sleek Bakelite receiver and a six-inch screen flickers to life in glorious Technicolor. See the face of anyone you call, anywhere in the world — your mother in Peoria, your colleague on the Moon relay station, or the operator on Mars with the three-minute light delay. The future of communication is here, and it fits right on your desk.",
    top: "22%", left: "81%", width: "15%", height: "50%",
    indicatorPos: { top: "35%", left: "50%" },
    exhibitIndex: 3,
  },
];

export default function Expo() {
  useMusic("hub");
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);
  const [discoveredItems, markDiscovered] = useDiscovered("expo");

  // Prediction form
  const { name, setName, resetName } = useCallsignName("The Atomic Expo");
  const [prediction, setPrediction] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: predictions = [], isError: predictionsError, refetch: refetchPredictions } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions"],
    refetchInterval: 5000,
  });

  const draft = useRef({ name, prediction });
  draft.current = { name, prediction };
  const submitPrediction = useMutation({
    mutationFn: async () => {
      const sent = { name, prediction };
      const res = await apiRequest("POST", "/api/predictions", {
        visitorName: sent.name,
        prediction: sent.prediction,
      });
      await res.json();
      return sent;
    },
    onSuccess: (sent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
      setPrediction((now) => keepDraft(sent.prediction, now));
      if (draft.current.name === sent.name) resetName();
      setShowSuccess(true);
    },
  });

  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(() => setShowSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [showSuccess]);

  const [votedIds, setVotedIds] = useState(() => getVotedIds("prediction"));
  const [pendingVotes, setPendingVotes] = useState<Set<number>>(() => new Set());
  const [voteErrors, setVoteErrors] = useState<Record<number, string>>({});
  const markVoted = (id: number) => {
    rememberVote("prediction", id);
    setVotedIds(prev => new Set(prev).add(id));
  };

  const voteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/predictions/${id}/vote`);
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
      queryClient.invalidateQueries({ queryKey: ["/api/predictions"] });
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
  const activeExhibit = activeData?.exhibitIndex !== undefined ? exhibits[activeData.exhibitIndex] : null;

  return (
    <div className="game-page">
      <SceneBackdrop src="./scenes/expo-scene.webp" />
      {/* Scene header */}
      <header className="game-header bg-[hsl(42,35%,16%)]/80 border-[hsl(45,80%,48%)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <BackButton />
          <h1 className="pulp-title text-xl md:text-2xl text-[hsl(45,80%,55%)] tracking-wider">
            The Atomic Expo
          </h1>
          <div className="visitor-ticker text-xs" style={{ fontSize: "0.85rem" }}>
            <span className="hidden md:inline">Discovered:</span>{" "}
            <span className="pulp-title text-base" style={{ color: discoveredItems.size === hotspots.length ? "hsl(120, 60%, 55%)" : "hsl(45, 80%, 55%)" }}>
              {discoveredItems.size}/{hotspots.length}
            </span>
          </div>
        </div>
      </header>
      {/* Scene illustration */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="bleed rise-in">
          <Scene src="./scenes/expo-scene.webp" alt="The Atomic Expo — City of Tomorrow with jetpack demo, robot butler, moon colony, videophone" testId="scene-expo" reserve={200}>
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

        {!activeHotspot && (
          <p className="text-center text-[hsl(38,20%,50%)] text-xs mt-3 marker-text animate-fade-in">
            <HotspotHint place="expo" />
          </p>
        )}
      </div>

      {/* Discovery panel */}
      {activeData && (
        <div className="max-w-5xl mx-auto px-4 mt-4 pb-8 animate-slide-up">
          <div className="discovery-panel relative mx-auto" style={{ position: "relative", maxWidth: 600 }}>
            <div className="discovery-panel-header" style={{ background: "hsl(45, 80%, 48%)", color: "hsl(25, 40%, 12%)" }}>
              <span>{activeData.label}</span>
              <button
                onClick={closePanel}
                className="panel-close text-[hsl(25,40%,20%)] hover:text-black text-lg leading-none"
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
              {(activeData.id === "robot-butler" || activeData.id === "videophone" || activeData.id === "moon-colony") && (
                <ContractLink bountyId="heart-of-luna" />
              )}

              {/* Exhibit detail */}
              {activeExhibit && (
                <div className="comic-panel p-4 bg-[hsl(38,35%,88%)] flex items-start gap-3">
                  <span className="text-3xl">{activeExhibit.icon}</span>
                  <div>
                    <span className="pulp-title text-sm text-[hsl(25,40%,15%)]">{activeExhibit.name}</span>
                    <p className="text-xs text-[hsl(25,20%,40%)] mt-1">{activeExhibit.desc}</p>
                  </div>
                </div>
              )}

              {activeData.showsPredictionForm && (
                <div className="space-y-3">
                  <h3 className="pulp-title text-sm text-[hsl(45,80%,42%)] tracking-wider">Where will the walk go?</h3>
                  <p className="text-xs text-[hsl(25,15%,42%)]">By 2050, where has the moving sidewalk carried the city?</p>
                  <input
                    placeholder="Your name"
                    value={name}
                    maxLength={50}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitPrediction.isPending}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] text-[hsl(25,40%,15%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(45,80%,48%)] focus:outline-none"
                    data-testid="input-prediction-name"
                  />
                  <textarea
                    placeholder="By the year 2050, I predict that..."
                    value={prediction}
                    maxLength={500}
                    onChange={(e) => setPrediction(e.target.value)}
                    disabled={submitPrediction.isPending}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-[hsl(38,30%,85%)] border-2 border-[hsl(30,20%,68%)] rounded focus:border-[hsl(45,80%,48%)] focus:outline-none resize-none"
                    data-testid="input-prediction-text"
                  />
                  <button
                    onClick={() => submitPrediction.mutate()}
                    disabled={!name.trim() || !prediction.trim() || submitPrediction.isPending}
                    className="retro-btn gold text-sm"
                    data-testid="button-submit-prediction"
                  >
                    {submitPrediction.isPending ? "Sending..." : "★ Send it down the walk"}
                  </button>
                  {submitPrediction.isError && (
                    <p className="text-xs text-[hsl(0,65%,40%)]" role="alert">{errorMessage(submitPrediction.error)} Try again.</p>
                  )}

                  {showSuccess && (
                    <div className="text-center py-2 animate-fade-in">
                      <span className="pulp-title text-[hsl(45,80%,48%)] text-lg tracking-wider drop-shadow-sm">
                        TRANSMISSION RECEIVED!
                      </span>
                    </div>
                  )}

                  {showEmptyError(predictionsError, predictions.length) && (
                    <p className="text-xs text-[hsl(0,65%,40%)]" role="alert" data-testid="text-feed-error">
                      Couldn't load these. <button className="underline" onClick={() => refetchPredictions()}>Try again</button>
                    </p>
                  )}
                  {/* Predictions */}
                  {predictions.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="pulp-title text-xs text-[hsl(0,72%,48%)] tracking-wider">
                        Predictions ({predictions.length})
                      </h4>
                      {predictions.map(pred => (
                        <div key={pred.id} className="comic-panel p-3 bg-[hsl(38,35%,88%)] flex items-start gap-3" data-testid={`card-prediction-${pred.id}`}>
                          <button
                            onClick={() => voteMutation.mutate(pred.id)}
                            disabled={votedIds.has(pred.id) || pendingVotes.has(pred.id)}
                            className="flex flex-col items-center justify-center gap-0.5 shrink-0 mt-0.5 hover:scale-110 transition-transform min-h-11 min-w-11"
                            aria-label={`Vote for ${pred.visitorName}'s prediction`}
                            data-testid={`button-vote-prediction-${pred.id}`}
                          >
                            <span className="text-lg">👍</span>
                            <span className="text-xs font-bold text-[hsl(25,40%,15%)]">{pred.votes}</span>
                          </button>
                          <div>
                            <p className="text-sm text-[hsl(25,40%,15%)] leading-relaxed">{pred.prediction}</p>
                            <p className="text-xs text-[hsl(25,15%,50%)] mt-1">— {pred.visitorName}</p>
                            {voteErrors[pred.id] && (
                              <p className="text-xs text-[hsl(0,65%,40%)] mt-1" role="alert" data-testid="text-vote-error">{voteErrors[pred.id]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Generic discovery for non-special hotspots */}
              {!activeExhibit && !activeData.showsPredictionForm && (
                <div className="flex gap-2 mt-2">
                  <div className="starburst-badge" style={{ width: 44, height: 44, fontSize: "0.5rem" }}>
                    FOUND!
                  </div>
                  <p className="text-xs text-[hsl(25,15%,50%)] italic">
                    You discovered {activeData.label}. Keep exploring.
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
