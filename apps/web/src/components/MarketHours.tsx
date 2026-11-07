"use client";

import { useEffect, useState } from "react";
import { usMarket, type UsMarket } from "@/lib/stocks";
import styles from "./MarketHours.module.css";

/** How often the line is read again, so "open" turns "closed" on the minute the bell rings. */
const EVERY_MS = 60_000;

/** Reads the US market's state once mounted and then every minute; null before, since the server's clock isn't the visitor's. */
export function useUsMarket(): UsMarket | null {
  const [market, setMarket] = useState<UsMarket | null>(null);
  useEffect(() => {
    const read = () => setMarket(usMarket());
    read();
    const timer = window.setInterval(read, EVERY_MS);
    return () => window.clearInterval(timer);
  }, []);
  return market;
}

/**
 * The US market's state beside Solana's, which never closes (the spec's `marketHours`): open or closed, and when it next
 * closes or opens in New York time. Drawn in the browser alone, once it has read the clock, so the page never shows a
 * state the server guessed; `row` is a stock page's line under its head.
 */
export function MarketHours({ row = false }: { row?: boolean }) {
  const us = useUsMarket();
  if (!us) return null;
  return (
    <p className={`${styles.hours}${row ? ` ${styles.row}` : ""}`} data-hours>
      <span>
        <span className={`${styles.dot} ${us.open ? styles.open : ""}`} aria-hidden="true" />
        <span>
          US market <b>{us.open ? "open" : "closed"}</b>
          {us.next && <span className="muted"> · {us.next}</span>}
        </span>
      </span>
      <span>
        <span className={`${styles.dot} ${styles.open}`} aria-hidden="true" />
        <span>
          Solana <b>open</b>
        </span>
      </span>
    </p>
  );
}
