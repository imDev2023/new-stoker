import type { QuoteRef } from "@launchpad/contract";
import { quoteTicker } from "@/lib/format";
import styles from "./Pair.module.css";

/** A coin's picture, or its first letter on the heat when it has none. */
export function CoinTile({ image, symbol, large = false }: { image: string | null; symbol: string; large?: boolean }) {
  const className = large ? "tile tile-lg" : "tile";
  // A coin's picture is the Creator's, on Arweave's gateway: shown as it is, never through an optimiser.
  return image ? <img className={className} src={image} alt="" loading="lazy" /> : <span className={className} aria-hidden="true">{symbol.slice(0, 1)}</span>;
}

/**
 * A coin's picture with the asset it is priced in as a badge on its corner: the pair, at a glance (the spec's pairTile).
 * Large on a coin's own page, where the badge grows with it.
 */
export function PairTile({ image, symbol, quote, large = false }: { image: string | null; symbol: string; quote: QuoteRef; large?: boolean }) {
  const ticker = quoteTicker(quote);
  return (
    <span className={large ? `${styles.tile} ${styles.large}` : styles.tile}>
      <CoinTile image={image} symbol={symbol} large={large} />
      <span className={styles.badge} title={ticker}>
        {quote.logo ? (
                  <img className={styles.asset} src={quote.logo} alt="" loading="lazy" />
        ) : (
          <span className={styles.asset} aria-hidden="true">{ticker.slice(0, 1)}</span>
        )}
      </span>
    </span>
  );
}

/** A pair as text: the coin in ink, the asset it is priced in in the accent. */
export function PairName({ symbol, quote }: { symbol: string; quote: QuoteRef }) {
  return (
    <>
      {symbol}
      {/* Where a narrow cell may break the pair: before the slash, never inside a ticker. */}
      <wbr />
      <span className={styles.quote}>/{quoteTicker(quote)}</span>
    </>
  );
}
