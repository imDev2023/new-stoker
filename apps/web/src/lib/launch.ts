import { LINK_KINDS, type LinkKind, type QuoteAsset, type QuoteIssuer } from "@launchpad/contract";
import { COIN_DECIMALS, COIN_SUPPLY, quoteTicker } from "./format";
import { KINDS } from "./board";

/**
 * The launch form (#8; the spec is docs/design/playground/src/pages/launch.html and `pages.launch` in its app.js), with
 * production's behaviour (`12dbc10:apps/web/src/components/LaunchForm.tsx`): what the form needs that is not a component.
 */

export { LINK_KINDS, type LinkKind };

/** Each link kind as the site names it and the address its field starts with. */
export const LINK_INFO: Record<LinkKind, { label: string; placeholder: string }> = {
  telegram: { label: "Telegram", placeholder: "https://t.me/" },
  x: { label: "X", placeholder: "https://x.com/" },
  website: { label: "Website", placeholder: "https://" },
  discord: { label: "Discord", placeholder: "https://discord.gg/" },
  tiktok: { label: "TikTok", placeholder: "https://tiktok.com/@" },
  instagram: { label: "Instagram", placeholder: "https://instagram.com/" },
  youtube: { label: "YouTube", placeholder: "https://youtube.com/@" },
};

/** The kinds the form shows, the spec's three; the other four wait behind "More links" (owner, 2026-11-02). */
export const FIRST_LINKS: readonly LinkKind[] = ["telegram", "x", "website"];
export const MORE_LINKS: readonly LinkKind[] = LINK_KINDS.filter((k) => !FIRST_LINKS.includes(k));

export const NAME_MAX = 32;
export const SYMBOL_MAX = 10;
export const DESCRIPTION_MAX = 1000;

/** A ticker as the contract takes it: capitals, digits and $, at most ten. */
export const cleanSymbol = (text: string) => text.toUpperCase().replace(/[^A-Z0-9$]/g, "").slice(0, SYMBOL_MAX);

/**
 * The recommended three ahead of the hundreds (production's, after docs/design/history/layout.md): SOL, the deepest
 * stablecoin and the deepest stock, which the registry's order (deepest first) picks out.
 */
export function recommendedQuotes(quotes: QuoteAsset[]): QuoteAsset[] {
  const first = (category: QuoteAsset["category"]) => quotes.find((q) => q.category === category && q.launchable);
  return [first("sol"), first("stablecoin"), first("tokenized_stock")].filter((q): q is QuoteAsset => q !== undefined);
}

const ISSUER_LABELS: Record<QuoteIssuer, string> = { xstocks: "xStocks", prestocks: "PreStocks", tessera: "Tessera", backpack: "Backpack" };

/** What kind of asset it is, as the option's badge says: its issuer for a stock, its kind (Explore's words) otherwise. */
export function kindLabel(q: QuoteAsset) {
  return q.issuer ? ISSUER_LABELS[q.issuer] : (KINDS.find((k) => k.value === q.category)?.label ?? "");
}

/** An asset in the picker's list: its ticker, and its name where that says more (many tickers are shared). */
export function quoteOption(q: QuoteAsset) {
  const ticker = quoteTicker(q);
  return q.name && q.name.toLowerCase() !== ticker.toLowerCase() ? `${ticker} (${q.name})` : ticker;
}

/** A share of the supply, to two decimals: 34,567,890 coins is 3.46%. */
export function supplyShare(raw: bigint) {
  const basisPoints = Number((raw * 10_000n) / (BigInt(COIN_SUPPLY) * 10n ** BigInt(COIN_DECIMALS)));
  return `${(basisPoints / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** The launch type the form offers: a standard coin, or a Reward Launch paid in the coin or in its Quote Asset. */
export type LaunchKind = "standard" | "coin" | "quote";

/**
 * Turns a failed simulation into something the Creator can act on. `payingQuote` is the Quote Asset's ticker when the
 * launch's first buy spends a Quote Asset other than SOL from the wallet, whose shortfall reads like SOL's otherwise.
 */
export function simulationError(text: string, payingQuote: string | null) {
  if (payingQuote && /insufficient funds|"Custom":1\b/.test(text) && !/insufficient lamports|InsufficientFundsForRent/.test(text))
    return `Your wallet doesn't have enough ${payingQuote} for your first buy. Add ${payingQuote} or buy less.`;
  if (/insufficient (lamports|funds)|InsufficientFundsForRent|0x1\b|"Custom":1\b/.test(text))
    return "Your wallet doesn't have enough SOL to pay for the launch. Add SOL and try again.";
  if (/AccountNotFound/.test(text)) return "Your wallet has no SOL yet. Add SOL and try again.";
  return "The launch would fail on-chain, so nothing was sent. Try again in a moment.";
}

// LaunchLab's ExceededSlippage: the First Buy would get fewer coins than quoted, which only happens if the fees changed.
const EXCEEDED_SLIPPAGE = 6004;

/** Why a launch that reached the chain failed there. Nothing was created: the launch and its First Buy are one transaction. */
export function onChainError(text: string) {
  if (text.includes(`"Custom":${EXCEEDED_SLIPPAGE}`))
    return "Your first buy would have got fewer coins than quoted, because the fees changed. Nothing was created; try again.";
  if (/"Custom":1\b|InsufficientFunds/.test(text)) return "Your wallet didn't have enough SOL for the launch. Nothing was created; add SOL and try again.";
  return "The launch transaction failed on-chain. Nothing was created; try again.";
}
