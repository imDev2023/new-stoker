import type { QuoteAsset, QuoteIssuer } from "@launchpad/contract";
import { ISSUER_LABELS } from "./assets";

/**
 * Stocks (#10; the spec is docs/design/playground/src/pages/stocks.html and stock.html, `pages.stocks` and `pages.stock`
 * in its app.js, and the US market's calendar in its lib.js): every tokenized stock the Quote Registry quotes, open on
 * Solana while the US market is shut, and one stock's own page. The list's query lives in the page's address like the
 * board's and the directory's.
 */

// The US stock market -------------------------------------------------------------------------------------------------

/**
 * The regular session of the NYSE and Nasdaq: 09:30 to 16:00 New York time on weekdays, shut on these holidays and
 * closing at 13:00 on the early days, from the exchanges' published calendars (the spec's lib.js, which covers 2026 and
 * 2027). Extend both lists each year: past their last day every weekday reads as a full session.
 */
export const US_HOLIDAYS: ReadonlySet<string> = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);
export const US_EARLY_CLOSES: ReadonlySet<string> = new Set(["2026-11-27", "2026-12-24", "2027-11-26"]);

const OPENS = 9 * 60 + 30;
const CLOSES = 16 * 60;
const CLOSES_EARLY = 13 * 60;

const newYork = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

type NewYorkDay = { date: string; weekday: string; minutes: number };

function inNewYork(at: Date): NewYorkDay {
  const p = Object.fromEntries(newYork.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday ?? "", minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const isTradingDay = ({ date, weekday }: NewYorkDay) => weekday !== "Sat" && weekday !== "Sun" && !US_HOLIDAYS.has(date);

export type UsMarket = { open: boolean; next: string };

/** Whether the US market's regular session is open at a moment, and when it next closes or opens, in New York time. */
export function usMarket(now = new Date()): UsMarket {
  const today = inNewYork(now);
  const closes = US_EARLY_CLOSES.has(today.date) ? CLOSES_EARLY : CLOSES;
  if (isTradingDay(today) && today.minutes >= OPENS && today.minutes < closes) {
    return { open: true, next: `closes ${closes === CLOSES_EARLY ? "13:00" : "16:00"} ET` };
  }
  // Calendar days from New York's today, each taken at midday UTC so a change of clocks never skips one.
  const [y, m, d] = today.date.split("-").map(Number) as [number, number, number];
  for (let i = 0; i < 14; i++) {
    const day = inNewYork(new Date(Date.UTC(y, m - 1, d + i, 17)));
    if (!isTradingDay(day) || (i === 0 && today.minutes >= OPENS)) continue;
    return { open: false, next: `opens ${i === 0 ? "" : `${day.weekday} `}09:30 ET` };
  }
  return { open: false, next: "" };
}

// A stock's figures ---------------------------------------------------------------------------------------------------

/** From how far either way a token's price is called wide of its stock's (the spec's highlight). */
export const WIDE_GAP = 0.01;

/**
 * A stock token's price against the stock it tracks, from the stock's last price, written to two decimals ("-0.83%"),
 * and whether it is wide (from 1% either way); null without both prices. A mint with scaled balances is priced here per
 * unscaled unit while the stock is per share, so for one the gap carries the issuer's multiplier too (#3's record).
 */
export function stockGap(s: Pick<QuoteAsset, "price" | "market">): { value: number; text: string; wide: boolean } | null {
  const last = s.market?.last?.price;
  const usd = Number(s.price?.usd ?? 0);
  if (!last || !usd) return null;
  const value = usd / last - 1;
  const text = `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })}%`;
  return { value, text, wide: Math.abs(value) >= WIDE_GAP };
}

/** A stock's day as a broker writes it, signed to two decimals, with its direction for the colour; empty when absent. */
export function formatStockChange(change: number | undefined): { text: string; direction: "up" | "down" | null } {
  if (change === undefined) return { text: "", direction: null };
  const text = `${(change * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })}%`;
  return { text, direction: change > 0 ? "up" : change < 0 ? "down" : null };
}

// The list ------------------------------------------------------------------------------------------------------------

/** What a row of the list needs, and no more: mainnet quotes a couple of hundred stocks, all sent with the page. */
export type StockRow = Pick<QuoteAsset, "mint" | "symbol" | "name" | "logo" | "issuer" | "liquidityUsd" | "change24h"> & {
  usd: string | null;
  /** The ticker of the stock it tracks, which the search also finds ("NVDA" finds NVDAx). */
  tracks: string | null;
  gap: { text: string; wide: boolean } | null;
};

export const isStock = (q: Pick<QuoteAsset, "category">) => q.category === "tokenized_stock";

export function stockRow(q: QuoteAsset): StockRow {
  const gap = stockGap(q);
  return {
    mint: q.mint,
    symbol: q.symbol,
    name: q.name,
    logo: q.logo,
    issuer: q.issuer,
    liquidityUsd: q.liquidityUsd,
    ...(q.change24h === undefined ? {} : { change24h: q.change24h }),
    usd: q.price?.usd ?? null,
    tracks: q.market?.ticker ?? null,
    gap: gap && { text: gap.text, wide: gap.wide },
  };
}

export const STOCK_SORTS = [
  { value: "liquidity", label: "Liquidity" },
  { value: "change", label: "24h change" },
  { value: "name", label: "A–Z" },
] as const;
export type StockSort = (typeof STOCK_SORTS)[number]["value"];

export type StocksQuery = { sort: StockSort; issuer: QuoteIssuer | null; q: string };
export const DEFAULT_STOCKS: StocksQuery = { sort: "liquidity", issuer: null, q: "" };
export const STOCKS_SEARCH_MAX = 64;

const ISSUERS = Object.keys(ISSUER_LABELS) as QuoteIssuer[];

/** The page's query from its address. Anything unknown falls back to the default, so an old link still shows stocks. */
export function stocksQueryFrom(params: Record<string, string | string[] | undefined>): StocksQuery {
  const one = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const sort = STOCK_SORTS.find((s) => s.value === one("sort"))?.value ?? DEFAULT_STOCKS.sort;
  const issuer = ISSUERS.find((i) => i === one("issuer")) ?? null;
  return { sort, issuer, q: (one("q") ?? "").trim().slice(0, STOCKS_SEARCH_MAX) };
}

/** The address's query string for a query, the defaults left out so the plain list stays at /stocks. */
export function stocksSearch(q: StocksQuery) {
  const params = new URLSearchParams();
  if (q.sort !== DEFAULT_STOCKS.sort) params.set("sort", q.sort);
  if (q.issuer) params.set("issuer", q.issuer);
  if (q.q) params.set("q", q.q);
  const s = params.toString();
  return s ? `?${s}` : "";
}

/** The spec's sorters: the deepest first, the day's biggest riser first, or by ticker; a missing figure goes last. */
const SORTERS: Record<StockSort, (a: StockRow, b: StockRow) => number> = {
  liquidity: (a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1),
  change: (a, b) => (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity),
  name: (a, b) => (a.symbol ?? "").localeCompare(b.symbol ?? ""),
};

/** The issuers the list holds, in production's order: the chips after "All". */
export const issuersOf = (stocks: readonly Pick<StockRow, "issuer">[]) => ISSUERS.filter((i) => stocks.some((s) => s.issuer === i));

/** The rows a query shows: of its issuer, matching its search by ticker, company, tracked ticker or mint, in its order. */
export function selectStocks(stocks: readonly StockRow[], query: StocksQuery): StockRow[] {
  const q = query.q.trim().toLowerCase();
  return stocks
    .filter((s) => query.issuer === null || s.issuer === query.issuer)
    .filter((s) => !q || [s.symbol, s.name, s.tracks, s.mint].some((v) => v?.toLowerCase().includes(q)))
    .sort(SORTERS[query.sort]);
}
