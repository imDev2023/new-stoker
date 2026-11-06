import Link from "next/link";
import { Ring } from "./Ring";
import styles from "./Brand.module.css";

/**
 * The lockup: the caps STOKER with the ring as its O (the mark's verdict, 2026-10-09; E Furnace, #26), linking home, in
 * the header and the footer alike. The link's name is said once; the letters and the ring are hidden from it.
 */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link className={`${styles.brand} ${className}`} href="/" aria-label="Stoker home">
      <span className={styles.word} aria-hidden="true">
        ST
        <Ring size={22} />
        KER
      </span>
    </Link>
  );
}
