import type { QuoteRef } from "@launchpad/contract";
import { quoteTicker } from "@/lib/format";
import styles from "./AssetTile.module.css";

/**
 * A Quote Asset's logo, or its first letter, on a round tile in ink (the spec's `.asset-tile`): a coin's tile is square
 * on the heat, an asset's round, so the two never read as one another. `xl` is the asset page's head.
 */
export function AssetTile({ quote, xl = false }: { quote: Pick<QuoteRef, "mint" | "symbol" | "logo">; xl?: boolean }) {
  const className = `tile ${styles.asset}${xl ? ` ${styles.xl}` : ""}`;
  // The logo is the token list's, shown as it is, never through an optimiser.
  return quote.logo ? (
    <img className={className} src={quote.logo} alt="" loading={xl ? undefined : "lazy"} />
  ) : (
    <span className={className} aria-hidden="true">{quoteTicker(quote).slice(0, 1)}</span>
  );
}
