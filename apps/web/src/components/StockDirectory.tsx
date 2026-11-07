"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ISSUER_LABELS, formatLiquidity, formatUsd } from "@/lib/assets";
import { quoteTicker } from "@/lib/format";
import { SITE_SEARCH_ATTRIBUTE } from "@/lib/search";
import { formatStockChange, issuersOf, selectStocks, STOCK_SORTS, STOCKS_SEARCH_MAX, stocksSearch, type StockRow, type StocksQuery } from "@/lib/stocks";
import { AssetTile } from "./AssetTile";
import { MarketHours } from "./MarketHours";
import { Sparkline } from "./Sparkline";
import styles from "./StockDirectory.module.css";

/** How many rows read their own trend line: each is one request, and the rows far down are rarely looked at (CoinTable's). */
const TRENDS = 20;

/**
 * Stocks (#10, the spec's stocks page): the US market's hours beside Solana's, a search, the sort, the issuers as chips,
 * and every tokenized stock the Quote Registry quotes in one table: its price, the day's change and line, its gap to the
 * stock it tracks (in the gold from 1% either way), its liquidity and its issuer. Every control is there before the
 * registry answers (the owner's rule of 2026-10-07) except what has nothing to choose between: the "24h change" sort
 * waits for a stock with a change and the chips for a stock with an issuer, as the spec has them. The query lives in
 * the address (`?sort=`, `?issuer=`, `?q=`) and the search is the page's own, so "/" and ⌘K focus it here. A figure
 * the registry doesn't have is left blank, never a zero.
 */
export function StockDirectory({ stocks, initialQuery }: { stocks: StockRow[]; initialQuery: StocksQuery }) {
  const [query, setQuery] = useState(initialQuery);
  const chips = useRef<HTMLDivElement>(null);
  const hasChange = stocks.some((s) => s.change24h !== undefined);
  const sorts = STOCK_SORTS.filter((s) => s.value !== "change" || hasChange);
  const sort = sorts.some((s) => s.value === query.sort) ? query.sort : "liquidity";
  const issuers = issuersOf(stocks);
  const rows = useMemo(() => selectStocks(stocks, { ...query, sort }), [stocks, query, sort]);

  // On a phone the chips slide sideways: the chosen issuer is brought into the row's view, the row alone scrolled.
  useEffect(() => {
    const row = chips.current;
    const chosen = row?.querySelector<HTMLElement>("label:has(input:checked)");
    if (!row || !chosen || row.scrollWidth <= row.clientWidth) return;
    const left = chosen.offsetLeft;
    if (left < row.scrollLeft || left + chosen.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = left - 16;
  }, [query.issuer]);

  function change(next: StocksQuery) {
    setQuery(next);
    window.history.replaceState(null, "", `${window.location.pathname}${stocksSearch(next)}`);
  }

  return (
    <>
      <div className="shell page-head">
        <h1>Stocks</h1>
        <MarketHours />
      </div>
      <div className={`shell section ${styles.directory}`}>
        <div className="toolbar">
          <label className="search">
            <span className="visually-hidden">Search</span>
            <input
              className="input"
              type="search"
              placeholder="Company or ticker"
              maxLength={STOCKS_SEARCH_MAX}
              autoComplete="off"
              spellCheck={false}
              value={query.q}
              onChange={(e) => change({ ...query, q: e.target.value.slice(0, STOCKS_SEARCH_MAX) })}
              {...{ [SITE_SEARCH_ATTRIBUTE]: "" }}
            />
            <kbd className="kbd" aria-hidden="true">/</kbd>
          </label>
          <div className="seg" role="radiogroup" aria-label="Sort">
            {sorts.map((s) => (
              <label key={s.value}>
                <input type="radio" name="sort" value={s.value} checked={sort === s.value} onChange={() => change({ ...query, sort: s.value })} />
                {s.label}
              </label>
            ))}
          </div>
        </div>
        {issuers.length > 0 && (
          <div ref={chips} className={styles.chips} role="radiogroup" aria-label="Issuer" data-scrolls>
            {[null, ...issuers].map((i) => (
              <label key={i ?? "all"} className="chip chip-pick">
                <input type="radio" name="issuer" value={i ?? "all"} checked={query.issuer === i} onChange={() => change({ ...query, issuer: i })} />
                {i ? ISSUER_LABELS[i] : "All"}
              </label>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <div className={`panel table-wrap ${styles.wrap}`} data-scrolls>
            <table className={`table ${styles.table}`} aria-label="Stocks">
              <thead>
                <tr>
                  <th scope="col">Stock</th>
                  <th scope="col" className="r">Price</th>
                  <th scope="col" className="r">24h</th>
                  <th scope="col" className={styles.wide}><span className="visually-hidden">Trend</span></th>
                  <th scope="col" className={`r ${styles.wide}`}>vs stock</th>
                  <th scope="col" className={`r ${styles.wide}`}>Liquidity</th>
                  <th scope="col" className={styles.wide}>Issuer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const day = formatStockChange(s.change24h);
                  return (
                    <tr key={s.mint} data-mint={s.mint}>
                      <td>
                        <Link className={styles.stock} href={`/stock/${s.mint}`}>
                          <AssetTile quote={s} />
                          <span className={styles.names}>
                            <b>{quoteTicker(s)}</b>
                            {s.name && <span>{s.name}</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="r">{s.usd ? formatUsd(s.usd) : ""}</td>
                      <td className={`r ${day.direction ?? ""}`}>{day.text}</td>
                      <td className={styles.wide}>{i < TRENDS && <Sparkline mint={s.mint} source="quote" />}</td>
                      <td className={`r ${styles.wide} ${s.gap?.wide ? styles.gapWide : "muted"}`}>{s.gap?.text ?? ""}</td>
                      <td className={`r ${styles.wide}`}>{s.liquidityUsd ? formatLiquidity(s.liquidityUsd) : ""}</td>
                      <td className={styles.wide}>{s.issuer && <span className="badge">{ISSUER_LABELS[s.issuer]}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* The registry answered, but nothing it quotes matches: one sentence, as the board says it. */}
        {rows.length === 0 && stocks.length > 0 && (
          <div className={styles.empty}>
            <p className={styles.statement}>Nothing matches.</p>
          </div>
        )}
      </div>
    </>
  );
}
