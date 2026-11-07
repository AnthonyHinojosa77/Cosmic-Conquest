import { Link } from "wouter";

// "← Bounty Office" link used in page headers (shortened on phones).
export function OfficeLink({ className = "text-[hsl(38,25%,65%)] hover:text-[hsl(45,80%,55%)]" }: { className?: string }) {
  return (
    <Link
      href="/bounties"
      className={`inline-flex items-center gap-2 min-h-11 text-sm transition-colors pulp-title tracking-wider ${className}`}
      data-testid="button-back-office"
    >
      <span className="text-lg">←</span>
      <span className="hidden sm:inline">Bounty Office</span>
      <span className="sm:hidden">Office</span>
    </Link>
  );
}
