"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Candle, LaunchSummary } from "@launchpad/contract";
import { formatAge } from "@/lib/board";
import { formatChange, formatFigure, formatPriceCompact, quoteTicker } from "@/lib/format";
import { toggleWatch, useWatchlist } from "@/lib/watchlist";
import { PairName, PairTile } from "./Pair";
import { Sparkline } from "./Sparkline";
import styles from "./CoinTable.module.css";

/** How many rows read their own trend line when the page hasn't: each is one request, and the rows far down are rarely looked at. */
const TRENDS = 20;

const sol = (n: number | null | undefined) => (n ? `${formatFigure(n)} SOL` : "");

/**
 * The coins table (the spec's coinTable): the pair and the name, the price in the asset it is priced in, the day's
 * change and line, volume and market cap in SOL. Home shows it `compact`, its trending five; Explore's board adds the
 * watch star, the curve toward Graduation and the coin's age, and on a phone puts the day's change under the price, so
 * the star's column leaves the coin room for its name. A figure the API doesn't have yet is left blank, never a zero.
 * `candles` are the lines a page read on the server; without them the first rows read their own in the browser. `now`
 * is the clock the board's ages are read against, the server's at render, so the page hydrates to the text it was sent.
 */
export function CoinTable({ launches, label, compact = false, candles, now = 0 }: {
  launches: readonly LaunchSummary[];
  label: string;
  compact?: boolean;
  candles?: Map<string, Candle[]>;
  now?: number;
}) {
  const watched = useWatchlist();
  const board = !compact;
  // On the board's phone layout the change moves under the price; Home keeps it a column of its own.
  const changeColumn = board ? `r ${styles.wide}` : "r";
  return (
    <table className={`table ${styles.table}`} aria-label={label}>
      <thead>
        <tr>
          {board && <th scope="col" className={styles.starCell}><span className="visually-hidden">Watch</span></th>}
          <th scope="col">Coin</th>
          <th scope="col" className="r">Price</th>
          <th scope="col" className={changeColumn}>24h</th>
          <th scope="col" className={styles.wide}><span className="visually-hidden">Trend</span></th>
          <th scope="col" className={`r ${styles.wide}`}>Volume</th>
          <th scope="col" className={`r ${styles.wide}`}>Market cap</th>
          {board && <th scope="col" className={`r ${styles.wide}`}>Curve</th>}
          {board && <th scope="col" className={`r ${styles.age} ${styles.wide}`}>Age</th>}
        </tr>
      </thead>
      <tbody>
        {launches.map((l, i) => {
          const change = formatChange(l.market.change24h);
          const share = Math.min(1, Number(l.curve.raised) / Number(l.graduationTarget));
          return (
            <tr key={l.mint} data-mint={l.mint}>
              {board && (
                <td className={styles.starCell}>
                  <button
                    type="button"
                    className={styles.star}
                    aria-pressed={watched.includes(l.mint)}
                    aria-label={`Watch ${l.symbol}`}
                    onClick={() => toggleWatch(l.mint)}
                  />
                </td>
              )}
              <td className={board ? styles.coinCell : undefined}>
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
                {board && change.text && <span className={`${styles.phoneChange} ${change.direction ?? ""}`}>{change.text}</span>}
              </td>
              <td className={`${changeColumn} ${change.direction ?? ""}`}>{change.text}</td>
              <td className={styles.wide}>
                {candles ? <Sparkline mint={l.mint} candles={candles.get(l.mint) ?? []} /> : i < TRENDS && <Sparkline mint={l.mint} />}
              </td>
              <td className={`r ${styles.wide}`}>{sol(l.market.volume24h.sol)}</td>
              <td className={`r ${styles.wide}`}>{sol(l.market.marketCap?.sol)}</td>
              {board && (
                <td className={`r ${styles.wide}`}>
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
              {board && (
                <td className={`r muted ${styles.age} ${styles.wide}`}>
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
