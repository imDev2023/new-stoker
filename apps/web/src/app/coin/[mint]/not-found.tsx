import Link from "next/link";
import styles from "./not-found.module.css";

/** A coin the API doesn't know (the spec's empty state for the coin page). */
export default function CoinNotFound() {
  return (
    <section className={`shell ${styles.band}`}>
      <h1 className={styles.statement}>This coin isn&apos;t here.</h1>
      <Link className="button button-lg" href="/coins">
        Explore coins
      </Link>
    </section>
  );
}
