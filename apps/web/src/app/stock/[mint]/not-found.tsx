import Link from "next/link";
import styles from "./not-found.module.css";

/** No tokenized stock at this address: one sentence and the way back to every stock (the spec's stock page, empty). */
export default function StockNotFound() {
  return (
    <section className={`shell ${styles.band}`}>
      <h1 className={styles.statement}>This stock isn&apos;t listed.</h1>
      <Link className="button button-lg" href="/stocks">All stocks</Link>
    </section>
  );
}
