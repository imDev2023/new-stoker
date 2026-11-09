import Link from "next/link";
import styles from "./not-found.module.css";

/** No Quote Asset at this address: one sentence and the way back to every asset (the spec's asset page, empty). */
export default function AssetNotFound() {
  return (
    <section className={`shell ${styles.band}`}>
      <h1 className={styles.statement}>This asset isn&apos;t quoted.</h1>
      <Link className="button button-lg" href="/assets">All assets</Link>
    </section>
  );
}
