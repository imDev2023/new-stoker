import { LAUNCH_SEARCH_MAX, LaunchSort, QuoteCategory } from "@launchpad/contract";

/**
 * Explore's board (#6; the spec is docs/design/playground/src/pages/coins.html and `pages.coins` in its app.js): every
 * coin, searched, sorted and filtered by the kind of asset it is paired with. The query lives in the page's address, so
 * a sorted or filtered board can be shared and survives a reload, as production's did; the watchlist is the viewer's
 * own and stays in their browser (lib/watchlist.ts).
 */

/** The sorts in the order the toolbar shows them, with the spec's names. */
export const SORTS: readonly { value: LaunchSort; label: string }[] = [
  { value: "market_cap", label: "Market cap" },
  { value: "new", label: "Newest" },
  { value: "trending", label: "Volume" },
  { value: "graduation", label: "Near graduation" },
];

/** The "Paired with" chips: every kind of Quote Asset in the spec's order and words, the money first, the long tail last. */
export const KINDS: readonly { value: QuoteCategory; label: string }[] = [
  { value: "sol", label: "Solana" },
  { value: "stablecoin", label: "Currencies" },
  { value: "tokenized_stock", label: "Stocks" },
  { value: "wrapped", label: "Wrapped" },
  { value: "defi", label: "DeFi" },
  { value: "rwa", label: "Real-world assets" },
  { value: "leveraged", label: "Leverage" },
  { value: "collectible", label: "Collectibles" },
  { value: "meme", label: "Memes" },
  { value: "community", label: "Community" },
];

export type BoardQuery = { sort: LaunchSort; category: QuoteCategory | null; q: string };

export const DEFAULT_BOARD: BoardQuery = { sort: "market_cap", category: null, q: "" };

/** The longest search the API takes. */
export const SEARCH_MAX = LAUNCH_SEARCH_MAX;

/** The board's query from the page's address. Anything unknown falls back to the default, so an old or mangled link still shows coins. */
export function boardQueryFrom(params: Record<string, string | string[] | undefined>): BoardQuery {
  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = LaunchSort.safeParse(one("sort"));
  const category = QuoteCategory.safeParse(one("category"));
  return {
    sort: sort.success ? sort.data : DEFAULT_BOARD.sort,
    category: category.success ? category.data : null,
    q: (one("q") ?? "").trim().slice(0, SEARCH_MAX),
  };
}

/** The address's query string for a board query, leaving out the defaults so the plain board stays at /coins. */
export function boardSearch(q: BoardQuery) {
  const params = new URLSearchParams();
  if (q.sort !== DEFAULT_BOARD.sort) params.set("sort", q.sort);
  if (q.category) params.set("category", q.category);
  if (q.q) params.set("q", q.q);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const sameQuery = (a: BoardQuery, b: BoardQuery) => a.sort === b.sort && a.category === b.category && a.q === b.q;

/** Whether a query narrows the board, so an empty answer means "nothing matches" rather than "nothing launched". */
export const isFiltered = (q: BoardQuery) => q.category !== null || q.q !== "";

/** How long ago, in the spec's one-letter units for a table cell: now, 8m, 3h, 2d. */
export function formatAge(iso: string, now = Date.now()) {
  const s = (now - Date.parse(iso)) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}
