"use client";

import { useEffect, useRef, useState } from "react";
import { acceptDisclaimer, hasAcceptedDisclaimer, WELCOME } from "@/lib/legal";
import styles from "./Welcome.module.css";

/**
 * The welcome on a visitor's first visit (owner, 2026-10-30, imDev2023/Stoker-Markets#156; kept by ADR 0017): the open
 * half of the pitch, one risk sentence, the excluded regions and one button, over the page as a modal dialog, a sheet
 * from the foot of a phone. It mounts closed and opens after hydration, so the server render and the first paint are
 * the same with or without it. Accepted once per browser on the disclaimer's own key; it blocks nothing (owner's rule:
 * everything shows, the disclaimer is the notice), so Escape and a press outside it accept it like Continue. The legal
 * pages open in a new tab, so the welcome stays put.
 */
export function Welcome() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hasAcceptedDisclaimer()) setOpen(true);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (open && d && !d.open) d.showModal();
  }, [open]);

  if (!open) return null;

  const accept = () => {
    acceptDisclaimer();
    setOpen(false);
  };

  return (
    <dialog
      ref={dialog}
      className={`dialog ${styles.dialog}`}
      aria-labelledby="welcome-title"
      // Escape closes a modal dialog by itself, and a browser may not let that be prevented: the close is the acceptance.
      onClose={accept}
      onClick={(e) => {
        // A press on the backdrop reaches the dialog itself, outside its own box.
        const r = e.currentTarget.getBoundingClientRect();
        if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) accept();
      }}
    >
      {/* "Ember dawn", the owner's pick of 2026-11-02, served at twice the card's width. */}
      <div className={styles.cover}>
        <img src="/welcome.jpg" width={1248} height={624} alt="" />
      </div>
      <div className={styles.body}>
        <h2 id="welcome-title" className={styles.title}>{WELCOME.title}</h2>
        {WELCOME.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <button type="button" className={`button button-lg button-block ${styles.continue}`} onClick={accept}>
          {WELCOME.button}
        </button>
        <p className={styles.terms}>
          By continuing you accept the <a href="/terms" target="_blank" rel="noopener">Terms</a>, the{" "}
          <a href="/privacy" target="_blank" rel="noopener">Privacy notice</a> and the{" "}
          <a href="/risk" target="_blank" rel="noopener">Risk disclosure</a>, and confirm you are over 18.
        </p>
      </div>
    </dialog>
  );
}
