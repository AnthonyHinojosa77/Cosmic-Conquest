import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "cosmic-discovered";

export function loadDiscovered(store: Record<string, string[]>, world: string): string[] {
  return store[world] ?? [];
}

export function saveDiscovered(store: Record<string, string[]>, world: string, ids: readonly string[]): Record<string, string[]> {
  return { ...store, [world]: [...ids] };
}

// This page's discoveries. Session storage is only a copy, so a refused write still survives a remount.
const pageDiscoveries: Record<string, string[]> = {};

export function discoveryList(
  memory: Record<string, string[]>,
  stored: Record<string, string[]>,
  world: string,
): string[] {
  return memory[world] ?? stored[world] ?? [];
}

export function discoveryAfter(
  memory: Record<string, string[]>,
  stored: Record<string, string[]>,
  world: string,
  id: string,
): Record<string, string[]> {
  const current = discoveryList(memory, stored, world);
  const ids = current.includes(id) ? [...current] : [...current, id];
  return { ...memory, [world]: ids };
}

function readStore(): Record<string, string[]> {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, string[]>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Private browsing can refuse the write. The set still updates for this visit.
  }
}

function recall(world: string): string[] {
  const list = discoveryList(pageDiscoveries, readStore(), world);
  if (!pageDiscoveries[world]) pageDiscoveries[world] = [...list];
  return pageDiscoveries[world];
}

export function useDiscovered(world: string) {
  const [items, setItems] = useState<Set<string>>(() => new Set(recall(world)));
  const known = useRef(items);
  known.current = items;
  const mark = useCallback((id: string) => {
    if (known.current.has(id)) return;
    const saved = discoveryAfter(pageDiscoveries, {}, world, id);
    pageDiscoveries[world] = saved[world];
    const next = new Set<string>();
    saved[world].forEach((spot) => next.add(spot));
    known.current = next;
    writeStore(saveDiscovered(readStore(), world, saved[world]));
    setItems(next);
  }, [world]);
  return [items, mark] as const;
}

// Focus the hotspot after the panel has unmounted. The updater itself stays pure.
export function useRestoreFocus(activeId: string | null, setActiveId: (id: string | null) => void) {
  const current = useRef(activeId);
  current.current = activeId;
  const restore = useRef<string | null>(null);
  const close = useCallback(() => {
    restore.current = current.current;
    setActiveId(null);
  }, [setActiveId]);
  useEffect(() => {
    if (activeId) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        close();
      };
      window.addEventListener("keydown", onKey);
      const panel = document.querySelector("[data-testid=\"button-close-panel\"]");
      if (panel instanceof HTMLElement) {
        panel.scrollIntoView({ block: "nearest" });
        panel.focus({ preventScroll: true });
      }
      return () => window.removeEventListener("keydown", onKey);
    }
    const id = restore.current;
    restore.current = null;
    if (!id) return;
    const opener = document.querySelector(`[data-testid="hotspot-${id}"]`);
    if (opener instanceof HTMLElement) opener.focus();
  }, [activeId, close]);
  return close;
}
