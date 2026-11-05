import { useSyncExternalStore } from "react";

/**
 * The watchlist (the spec's, `watched` in its lib.js): the coins a viewer has starred, a per-viewer convenience kept in
 * this browser only and never sent anywhere. Without storage (a private window, blocked site data) the stars still
 * toggle for the visit. Every page that draws a star reads the same list, and a star toggled in another tab shows here.
 */
export const WATCH_KEY = "stoker.watch";

const EMPTY: readonly string[] = [];
let memory: readonly string[] = EMPTY;
let cached: { raw: string | null; list: readonly string[] } | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(WATCH_KEY);
  } catch {
    return memory;
  }
  // The same text gives the same array, so React sees no change until the list changes.
  if (cached?.raw === raw) return cached.list;
  let list: readonly string[] = EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) list = parsed.filter((m): m is string => typeof m === "string");
  } catch {
    // a mangled entry reads as an empty list, and the next star writes a good one
  }
  cached = { raw, list };
  return list;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === WATCH_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stars a coin, or takes its star away; returns whether it is watched now. */
export function toggleWatch(mint: string) {
  const list = read();
  const next = list.includes(mint) ? list.filter((m) => m !== mint) : [...list, mint];
  memory = next;
  try {
    window.localStorage.setItem(WATCH_KEY, JSON.stringify(next));
  } catch {
    // kept in memory for the visit
  }
  for (const listener of listeners) listener();
  return next.includes(mint);
}

/** The watched mints, oldest star first. The server, and the first render in the browser, see an empty list. */
export function useWatchlist(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
