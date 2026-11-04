"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { LaunchSummary } from "@launchpad/contract";
import { formatAge, formatChange } from "@/lib/board";
import { formatFigure, formatPriceCompact, quoteTicker } from "@/lib/format";
import { toggleWatch, useWatchlist } from "@/lib/watchlist";
import { PairName, PairTile } from "./PairTile";
import { Sparkline } from "./Sparkline";
import styles from "./CoinTable.module.css";

/** How many rows read their trend line: each is one request, and the rows below the first screens are rarely looked at. */
const TRENDS = 20;

const sol = (n: number | null | undefined) => (n ? `${formatFigure(n)} SOL` : "");

/**
 * The coins table (the spec's `coinTable`): Explore's board, and in its compact form the home page's five and an
 * asset's coins. Each row is the pair (the coin's picture with the asset's badge, the asset in the accent), its price in
 * that asset, the day's change and trend line, volume and market cap in SOL, and on the board the watch star, the curve
 * toward Graduation and the coin's age. A figure the API doesn't have yet is left blank, never a zero. `now` is the
 * clock the ages are read against, the server's at render, so the page hydrates to the text it was sent.
 */
export function CoinTable({ launches, now, compact = false, label = "Coins" }: {
  launches: readonly LaunchSummary[];
  now: number;
  compact?: boolean;
  label?: string;
}) {
  const watched = useWatchlist();
  return (
    <table className={`table ${styles.table}`} aria-label={label}>
      <thead>
        <tr>
          {!compact && <th scope="col" className={styles.starCell}><span className="visually-hidden">Watch</span></th>}
          <th scope="col">Coin</th>
          <th scope="col" className="r">Price</th>
          <th scope="col" className={`r ${styles.hideSm}`}>24h</th>
          <th scope="col" className={styles.hideSm}><span className="visually-hidden">Trend</span></th>
          <th scope="col" className={`r ${styles.hideSm}`}>Volume</th>
          <th scope="col" className={`r ${styles.hideSm}`}>Market cap</th>
          {!compact && <th scope="col" className={`r ${styles.hideSm}`}>Curve</th>}
          {!compact && <th scope="col" className={`r ${styles.hideSm}`}>Age</th>}
        </tr>
      </thead>
      <tbody>
        {launches.map((l, i) => {
          const change = formatChange(l.market.change24h);
          const share = Math.min(1, Number(l.curve.raised) / Number(l.graduationTarget));
          const isWatched = watched.includes(l.mint);
          return (
            <tr key={l.mint} data-mint={l.mint}>
              {!compact && (
                <td className={styles.starCell}>
                  <button
                    type="button"
                    className={styles.star}
                    aria-pressed={isWatched}
                    aria-label={`Watch ${l.symbol}`}
                    onClick={() => toggleWatch(l.mint)}
                  />
                </td>
              )}
              <td className={styles.coinCell}>
                <Link className={styles.coin} href={`/coin/${l.mint}`}>
                  <PairTile image={l.image} symbol={l.symbol} quote={l.quote} />
                  <span className={styles.names}>
                    <b><PairName symbol={l.symbol} quote={l.quote} /></b>
                    <span>{l.name}</span>
                  </span>
                </Link>
              </td>
              <td className="r num">
                {l.market.price !== null && (
                  <>
                    {formatPriceCompact(l.market.price)} <span className={`muted ${styles.hideSm}`}>{quoteTicker(l.quote)}</span>
                  </>
                )}
                {/* On a phone the day's change sits under the price, so the coin keeps room for its name. */}
                {change && <span className={`${styles.phoneChange} ${change.direction ?? ""}`}>{change.text}</span>}
              </td>
              <td className={`r num ${styles.hideSm} ${change?.direction ?? ""}`}>{change?.text}</td>
              <td className={styles.hideSm}>
                {i < TRENDS && <Sparkline mint={l.mint} />}
              </td>
              <td className={`r num ${styles.hideSm}`}>{sol(l.market.volume24h.sol)}</td>
              <td className={`r num ${styles.hideSm}`}>{sol(l.market.marketCap?.sol)}</td>
              {!compact && (
                <td className={`r ${styles.hideSm}`}>
                  {l.graduation ? (
                    <span className="badge badge-gold">Graduated</span>
                  ) : (
                    <span
                      className={`progress ${styles.curve}`}
                      role="progressbar"
                      aria-label="Toward Graduation"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(share * 100)}
                    >
                      <span style={{ "--value": `${(share * 100).toFixed(1)}%` } as CSSProperties} />
                    </span>
                  )}
                </td>
              )}
              {!compact && (
                <td className={`r muted ${styles.hideSm}`}>
                  <time dateTime={l.createdAt}>{formatAge(l.createdAt, now)}</time>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The table in its panel, which scrolls sideways where the window is too narrow for every column. */
export function CoinPanel({ children }: { children: ReactNode }) {
  return <div className={`panel table-wrap ${styles.wrap}`} data-scrolls>{children}</div>;
}
