import { useEffect, useState } from "react";
import { placeholderFor } from "@/lib/art";

// The whole screen behind a page takes on the colours of the scene being shown:
// its tiny stand-in, blurred and darkened, fills the space around the art (like a
// cinema screen's glow) instead of a flat brown page. Crossfades between scenes.
export function SceneBackdrop({ src, tint = "hsl(25 40% 6% / 0.55)" }: { src?: string; tint?: string }) {
  const url = placeholderFor(src)?.src;
  const [layers, setLayers] = useState<{ url: string; key: number }[]>(() => (url ? [{ url, key: 0 }] : []));

  useEffect(() => {
    if (!url) return;
    setLayers((prev) => (prev[prev.length - 1]?.url === url ? prev : [...prev.slice(-1), { url, key: Date.now() }]));
  }, [url]);

  return (
    <div className="scene-backdrop" aria-hidden>
      {/* The newest layer fades in over the previous one */}
      {layers.map((l) => (
        <div key={l.key} className="scene-backdrop-layer" style={{ backgroundImage: `url(${l.url})` }} />
      ))}
      <div className="scene-backdrop-tint" style={{ background: tint }} />
    </div>
  );
}
