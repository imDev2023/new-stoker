import Link from "next/link";
import type { Candle, LaunchSummary } from "@launchpad/contract";
import { formatChange, formatFigure, formatPriceCompact, quoteTicker } from "@/lib/format";
import { PairName, PairTile } from "./Pair";
import styles from "./CoinTable.module.css";

/** The last day as a line, from hourly closes; nothing when there are fewer than two. */
function Spark({ candles }: { candles: Candle[] | undefined }) {
  const closes = (candles ?? []).slice(-24).map((c) => c.close);
  if (closes.length < 2) return null;
  const lo = Math.min(...closes);
  const span = Math.max(...closes) - lo || 1;
  const points = closes.map((v, i) => `${(i / (closes.length - 1)) * 100},${26 - ((v - lo) / span) * 24}`).join(" ");
  const direction = closes.at(-1)! >= closes[0]! ? styles.up : styles.down;
  return (
    <svg className={`${styles.spark} ${direction}`} viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" data-spark>
      <polyline points={points} />
    </svg>
  );
}

/**
 * The coins table (the spec's coinTable): the pair and the name, the price in the asset it is priced in, the day's change,
 * the day's line, volume and market cap in SOL. Under 640px only the coin, its price and its change stay. Home shows it
 * compact, five rows with no curve or age; Explore's board (#6) adds those columns and the watchlist's stars.
 */
export function CoinTable({ launches, candles, label }: { launches: LaunchSummary[]; candles: Map<string, Candle[]>; label: string }) {
  return (
    <table className={`table ${styles.table}`} aria-label={label}>
      <thead>
        <tr>
          <th scope="col">Coin</th>
          <th scope="col" className="r">Price</th>
          <th scope="col" className="r">24h</th>
          <th scope="col" className={styles.wide}><span className="visually-hidden">Trend</span></th>
          <th scope="col" className={`r ${styles.wide}`}>Volume</th>
          <th scope="col" className={`r ${styles.wide}`}>Market cap</th>
        </tr>
      </thead>
      <tbody>
        {launches.map((l) => {
          const change = formatChange(l.market.change24h);
          return (
            <tr key={l.mint}>
              <td>
                <Link className={styles.coin} href={`/coin/${l.mint}`}>
                  <PairTile image={l.image} symbol={l.symbol} quote={l.quote} />
                  <span className={styles.names}>
                    <b><PairName symbol={l.symbol} quote={l.quote} /></b>
                    <span>{l.name}</span>
                  </span>
                </Link>
              </td>
              <td className="r">
                {l.market.price !== null && (
                  <>
                    {formatPriceCompact(l.market.price)} <span className={`muted ${styles.wide}`}>{quoteTicker(l.quote)}</span>
                  </>
                )}
              </td>
              <td className={`r ${change.direction ?? ""}`}>{change.text}</td>
              <td className={styles.wide}><Spark candles={candles.get(l.mint)} /></td>
              <td className={`r ${styles.wide}`}>{l.market.volume24h.sol ? `${formatFigure(l.market.volume24h.sol)} SOL` : ""}</td>
              <td className={`r ${styles.wide}`}>{l.market.marketCap?.sol ? `${formatFigure(l.market.marketCap.sol)} SOL` : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
