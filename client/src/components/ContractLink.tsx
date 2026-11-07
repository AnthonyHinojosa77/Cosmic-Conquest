import { Link } from "wouter";
import { bountyById, contractLinkPhase, lockedLabel } from "@shared/game";
import { usePlayer } from "@/lib/game";

// A contract posted inside a social scene. Locked jobs stay locked.
// Opening a collected job does not wipe the notebook. The case file has the fresh-notebook button.
// A profile that has not loaded yet is not an empty hunter.
export function ContractLink({ bountyId }: { bountyId: string }) {
  const { data: player, isError, refetch } = usePlayer();
  const bounty = bountyById(bountyId);
  const phase = contractLinkPhase(
    bounty,
    player ?? null,
    player ? "ready" : isError ? "error" : "pending",
  );
  if (phase === "hidden" || !bounty) return null;
  if (phase === "checking") {
    return (
      <p className="text-xs text-[hsl(25,20%,40%)] mt-2" data-testid={`link-job-${bountyId}`}>
        Checking the contract…
      </p>
    );
  }
  if (phase === "error") {
    return (
      <p className="text-xs text-[hsl(0,65%,40%)] mt-2" role="alert" data-testid={`link-job-${bountyId}`}>
        Couldn't load your hunter.{" "}
        <button className="underline" onClick={() => refetch()}>Try again</button>
      </p>
    );
  }
  if (phase === "locked") {
    return (
      <p className="text-xs text-[hsl(25,20%,40%)] mt-2" data-testid={`link-job-${bountyId}`}>
        {lockedLabel(bounty)}
      </p>
    );
  }
  return (
    <Link
      href={`/bounty/${bountyId}`}
      className="block text-xs mt-2 underline pulp-title text-[hsl(0,72%,40%)]"
      data-testid={`link-job-${bountyId}`}
    >
      {phase === "collected" ? `✓ Collected — open: ${bounty.title}` : `Open contract: ${bounty.title}`}
    </Link>
  );
}
