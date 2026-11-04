"use client";

import { useEffect, useRef, useState } from "react";
import { acceptDisclaimer, EXCLUDED_REGIONS } from "@/lib/legal";
import styles from "./Disclaimer.module.css";

/**
 * Shown before a launch or a trade when the browser holds no acceptance (the welcome on the first visit records one, so
 * this stands in when storage was cleared or refused): the owner's decision is a disclaimer, not a technical block.
 * Production's words (`12dbc10:apps/web/src/components/Disclaimer.tsx`), on the spec's dialog.
 */
export function Disclaimer({
  open, onAccept, onCancel, action,
}: { open: boolean; onAccept: () => void; onCancel: () => void; action: "launch" | "trade" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`dialog ${styles.dialog}`}
      aria-labelledby="disclaimer-title"
      // Escape closes a modal dialog by itself and a browser may not let that be prevented: the close is the cancel.
      onClose={() => open && onCancel()}
    >
      <h2 id="disclaimer-title" className={styles.title}>Before you {action}</h2>
      <p>
        This launchpad is not for people in {EXCLUDED_REGIONS}, and it is not offered to anyone where launching or trading
        these coins is not allowed.
      </p>
      <p>Coins launched here are created by their creators, not by us. Their prices can fall to zero. Nothing on this site is investment advice.</p>
      <p>
        Each coin is priced in an asset its creator chose. Some of those assets are issued by companies that can freeze or
        move them, and some trade thinly; what is known about each one is on its page under Assets.
      </p>
      <label className={styles.check}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>I&apos;m not in an excluded country, and I understand the risks.</span>
      </label>
      <div className={styles.actions}>
        <button type="button" className="button button-ghost" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="button"
          disabled={!agreed}
          onClick={() => {
            acceptDisclaimer();
            onAccept();
          }}
        >
          Continue
        </button>
      </div>
    </dialog>
  );
}
