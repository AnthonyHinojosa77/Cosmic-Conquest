import { SUITS, type SuitId } from "@shared/game";

const INK = "#2b1a10";

interface SpaceCowboyProps {
  suit: SuitId;
  bandana?: boolean;
  raygun?: boolean;
  className?: string;
}

// Placeholder hero art: a helmeted space cowboy drawn in the site's inked-cartoon style.
// Swap for the illustrated character once final art exists.
export function SpaceCowboy({ suit, bandana = false, raygun = false, className }: SpaceCowboyProps) {
  const { color, trim } = SUITS[suit];
  return (
    <svg
      viewBox="0 0 200 290"
      className={className}
      role="img"
      aria-label={`Space cowboy in a ${SUITS[suit].name} suit`}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <defs>
        <radialGradient id="visor" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4d7a8c" />
          <stop offset="55%" stopColor="#1d2f3d" />
          <stop offset="100%" stopColor="#0e1820" />
        </radialGradient>
      </defs>

      {/* Boots */}
      <path d="M62 250 h30 v22 h-38 q-4 0 -4 -6 q0 -8 12 -8z" fill="#5a3a22" stroke={INK} strokeWidth="4" />
      <path d="M108 250 h30 q12 0 12 8 q0 6 -4 6 h-38z" fill="#5a3a22" stroke={INK} strokeWidth="4" />

      {/* Legs */}
      <path d="M66 190 h28 l-2 62 h-24z" fill={color} stroke={INK} strokeWidth="4" />
      <path d="M106 190 h28 l-2 62 h-24z" fill={color} stroke={INK} strokeWidth="4" />
      <path d="M70 222 h20 M110 222 h20" stroke={trim} strokeWidth="4" />

      {/* Arms */}
      <path d="M52 124 q-16 6 -18 36 l-2 34 h20 l4 -30 z" fill={color} stroke={INK} strokeWidth="4" />
      <path d="M148 124 q16 6 18 36 l2 34 h-20 l-4 -30 z" fill={color} stroke={INK} strokeWidth="4" />
      <circle cx="42" cy="200" r="11" fill="#7a4a26" stroke={INK} strokeWidth="4" />
      <circle cx="158" cy="200" r="11" fill="#7a4a26" stroke={INK} strokeWidth="4" />

      {/* Torso */}
      <path d="M58 118 q42 -14 84 0 l6 76 q-48 10 -96 0z" fill={color} stroke={INK} strokeWidth="4" />
      <path d="M82 128 h36 v34 h-36z" fill={trim} stroke={INK} strokeWidth="3" />
      <circle cx="92" cy="138" r="3" fill="#e8413a" />
      <circle cx="104" cy="138" r="3" fill="#f2c14e" />
      <path d="M88 150 h24" stroke={INK} strokeWidth="3" />

      {/* Belt + star buckle */}
      <path d="M54 178 q46 8 92 0 l1 12 q-47 9 -94 0z" fill="#6b4226" stroke={INK} strokeWidth="4" />
      <path
        d="M100 176 l3.5 7 7.5 1 -5.5 5 1.5 7.5 -7 -3.5 -7 3.5 1.5 -7.5 -5.5 -5 7.5 -1z"
        fill="#f2c14e"
        stroke={INK}
        strokeWidth="2"
      />

      {/* Holster (+ ray-gun grip) */}
      <path d="M134 186 h18 l-2 34 h-14z" fill="#6b4226" stroke={INK} strokeWidth="4" />
      {raygun && (
        <g>
          <path d="M138 170 h12 l2 18 h-14z" fill="#f3ead7" stroke={INK} strokeWidth="3" />
          <circle cx="144" cy="177" r="3" fill="#f2c14e" stroke={INK} strokeWidth="1.5" />
        </g>
      )}

      {/* Helmet collar */}
      <path d="M62 112 q38 -12 76 0 l-2 14 q-36 -10 -72 0z" fill={trim} stroke={INK} strokeWidth="4" />

      {/* Bandana */}
      {bandana && (
        <g>
          <path d="M70 116 q30 10 60 0 l-30 34z" fill="#c8312b" stroke={INK} strokeWidth="4" />
          <path
            d="M100 124 l2.5 5 5.5 .8 -4 3.8 1 5.4 -5 -2.6 -5 2.6 1 -5.4 -4 -3.8 5.5 -.8z"
            fill="#f2c14e"
          />
        </g>
      )}

      {/* Bubble helmet with mirrored visor (keeps the face hidden) */}
      <circle cx="100" cy="72" r="44" fill="#d9dde0" stroke={INK} strokeWidth="4" />
      <path d="M66 70 q34 -26 68 0 q0 30 -34 36 q-34 -6 -34 -36z" fill="url(#visor)" stroke={INK} strokeWidth="4" />
      <path d="M76 66 q12 -12 26 -12" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="5" fill="none" />
      <path d="M118 88 q6 -4 8 -12" stroke="#9fd3e6" strokeOpacity="0.6" strokeWidth="3" fill="none" />
      <circle cx="58" cy="76" r="6" fill={trim} stroke={INK} strokeWidth="3" />
      <circle cx="142" cy="76" r="6" fill={trim} stroke={INK} strokeWidth="3" />

      {/* Cowboy hat */}
      <path d="M40 40 q60 20 120 0 q-6 14 -60 18 q-54 -4 -60 -18z" fill="#7a4a26" stroke={INK} strokeWidth="4" />
      <path d="M68 42 q0 -34 14 -36 q18 8 36 0 q14 2 14 36 q-32 8 -64 0z" fill="#8f5a2f" stroke={INK} strokeWidth="4" />
      <path d="M69 34 q31 7 62 0 l1 8 q-32 7 -64 0z" fill="#c8312b" stroke={INK} strokeWidth="3" />
    </svg>
  );
}
