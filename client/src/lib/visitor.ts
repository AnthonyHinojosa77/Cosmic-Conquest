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

// A world is reserved while its arrival is in flight, and logged only after that request succeeds.
export type VisitBook = { logged: Set<string>; pending: Set<string> };

export function beginVisit(book: VisitBook, world: string): boolean {
  if (book.logged.has(world) || book.pending.has(world)) return false;
  book.pending.add(world);
  return true;
}

export function settleVisit(book: VisitBook, world: string, ok: boolean): void {
  book.pending.delete(world);
  if (ok) book.logged.add(world);
}

const visits: VisitBook = { logged: new Set(), pending: new Set() };

export function shouldLogVisit(world: string): boolean {
  return beginVisit(visits, world);
}

export function finishVisit(world: string, ok: boolean): void {
  settleVisit(visits, world, ok);
}

// Don't sign the log until the hunter's own callsign is loaded. A failed profile is not an Explorer number.
export function arrivalName(
  player: { callsign: string } | null,
  pending: boolean,
  failed: boolean,
): string | null {
  if (!player && (pending || failed)) return null;
  return player?.callsign ?? null;
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
