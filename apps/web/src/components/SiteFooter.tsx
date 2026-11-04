import Link from "next/link";
import { FOOTER_NOTICE, RISK_SENTENCE } from "@/lib/legal";
import { FOOTER_GROUPS, SITE_LINKS } from "@/lib/site";
import { Brand } from "./Brand";
import styles from "./SiteFooter.module.css";

/** The footer of every page: the lockup, the four groups, and the risk sentence every page ends with. */
export function SiteFooter() {
  return (
    <footer className={styles.foot}>
      <div className="shell">
        <div className={styles.grid}>
          <Brand className={styles.brand} />
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              {group.links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className={styles.legal}>
          <p>
            <strong>{RISK_SENTENCE}</strong> {FOOTER_NOTICE}
          </p>
          <p className={styles.row}>
            <span>© 2026 Stoker</span>
            <span className={styles.social}>
              <a href={SITE_LINKS.x.href}>{SITE_LINKS.x.label}</a>
              <a href={SITE_LINKS.telegram.href}>{SITE_LINKS.telegram.label}</a>
              <a href={`mailto:${SITE_LINKS.email}`}>{SITE_LINKS.email}</a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
