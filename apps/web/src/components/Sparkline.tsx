"use client";

import { useEffect, useState } from "react";
import type { Candle } from "@launchpad/contract";
import { getCandles } from "@/lib/api";
import styles from "./Sparkline.module.css";

/** How many hourly closes make the line: the last day. */
const HOURS = 24;

const lastDay = (candles: Candle[]) => candles.slice(-HOURS).map((c) => c.close);

/** Each coin's series read in the browser once a visit, however often its row is drawn again. */
const series = new Map<string, Promise<number[]>>();
function closesOf(mint: string) {
  let closes = series.get(mint);
  if (!closes) {
    closes = getCandles(mint, "1h").then((list) => lastDay(list.candles), () => []);
    series.set(mint, closes);
  }
  return closes;
}

/** The closes as points in a 100 by 28 drawing, the highest a pixel from the top and the lowest a pixel from the foot. */
function points(closes: number[]) {
  const lo = Math.min(...closes);
  const span = Math.max(...closes) - lo || 1;
  return closes.map((v, i) => `${(i / (closes.length - 1)) * 100},${26 - ((v - lo) / span) * 24}`).join(" ");
}

/**
 * A coin's last day as a line, from its hourly candles (the spec's `sparklines`): up or down by where it ends against
 * where it began. The page's own candles when it read them on the server, else read here. The drawing's box is always
 * there, empty until there are two hours to draw between (never a flat placeholder), so a shot can mask it whatever
 * hour the coins traded in. Decorative: the 24h change beside it says the same in figures.
 */
export function Sparkline({ mint, candles }: { mint: string; candles?: Candle[] }) {
  const [closes, setCloses] = useState<number[]>(() => (candles ? lastDay(candles) : []));
  useEffect(() => {
    if (candles) {
      setCloses(lastDay(candles));
      return;
    }
    let live = true;
    void closesOf(mint).then((c) => {
      if (live) setCloses(c);
    });
    return () => {
      live = false;
    };
  }, [mint, candles]);
  const drawn = closes.length >= 2;
  const direction = drawn ? (closes.at(-1)! >= closes[0]! ? styles.up : styles.down) : "";
  return (
    <svg className={`${styles.spark} ${direction}`} viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" data-spark={drawn ? "drawn" : "empty"}>
      {drawn && <polyline points={points(closes)} />}
    </svg>
  );
}
