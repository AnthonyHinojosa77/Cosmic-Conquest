import { useTapWord } from "@/lib/device";

// "★ Tap the glowing spots to explore the … ★" under a world scene.
export function HotspotHint({ place }: { place: string }) {
  const tap = useTapWord();
  return <>★ {tap} the glowing spots to explore the {place} ★</>;
}
