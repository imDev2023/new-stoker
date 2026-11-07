import type { QuoteAsset } from "@launchpad/contract";
import { quoteTicker } from "@/lib/format";
import styles from "./RiskLabels.module.css";

/**
 * A Quote Asset's Quote Risk Labels as a panel (the spec's `labelList`), for an asset's page and a stock's: each label
 * with its detail and where it was read, cautions in the warning badge; a plain line when there is nothing to flag, and
 * another while the registry has not checked the mint yet.
 */
export function RiskLabels({ quote }: { quote: Pick<QuoteAsset, "mint" | "symbol" | "labels"> }) {
  const ticker = quoteTicker(quote);
  return (
    <section className="panel pad" aria-labelledby="labels-title">
      <div className="section-head">
        <h2 id="labels-title">Risk labels</h2>
      </div>
      <ul className={styles.labels}>
        {quote.labels === null ? (
          <li><p>{ticker} has not been checked yet.</p></li>
        ) : quote.labels.length === 0 ? (
          <li><p>Nothing to flag: no issuer authority over wallets, no transfer fee, and on the verified list.</p></li>
        ) : (
          quote.labels.map((l) => (
            <li key={l.kind}>
              <span className={`badge ${l.severity === "caution" ? "badge-warn" : ""}`}>{l.title}</span>
              <p>{l.detail}</p>
              <p className={styles.source}>{l.source}</p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
