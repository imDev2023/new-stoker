"use client";

import { useEffect, useState } from "react";
import type { Candle } from "@launchpad/contract";
import { getQuoteCandles } from "@/lib/api";
import { LineChart } from "./LineChart";
import styles from "./StockChart.module.css";

/** The ranges, in hours of candles: the last day and the last five (the spec's 1D and 5D). */
const RANGES = [{ hours: 24, label: "1D" }, { hours: 120, label: "5D" }] as const;

/**
 * A stock token's own price over the last day or five, from the hourly candles the Quote Registry records (#3; the
 * spec's stock chart). Read in the browser, and left out until there are two hours to draw between: a young history
 * has one candle, and a flat placeholder would say the price has not moved.
 */
export function StockChart({ mint }: { mint: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [hours, setHours] = useState<number>(RANGES[0].hours);
  useEffect(() => {
    let live = true;
    void getQuoteCandles(mint).then(
      (list) => {
        if (live) setCandles(list.candles);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [mint]);
  if (candles.length < 2) return null;
  return (
    <section className="panel pad" aria-label="Price">
      <div className={`section-head ${styles.head}`}>
        <div className="seg" role="radiogroup" aria-label="Range">
          {RANGES.map((r) => (
            <label key={r.label}>
              <input type="radio" name="range" value={r.hours} checked={hours === r.hours} onChange={() => setHours(r.hours)} />
              {r.label}
            </label>
          ))}
        </div>
      </div>
      <LineChart candles={candles.slice(-hours)} />
    </section>
  );
}
