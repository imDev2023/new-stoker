"use client";

import { formatUsd } from "@/lib/assets";
import { useUsMarket } from "./MarketHours";
import styles from "./StockUnder.module.css";

/**
 * The line under a stock's price: the stock it tracks at its last price, "closed at" while the US market is shut, and
 * the token's gap to it, in the gold from 1% either way (the spec's `data-stock-under`). Drawn once the browser has read
 * the clock, like the hours line, so it never says "closed" on the server's guess.
 */
export function StockUnder({ ticker, last, gap }: { ticker: string; last: number; gap: { text: string; wide: boolean } }) {
  const us = useUsMarket();
  if (!us) return null;
  return (
    <span className={`${styles.under}${gap.wide ? ` ${styles.wide}` : ""}`} data-stock-under data-wide={gap.wide || undefined}>
      {ticker} {us.open ? "" : "closed at "}{formatUsd(last)} · {gap.text} vs stock
    </span>
  );
}
