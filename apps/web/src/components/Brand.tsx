import Link from "next/link";
import { Ring } from "./Ring";
import styles from "./Brand.module.css";

/** The lockup: the ring and the name, linking home, in the header and the footer alike. */
export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link className={`${styles.brand} ${className}`} href="/" aria-label="Stoker home" data-brand>
      <Ring size={22} />
      <span data-brand-name>Stoker</span>
      {/* Review-only (#26, the second round): the caps wordmark with the ring as its O, the mark's verdict of
          2026-10-09, shown in place of the ring and the name by the candidates that set data-form. */}
      <span data-brand-caps aria-hidden="true">
        ST
        <Ring size={22} />
        KER
      </span>
    </Link>
  );
}
