import { useCallback, useEffect, useRef, useState } from "react";
import { isArtReady, placeholderFor } from "@/lib/art";

// A picture that fades in once decoded, over its blurred stand-in (or its
// average colour), instead of painting in strips. Used for portraits, cutouts
// and illustrations outside the explorable scenes.
export function ArtImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  style,
  imgStyle,
  enter = "fade",
  delay = 0,
  eager = false,
  testId,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  style?: React.CSSProperties;
  imgStyle?: React.CSSProperties;
  // How the picture arrives: a fade, or sliding in from a side (showdown characters)
  enter?: "fade" | "left" | "right" | "rise";
  delay?: number;
  eager?: boolean;
  testId?: string;
}) {
  const ph = placeholderFor(src);
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState(() => isArtReady(src));

  useEffect(() => setShown(isArtReady(src)), [src]);

  const reveal = useCallback(() => {
    const img = ref.current;
    const show = () => setShown(true);
    if (img?.decode) img.decode().then(show, show);
    else show();
  }, []);

  useEffect(() => {
    if (!shown && ref.current?.complete && ref.current.naturalWidth > 0) reveal();
  }, [shown, reveal, src]);

  return (
    <span
      className={`art-image ${className}`}
      style={{ ...(ph ? { backgroundImage: `url(${ph.src})`, backgroundColor: ph.color } : {}), ...style }}
      data-shown={shown}
      data-testid={testId}
    >
      <img
        ref={ref}
        key={src}
        src={src}
        alt={alt}
        className={`art-image-img enter-${enter} ${imgClassName}`}
        style={{ ...imgStyle, transitionDelay: shown && delay ? `${delay}ms` : undefined }}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onLoad={reveal}
        onError={reveal}
      />
    </span>
  );
}
