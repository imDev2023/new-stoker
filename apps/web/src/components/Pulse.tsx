"use client";

import { usePathname } from "next/navigation";
import type { PlatformStats } from "@launchpad/contract";
import { formatCount, formatFigure } from "@/lib/format";
import styles from "./Pulse.module.css";

/**
 * The platform's figures now (the spec's live strip), on every page but home, each shown only once it is real and
 * not zero, and the strip itself only when one is. The spec's fourth figure, what Creators have been paid, needs the
 * Ledger's totals priced in SOL, which GET /v1/stats does not serve yet, so it waits for the API.
 */
export function Pulse({ stats }: { stats: PlatformStats | null }) {
  const home = usePathname() === "/";
  const items = [
    ["24h volume", stats?.volume24h.sol ? `${formatFigure(stats.volume24h.sol)} SOL` : null],
    ["Coins", stats?.launches ? formatCount(stats.launches) : null],
    ["Graduated", stats?.graduated ? formatCount(stats.graduated) : null],
  ].filter((item): item is [string, string] => item[1] !== null);
  if (home || items.length === 0) return null;
  return (
    <div className={styles.pulse} data-pulse>
      <dl className={`shell ${styles.row}`} aria-label="Platform now" data-scrolls>
        {items.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
