import { Link } from "wouter";

// Back to the start menu (the front of the game).
export function BackButton() {
  return (
    <Link href="/">
      <button
        className="inline-flex items-center gap-2 text-sm text-[hsl(38,25%,65%)] hover:text-[hsl(45,80%,55%)] transition-colors pulp-title tracking-wider"
        data-testid="button-back"
      >
        <span className="text-lg">←</span>
        <span>Menu</span>
      </button>
    </Link>
  );
}
