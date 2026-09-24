export type HeroPose = "ready" | "firing" | "too-slow";

const POSES: Record<HeroPose, { src: string; alt: string }> = {
  ready: { src: "./game/hero-ready.webp", alt: "The space cowboy, hand on his holster, ready to draw" },
  firing: { src: "./game/hero-firing.webp", alt: "The space cowboy firing his ray gun" },
  "too-slow": { src: "./game/hero-too-slow.webp", alt: "The space cowboy knocked off balance" },
};

// Illustrated hero (cut-out art from the image generator).
export function HeroArt({ pose, className, style }: { pose: HeroPose; className?: string; style?: React.CSSProperties }) {
  const { src, alt } = POSES[pose];
  return <img src={src} alt={alt} className={className} style={style} draggable={false} />;
}

// Preload every pose so switching during a showdown is instant.
export function preloadHeroPoses() {
  for (const { src } of Object.values(POSES)) {
    const img = new Image();
    img.src = src;
  }
}
