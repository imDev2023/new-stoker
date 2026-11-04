import type { QuoteRef } from "@launchpad/contract";
import { quoteTicker } from "@/lib/format";
import styles from "./PairTile.module.css";

/** A coin's picture, or its first letter on the heat when it has none (the spec's `tile`). */
export function CoinTile({ image, symbol, className = "tile" }: { image: string | null; symbol: string; className?: string }) {
  return image ? (
    // A coin's picture is wherever its metadata points, served as it is.
    <img className={className} src={image} alt="" loading="lazy" />
  ) : (
    <span className={className} aria-hidden="true">{symbol.slice(0, 1) || "?"}</span>
  );
}

/**
 * The pair at a glance, everywhere a coin appears (the spec's `pairTile`): the coin's picture with the asset it trades
 * in as a badge on its corner, the asset's logo or its first letter in ink. Decorative: the pair's name says it in words.
 */
export function PairTile({ image, symbol, quote }: { image: string | null; symbol: string; quote: Pick<QuoteRef, "mint" | "symbol" | "logo"> }) {
  const ticker = quoteTicker(quote);
  return (
    <span className={styles.pair} aria-hidden="true">
      <CoinTile image={image} symbol={symbol} />
      <span className={styles.badge} title={ticker}>
        <CoinTile image={quote.logo} symbol={ticker} className={`tile ${styles.quote}`} />
      </span>
    </span>
  );
}

/** A pair as text (the spec's `pairName`): the coin in ink, the asset it trades in in the accent. */
export function PairName({ symbol, quote }: { symbol: string; quote: Pick<QuoteRef, "mint" | "symbol"> }) {
  return (
    <>
      {symbol}
      <span className={styles.quoteName}>/{quoteTicker(quote)}</span>
    </>
  );
}
