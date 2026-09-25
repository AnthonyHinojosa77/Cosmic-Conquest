import { DEFAULT_SUIT, SUITS, type SuitId } from "@shared/game";

export type HeroPose = "standing" | "ready" | "firing" | "too-slow";

const POSES: Record<HeroPose, { file: string; alt: string }> = {
  standing: { file: "hero-standing", alt: "The space cowboy standing at ease, thumb hooked in his belt" },
  ready: { file: "hero-ready", alt: "The space cowboy, hand on his holster, ready to draw" },
  firing: { file: "hero-firing", alt: "The space cowboy firing his ray gun" },
  "too-slow": { file: "hero-too-slow", alt: "The space cowboy knocked off balance" },
};

// An unknown suit (stale bundle, bad data) falls back to the default art.
const knownSuit = (suit: string): SuitId => (Object.hasOwn(SUITS, suit) ? (suit as SuitId) : DEFAULT_SUIT);

// Every pose exists in every suit: hero-<pose>.webp (silver) or hero-<pose>-<suit>.webp.
function heroSrc(pose: HeroPose, suit: SuitId): string {
  const file = POSES[pose].file;
  return `./game/${suit === DEFAULT_SUIT ? file : `${file}-${suit}`}.webp`;
}

// Illustrated hero (cut-out art from the image generator).
export function HeroArt({
  pose,
  suit = DEFAULT_SUIT,
  className,
  style,
}: {
  pose: HeroPose;
  suit?: SuitId;
  className?: string;
  style?: React.CSSProperties;
}) {
  suit = knownSuit(suit);
  const alt = suit === DEFAULT_SUIT ? POSES[pose].alt : `${POSES[pose].alt}, in the ${SUITS[suit].name} suit`;
  return <img src={heroSrc(pose, suit)} alt={alt} className={className} style={style} draggable={false} />;
}

// Preload art so switching poses or suits is instant.
export function preloadHeroPoses(poses: readonly HeroPose[], suits: readonly SuitId[]) {
  for (const pose of poses) {
    for (const suit of suits) {
      const img = new Image();
      img.src = heroSrc(pose, knownSuit(suit));
    }
  }
}
