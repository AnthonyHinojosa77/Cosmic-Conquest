# Design language — Cosmic Conquest

A "retro pulp universe": aged-paper/parchment surfaces, bold primary inks, comic-panel
borders, and pulp-magazine display type. This document captures the visual tokens so the
language stays consistent. Sources of truth: `tailwind.config.ts` and
`client/src/index.css` (CSS custom properties). Colors are stored as HSL channel triples
and consumed as `hsl(var(--token) / <alpha-value>)`.

## Color palette

Theme colors are defined as CSS variables in `:root` (light) and `.dark` (dark) in
`client/src/index.css`, and surfaced to Tailwind as named colors in `tailwind.config.ts`.

### Light theme (default — "aged paper")

| Token              | HSL                | Role                                  |
| ------------------ | ------------------ | ------------------------------------- |
| `--background`     | `38 35% 90%`       | Parchment page background             |
| `--foreground`     | `25 40% 12%`       | Near-black brown ink (body text)      |
| `--card`           | `36 30% 86%`       | Card / panel surface                  |
| `--border`         | `30 25% 72%`       | Default hairline border               |
| `--primary`        | `0 72% 48%`        | Bold pulp red (CTAs, headers)         |
| `--secondary`      | `42 50% 78%`       | Gold/cream                            |
| `--accent`         | `195 65% 38%`      | Teal                                  |
| `--muted`          | `35 18% 80%`       | Muted parchment                       |
| `--muted-foreground` | `25 15% 42%`     | Secondary text                        |
| `--destructive`    | `0 65% 48%`        | Error / destructive red               |
| `--ring`           | `0 72% 48%`        | Focus ring (matches primary)          |

Gold highlight used throughout hotspots/buttons (not a theme token, used directly in CSS):
`hsl(45 80% 52–55%)`.

### Chart accents (light)

`--chart-1` red `0 72% 48%` · `--chart-2` teal `195 65% 38%` · `--chart-3` gold `45 80% 52%`
· `--chart-4` green `160 45% 40%` · `--chart-5` purple `280 35% 45%`.

### Status dots (`colors.status` in Tailwind config)

`online` `rgb(34 197 94)` · `away` `rgb(245 158 11)` · `busy` `rgb(239 68 68)` ·
`offline` `rgb(156 163 175)`.

### Dark theme

A cool slate counterpart (`--background 220 20% 10%`, `--foreground 38 20% 88%`) with the
same red/teal/gold accents shifted lighter for contrast. See the `.dark` block in
`client/src/index.css` for the full set.

## Typography

- **Display / pulp titles** (`.pulp-title`, `.retro-btn`, panel headers): `Bangers`,
  fallback `Permanent Marker`, letter-spacing `0.06em`.
- **Hand-lettered captions** (`.marker-text`, `.visitor-ticker`): `Permanent Marker`.
- **Body** (`--font-sans`): `Space Grotesk`, system-ui fallback.
- Serif `Georgia`, mono `Courier New` are available via `--font-serif` / `--font-mono`.

Fonts are loaded from Google Fonts at the top of `client/src/index.css`.

## Radius & spacing

- Base radius `--radius: 0.5rem`. Tailwind `borderRadius`: `lg .5625rem (9px)`,
  `md .375rem (6px)`, `sm .1875rem (3px)`.
- Base spacing unit `--spacing: 0.25rem` (Tailwind's 4px scale).
- Comic / panel borders are intentionally chunky: `4–6px` solid in the dark ink
  `hsl(25 40% ~18–20%)`, paired with offset hard "sticker" shadows
  (e.g. `4px 4px 0`, `8px 8px 0`) rather than soft blurs.
- A layered soft shadow scale (`--shadow-2xs` … `--shadow-2xl`) exists for elevation.

## Animation specs

All motion is **CSS-driven** (there is no Framer Motion usage in the client, despite the
dependency being present). Keyframes and utility classes live in the
`@layer components` block of `client/src/index.css`.

| Utility / element          | Keyframes      | Timing                                              | Use                                  |
| -------------------------- | -------------- | --------------------------------------------------- | ------------------------------------ |
| `.animate-float`           | `float`        | `4s ease-in-out infinite` (translateY 0 → −8px → 0) | Gentle hovering of decorative props  |
| `.animate-wiggle`          | `wiggle`       | `3s ease-in-out infinite` (rotate ±2°)              | Playful idle motion                  |
| `.animate-slide-up`        | `slideUp`      | `0.4s cubic-bezier(0.16, 1, 0.3, 1) both` (opacity 0→1, translateY 20px→0) | Content entering view |
| `.animate-fade-in`         | `fadeIn`       | `0.3s ease-out both` (opacity 0 → 1)                | Discovery text / captions appearing  |
| `.hotspot-indicator`       | `hotspot-pulse`| `2s ease-in-out infinite` (scale 1 → 1.4, opacity 0.7 → 1) | Pulsing "click me" hotspot marker |
| `.hotspot` hover           | —              | `transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1)` | Hotspot highlight on hover         |
| `.retro-btn` hover/active  | —              | `transition: all 0.15s` + translate + shadow shift  | Tactile "press" feedback on buttons  |
| `animate-pulse` (Tailwind) | built-in       | default Tailwind pulse                              | "Online" status dot in the hub       |

The signature easing curve is `cubic-bezier(0.16, 1, 0.3, 1)` (a soft "ease-out-expo"),
used for both entrance slides and hotspot transitions.

## Reduced motion

All looping/decorative animations and the transitions above are gated behind a
`@media (prefers-reduced-motion: reduce)` block in `client/src/index.css`: for users who
request reduced motion, infinite loops and entrance animations are disabled and transition
durations are collapsed, leaving the static layout fully usable. Prefer adding new motion
through these existing utilities so it is covered by that gate automatically.
