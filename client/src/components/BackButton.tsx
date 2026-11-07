import { Link } from "wouter";

export function BackButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 min-h-11 text-sm text-[hsl(38,25%,65%)] hover:text-[hsl(45,80%,55%)] transition-colors pulp-title tracking-wider"
      data-testid="button-back"
    >
      <span className="text-lg">←</span>
      <span>Back to Hub</span>
    </Link>
  );
}
