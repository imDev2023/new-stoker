import { QuoteCategory, type QuoteAsset, type QuoteIssuer, type QuoteMarket, type QuoteRef } from "@launchpad/contract";
import { KINDS } from "./board";
import { formatFigure, formatPrice } from "./format";

/**
 * Assets (#9; the spec is docs/design/playground/src/pages/assets.html and asset.html, `pages.assets` and `pages.asset`
 * in its app.js): every Quote Asset the Quote Registry quotes, grouped by kind and, for a tokenized stock, by its issuer,
 * searched and filtered by kind; and one asset's own page. The query lives in the page's address like the board's.
 */

/** The kind's name, in the spec's words (the board's chips). */
export const KIND_LABELS = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<QuoteCategory, string>;

/** The stock issuers by the ids the API gives them, in production's order (the spec's ISSUERS). */
export const ISSUER_LABELS: Record<QuoteIssuer, string> = { xstocks: "xStocks", prestocks: "PreStocks", tessera: "Tessera", backpack: "Backpack" };
const ISSUER_ORDER = Object.keys(ISSUER_LABELS) as QuoteIssuer[];

/** What a row of the directory needs, and no more: mainnet quotes some six hundred assets, all sent with the page. */
export type AssetRow = Pick<QuoteAsset, "mint" | "symbol" | "name" | "logo" | "category" | "issuer" | "launchable" | "liquidityUsd" | "decimals"> & {
  usd: string | null;
  graduation: string | null;
};

export const assetRow = (q: QuoteAsset): AssetRow => ({
  mint: q.mint,
  symbol: q.symbol,
  name: q.name,
  logo: q.logo,
  category: q.category,
  issuer: q.issuer,
  launchable: q.launchable,
  liquidityUsd: q.liquidityUsd,
  decimals: q.decimals,
  usd: q.price?.usd ?? null,
  graduation: q.graduationTarget?.raw ?? null,
});

export type AssetsQuery = { category: QuoteCategory | null; q: string };
export const DEFAULT_ASSETS: AssetsQuery = { category: null, q: "" };
export const ASSETS_SEARCH_MAX = 64;

/** The page's query from its address. Anything unknown falls back to the default, so an old link still shows assets. */
export function assetsQueryFrom(params: Record<string, string | string[] | undefined>): AssetsQuery {
  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const category = QuoteCategory.safeParse(one("category"));
  return { category: category.success ? category.data : null, q: (one("q") ?? "").trim().slice(0, ASSETS_SEARCH_MAX) };
}

/** The address's query string for a query, the defaults left out so the plain directory stays at /assets. */
export function assetsSearch(q: AssetsQuery) {
  const params = new URLSearchParams();
  if (q.category) params.set("category", q.category);
  if (q.q) params.set("q", q.q);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Assets matching a search by ticker, name or mint address, closest first: the exact ticker or mint, then a ticker that
 * starts with it, then any other match, each in the order given (production's search, so the same text finds the same
 * asset here and on the launch form).
 */
export function searchAssets<T extends Pick<QuoteRef, "mint" | "symbol" | "name">>(assets: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...assets];
  const rank = (a: T) => {
    const ticker = (a.symbol ?? "").toLowerCase();
    if (ticker === q || a.mint.toLowerCase() === q) return 0;
    if (ticker.startsWith(q)) return 1;
    if (ticker.includes(q) || (a.name ?? "").toLowerCase().includes(q) || a.mint.toLowerCase().startsWith(q)) return 2;
    return -1;
  };
  return assets
    .map((a, i) => ({ a, i, r: rank(a) }))
    .filter((x) => x.r >= 0)
    .sort((x, y) => x.r - y.r || x.i - y.i)
    .map((x) => x.a);
}

export type AssetGroup<T> = { key: string; label: string; assets: T[] };

/** A group's heading: the kind, and for a stock its issuer as well, "Stocks · xStocks". */
export function kindLabel(q: Pick<QuoteRef, "category" | "issuer">) {
  const kind = KIND_LABELS[q.category];
  return q.category === "tokenized_stock" && q.issuer ? `${kind} · ${ISSUER_LABELS[q.issuer]}` : kind;
}

/**
 * The assets in their groups, in the spec's order of kinds, and the stocks split by issuer in production's order (a stock
 * whose issuer isn't known last); a group with nothing in it is left out.
 */
export function groupAssets<T extends Pick<QuoteRef, "category" | "issuer">>(assets: readonly T[]): AssetGroup<T>[] {
  return KINDS.flatMap(({ value }) => {
    const ofKind = assets.filter((a) => a.category === value);
    if (value !== "tokenized_stock") return ofKind.length ? [{ key: value, label: KIND_LABELS[value], assets: ofKind }] : [];
    return [...ISSUER_ORDER, null].flatMap((issuer) => {
      const of = ofKind.filter((a) => (issuer === null ? !a.issuer || !ISSUER_ORDER.includes(a.issuer) : a.issuer === issuer));
      return of.length ? [{ key: `${value}-${issuer ?? "other"}`, label: kindLabel({ category: value, issuer }), assets: of }] : [];
    });
  });
}

/** A US dollar price: cents from a dollar up, as a broker shows a share's price; four significant digits below (the spec's money). */
export function formatUsd(usd: string | number) {
  const n = Number(usd);
  return n >= 1 ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : `$${formatPrice(n)}`;
}

/** A liquidity in US dollars, compact from 10,000 ($12.3M), as the spec's columns write it. */
export const formatLiquidity = (usd: number) => `$${formatFigure(usd)}`;

/** What a coin paired with the asset raises to graduate, in the asset: "12.8K USDC", or null without a target. */
export function graduationAmount(raw: string | null, decimals: number, ticker: string) {
  if (raw === null) return null;
  return `${formatFigure(Number(raw) / 10 ** decimals)} ${ticker}`;
}

const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export const tokenProgramName = (program: string) => (program === TOKEN_2022 ? "Token-2022" : "SPL Token");

/** The market chart's title (#124): the ticker and where TradingView quotes it, "NVDA on NASDAQ" or "SOLUSD across exchanges". */
export const marketTitle = (m: QuoteMarket) => (m.venue === "CRYPTO" ? `${m.ticker} across exchanges` : `${m.ticker} on ${m.venue}`);

/** TradingView's own chart of the market, offered when its widget can't load here. */
export const marketChartUrl = (m: QuoteMarket) => `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(m.symbol)}`;
