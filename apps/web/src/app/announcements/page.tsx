import type { Metadata } from "next";
import Link from "next/link";
import { getPlatform, listAnnouncements } from "@/lib/api";
import { pct } from "@/lib/fees";
import { explorerUrl, formatDate } from "@/lib/format";
import { pageMeta } from "@/lib/meta";
import styles from "./page.module.css";

export const metadata: Metadata = pageMeta({
  path: "/announcements",
  title: "Fee changes",
  description: "Every change to the Platform Fee and Creator Fee, announced at least a day ahead, with its transaction once applied.",
});

/**
 * Fee changes (#11, the spec's `announcements.html`): every change to the Platform Fee and the Creator Fee ever
 * announced, newest effective date first, each with the transaction that applied it, or Due once its date has come
 * and Announced before. With none, the page says so in the spec's one sentence; a read that fails says nothing.
 */
export default async function AnnouncementsPage() {
  const [list, platform] = await Promise.all([listAnnouncements().catch(() => null), getPlatform().catch(() => null)]);
  const now = Date.now();
  return (
    <>
      <div className="shell page-head">
        <h1>Fee changes</h1>
        <Link className="arrow" href="/fees">Fees now</Link>
      </div>
      <div className={`shell section ${styles.flush}`}>
        {list && list.announcements.length > 0 && (
          <ol className={styles.timeline} aria-label="Fee changes">
            {list.announcements.map((a) => (
              <li key={a.id} className="panel pad" data-announcement={a.id}>
                <p className="muted">
                  <time dateTime={a.effectiveAt}>{formatDate(a.effectiveAt)}</time>
                </p>
                <h2>
                  Platform Fee {pct(a.platformFeeBps)}, Creator Fee {pct(a.creatorFeeBps)}
                </h2>
                {a.note && <p>{a.note}</p>}
                <p>
                  {a.appliedSignature ? (
                    platform ? (
                      <a className="link" href={explorerUrl("tx", a.appliedSignature, platform)} target="_blank" rel="noreferrer">Applied</a>
                    ) : (
                      "Applied"
                    )
                  ) : Date.parse(a.effectiveAt) <= now ? (
                    <span className="badge badge-gold">Due</span>
                  ) : (
                    <span className="badge">Announced</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
        {list && list.announcements.length === 0 && <p className={styles.statement}>No fee change has ever been announced.</p>}
      </div>
    </>
  );
}
