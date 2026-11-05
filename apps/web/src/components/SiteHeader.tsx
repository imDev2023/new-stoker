import Link from "next/link";
import { LAUNCH_LINK, NAV_LINKS } from "@/lib/site";
import { Brand } from "./Brand";
import { NavLinks } from "./NavLinks";
import { WalletButton } from "./WalletButton";
import styles from "./SiteHeader.module.css";

/** The header of every page (docs/design/playground/src/layout.html). */
export function SiteHeader() {
  return (
    <header className={styles.bar} data-site-header>
      <div className={`shell ${styles.row}`}>
        <Brand />
        <nav className={styles.nav} aria-label="Sections">
          <NavLinks links={NAV_LINKS} />
        </nav>
        <div className={styles.actions}>
          <WalletButton />
          <Link className="button" href={LAUNCH_LINK.href}>
            {LAUNCH_LINK.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
