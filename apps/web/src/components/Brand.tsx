import Link from "next/link";
import { Ring } from "./Ring";
import styles from "./Brand.module.css";

/** The lockup: the ring and the name, linking home, in the header and the footer alike. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link className={`${styles.brand} ${className}`} href="/" aria-label="Stoker home">
      <Ring size={22} />
      Stoker
    </Link>
  );
}
