// In-memory display name — persists for the lifetime of the page session
// (sessionStorage is unavailable in the sandboxed iframe). The visitor's
// identity for vote dedup is a server-issued cookie, not set here.

let visitorName: string | null = null;

export function getVisitorName(): string {
  if (!visitorName) {
    visitorName = `Explorer #${Math.floor(Math.random() * 9000) + 1000}`;
  }
  return visitorName;
}

// Guard against duplicate visitor logs (React 18 StrictMode double-mount in dev)
const loggedWorlds = new Set<string>();

export function shouldLogVisit(world: string): boolean {
  if (loggedWorlds.has(world)) return false;
  loggedWorlds.add(world);
  return true;
}

// Items this page session has voted on. The server's cookie-based check is the
// real guard; this keeps the button disabled after voting even where the
// browser blocks the cookie (e.g. a sandboxed iframe).
const votedItems = new Map<string, Set<number>>();

export function getVotedIds(kind: string): Set<number> {
  return new Set(votedItems.get(kind) ?? []);
}

export function rememberVote(kind: string, id: number): void {
  if (!votedItems.has(kind)) votedItems.set(kind, new Set());
  votedItems.get(kind)!.add(id);
}
