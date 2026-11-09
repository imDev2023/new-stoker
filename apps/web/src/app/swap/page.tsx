import type { Metadata } from "next";
import Link from "next/link";
import { SwapWidget } from "@/components/SwapWidget";
import { JUPITER_REFERRAL } from "@/lib/jupiterReferral";
import { pageMeta } from "@/lib/meta";
import styles from "./page.module.css";

export const metadata: Metadata = pageMeta({
  path: "/swap",
  title: "Swap",
  description: "Any Solana token for any other, through Jupiter.",
});

/**
 * Swap (#9, the spec's swap page; owner 2026-10-30, a section of its own): Jupiter's swap under the page's one title,
 * and one line saying whose route it is. The fee's figure is the Fees page's alone (owner, 2026-10-30), so the line
 * links there, and only once a fee is charged.
 */
export default function SwapPage() {
  return (
    <>
      <div className={`shell page-head ${styles.head}`}>
        <h1>Swap</h1>
      </div>
      <div className={`shell ${styles.swap}`}>
        <SwapWidget />
        <p className={styles.note}>
          Routed by Jupiter.
          {JUPITER_REFERRAL && (
            <>
              {" "}Stoker takes a fee on each swap: <Link className="link" href="/fees#swap">every fee, explained</Link>.
            </>
          )}
        </p>
      </div>
    </>
  );
}
