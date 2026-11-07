import type { Candle } from "@launchpad/contract";
import styles from "./LineChart.module.css";

/**
 * The price as a line with a soft fill under it, from the closes of the candles given (the spec's lineChart), for a
 * coin's page and a stock's. A single candle is drawn from its open to its close, so a market whose prices all fell in
 * one interval still has its line; with none, the drawing stays empty.
 */
export function LineChart({ candles }: { candles: Candle[] }) {
  const closes = candles.length === 1 ? [candles[0]!.open, candles[0]!.close] : candles.map((c) => c.close);
  let body = null;
  if (closes.length >= 2) {
    const lo = Math.min(...closes);
    const span = Math.max(...closes) - lo || 1;
    const points = closes.map((v, i) => `${(i / (closes.length - 1)) * 100},${92 - ((v - lo) / span) * 84}`).join(" ");
    body = (
      <>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity=".12" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon className={styles.fill} points={`0,100 ${points} 100,100`} />
        <polyline className={styles.line} points={points} />
      </>
    );
  }
  return (
    <svg className={styles.chart} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" data-chart>
      {body}
    </svg>
  );
}
