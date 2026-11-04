"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LaunchSort, LaunchSummary } from "@launchpad/contract";
import { getLaunch, listLaunches } from "@/lib/api";
import { boardSearch, isFiltered, KINDS, sameQuery, SEARCH_MAX, SORTS, type BoardQuery } from "@/lib/board";
import { SEARCH_HASH, SITE_SEARCH_ATTRIBUTE } from "@/lib/search";
import { useWatchlist } from "@/lib/watchlist";
import { CoinPanel, CoinTable } from "./CoinTable";
import styles from "./Board.module.css";

/** How often the board asks again, so prices and new coins arrive without a reload (production's pace). */
const REFRESH_MS = 4_000;
/** How long after the last keystroke the search is sent. */
const SEARCH_DEBOUNCE_MS = 250;
/** The most watched coins read at once; a longer list keeps its newest stars. */
const WATCH_MAX = 60;

/** The board's orders for a list it holds itself (the watchlist), as the API orders the rest (the spec's sorters). */
const progress = (l: LaunchSummary) => Number(l.curve.raised) / Number(l.graduationTarget);
const SORTERS: Record<LaunchSort, (a: LaunchSummary, b: LaunchSummary) => number> = {
  market_cap: (a, b) => (b.market.marketCap?.sol ?? -1) - (a.market.marketCap?.sol ?? -1),
  new: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  trending: (a, b) => (b.market.volume24h.sol ?? 0) - (a.market.volume24h.sol ?? 0),
  graduation: (a, b) => (a.graduation ? 1 : 0) - (b.graduation ? 1 : 0) || progress(b) - progress(a),
};

/** The API's search, applied to a list the board holds itself: name or ticker containing it, or a mint starting with it. */
const matches = (l: LaunchSummary, q: BoardQuery) => {
  const text = q.q.toLowerCase();
  const found = !text || l.name.toLowerCase().includes(text) || l.symbol.toLowerCase().includes(text) || l.mint.startsWith(q.q);
  return found && (q.category === null || l.quote.category === q.category);
};

/**
 * Explore's board (#6; the spec's coins page): the site's one search, the watchlist, the sort and the "Paired with"
 * chips, then the coins table. Every control is there before the first coin (the owner's rule of 2026-10-07); only the
 * rows wait for real coins, and with nothing launched the page ends at the controls. The query lives in the address
 * (`?sort=`, `?category=`, `?q=`); the watchlist is the viewer's own, read coin by coin from the API, so a starred coin
 * is found however far down the board it sits.
 */
export function Board({ initial, initialQuery, renderedAt }: { initial: LaunchSummary[]; initialQuery: BoardQuery; renderedAt: number }) {
  const [launches, setLaunches] = useState(initial);
  const [query, setQuery] = useState(initialQuery);
  const [shown, setShown] = useState(initialQuery);
  const [typed, setTyped] = useState(initialQuery.q);
  const [now, setNow] = useState(renderedAt);
  const [watchOnly, setWatchOnly] = useState(false);
  const [watchedLaunches, setWatchedLaunches] = useState<LaunchSummary[] | null>(null);
  const watched = useWatchlist();
  const latest = useRef(initialQuery);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const field = useRef<HTMLInputElement>(null);

  // Sent here by "/" or ⌘K from another page (SearchShortcut): the field takes focus and the hash goes.
  useEffect(() => {
    if (window.location.hash !== SEARCH_HASH) return;
    field.current?.focus();
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  const load = useCallback(async (q: BoardQuery) => {
    try {
      const { launches: next } = await listLaunches(q);
      // A slow answer for a query the visitor has since changed is dropped.
      if (!sameQuery(q, latest.current)) return;
      setLaunches(next);
      setShown(q);
    } catch {
      // the last good list stays; the next tick asks again
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => void load(latest.current), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // The watched coins, each as the API has it now, while the watchlist is shown.
  const watchKey = watched.slice(-WATCH_MAX).join(",");
  useEffect(() => {
    if (!watchOnly) return;
    let live = true;
    const read = async () => {
      const mints = watchKey ? watchKey.split(",") : [];
      const found = await Promise.all(mints.map((m) => getLaunch(m).catch(() => null)));
      if (live) setWatchedLaunches(found.filter((l): l is LaunchSummary => l !== null));
    };
    void read();
    const id = setInterval(() => void read(), REFRESH_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [watchOnly, watchKey]);

  function change(next: BoardQuery) {
    latest.current = next;
    setQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}${boardSearch(next)}`);
    void load(next);
  }

  function search(text: string) {
    setTyped(text);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => change({ ...latest.current, q: text.trim().slice(0, SEARCH_MAX) }), SEARCH_DEBOUNCE_MS);
  }

  // Unstarring a coin while the watchlist is shown takes it off the list at once.
  const rows = watchOnly
    ? (watchedLaunches ?? []).filter((l) => watched.includes(l.mint) && matches(l, query)).sort(SORTERS[query.sort])
    : launches;
  const busy = watchOnly ? watchedLaunches === null : !sameQuery(query, shown);
  const empty = rows.length === 0 && !busy;
  const nothingWatched = watchOnly && watched.length === 0;
  // With nothing launched at all the page ends at the controls: an empty board says nothing rather than a placeholder.
  const nothingMatches = empty && (watchOnly || isFiltered(shown));

  return (
    <>
      <div className="shell page-head">
        <h1>Coins</h1>
      </div>
      <div className={`shell section ${styles.board}`}>
        <div className="toolbar">
          <label className="search">
            <span className="visually-hidden">Search</span>
            <input
              ref={field}
              className="input"
              type="search"
              id="search"
              placeholder="Name, ticker or address"
              maxLength={SEARCH_MAX}
              autoComplete="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => search(e.target.value)}
              {...{ [SITE_SEARCH_ATTRIBUTE]: "" }}
            />
            <kbd className="kbd" aria-hidden="true">/</kbd>
          </label>
          <label className={`chip chip-pick ${styles.watch}`}>
            <input
              type="checkbox"
              checked={watchOnly}
              onChange={(e) => {
                setWatchOnly(e.target.checked);
                if (!e.target.checked) setWatchedLaunches(null);
              }}
            />
            Watchlist
          </label>
          <div className={`seg ${styles.sorts}`} role="radiogroup" aria-label="Sort">
            {SORTS.map((s) => (
              <label key={s.value}>
                <input type="radio" name="sort" value={s.value} checked={query.sort === s.value} onChange={() => change({ ...query, sort: s.value })} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.chips} role="radiogroup" aria-label="Paired with" data-scrolls>
          {[{ value: null, label: "All" }, ...KINDS].map((k) => (
            <label key={k.label} className="chip chip-pick">
              <input
                type="radio"
                name="kind"
                value={k.value ?? "all"}
                checked={query.category === k.value}
                onChange={() => change({ ...query, category: k.value })}
              />
              {k.label}
            </label>
          ))}
        </div>
        <div aria-busy={busy} data-board>
          {rows.length > 0 && (
            <CoinPanel>
              <CoinTable launches={rows} now={now} />
            </CoinPanel>
          )}
          {nothingMatches && (
            <div className={styles.empty}>
              <p className={styles.statement}>{nothingWatched ? "Star a coin to watch it." : "Nothing matches."}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
