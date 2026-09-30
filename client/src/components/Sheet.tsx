import { useEffect, useRef, useState } from "react";

// A card that slides up from the bottom over the scene (what a clue says, a
// place's description), so the art stays on screen instead of the page growing
// underneath it. Not modal: the scene above stays explorable, and tapping another
// hotspot swaps the card's contents.
export function Sheet({
  title,
  onClose,
  children,
  tone = "hsl(0 72% 48%)",
  titleColor,
  testId,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  tone?: string;
  titleColor?: string;
  testId?: string;
}) {
  const body = useRef<HTMLDivElement>(null);
  // Drag the header down to put the card away (phones)
  const drag = useRef<{ y: number; id: number } | null>(null);
  const [dy, setDy] = useState(0);

  // Closing hands keyboard focus back to the hotspot (or button) that opened the card
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // New contents start at the top
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [title]);

  return (
    <section
      className="sheet"
      role="region"
      aria-label={typeof title === "string" ? title : undefined}
      style={dy ? { transform: `translateY(${dy}px)`, animation: "none" } : undefined}
      data-testid={testId}
    >
      <div
        className="sheet-header"
        style={{ background: tone, color: titleColor }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current?.id === e.pointerId) setDy(Math.max(0, e.clientY - drag.current.y));
        }}
        onPointerUp={(e) => {
          if (drag.current?.id !== e.pointerId) return;
          const moved = e.clientY - drag.current.y;
          drag.current = null;
          if (moved > 90) onClose();
          else setDy(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDy(0);
        }}
      >
        <span className="sheet-grip" aria-hidden />
        <span className="sheet-title">{title}</span>
        <button className="sheet-close" onClick={onClose} aria-label="Close" data-testid="button-close-sheet">
          ✕
        </button>
      </div>
      <div ref={body} className="sheet-body">
        {children}
      </div>
    </section>
  );
}
