import type { Metadata } from "next";
import Link from "next/link";
import { Steps } from "@/components/Steps";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Curated",
  description: "Coins the platform has approved and works on with their teams, bought by the people who stake STOKER.",
};

/** The spec's three steps (`curated.html`), in production's words (owner, 2026-10-25, Stoker-Markets#118). */
const STEPS = [
  { title: "Stake STOKER", text: "Only a wallet that has staked can buy a Curated launch." },
  { title: "Your allocation follows your stake", text: "The more you stake, the more of each launch you can buy." },
  { title: "Every launch is approved first", text: "The platform works on each one with its team." },
];

/**
 * Curated (#12, the spec's `curated.html`): the platform's own approved launches, open to STOKER stakers. Nothing can
 * be staked before STOKER launches, so the page says how an allocation is earned and where the first launch is
 * announced, and sends a visitor to the board meanwhile.
 */
export default function CuratedPage() {
  return (
    <>
      <div className="shell page-head">
        <h1>Curated</h1>
        <span className="badge badge-gold">Soon</span>
      </div>
      <Steps label="How an allocation is earned" steps={STEPS} />
      <section className={`shell ${styles.band}`} aria-labelledby="first-title">
        <h2 id="first-title" className={styles.statement}>The first Curated launch is announced here.</h2>
        <Link className="button button-ghost button-lg" href="/coins">
          Explore coins
        </Link>
      </section>
    </>
  );
}
