"use client";

import { useEffect, useState } from "react";
import { SCHEME_COOKIE, type Scheme } from "@/lib/scheme";

function Sun() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.5 12.3A6.8 6.8 0 0 1 7.7 3.5a6.8 6.8 0 1 0 8.8 8.8Z" />
    </svg>
  );
}

/**
 * Light or dark (owner, 2026-10-13, kept by ADR 0017): the page follows the visitor's system setting until this row of
 * the account menu is pressed, after which the choice holds as a cookie the root layout reads onto <html> as
 * `data-theme`. The row names what pressing it brings.
 */
export function SchemeToggle({ className = "" }: { className?: string }) {
  // Unknown until mounted: the server knows only an explicit choice, never the system setting.
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const explicit = document.documentElement.dataset.theme;
      setDark(explicit ? explicit === "dark" : system.matches);
    };
    read();
    // Until a choice is made the page follows the system setting, which can change while the page is open.
    system.addEventListener("change", read);
    return () => system.removeEventListener("change", read);
  }, []);

  function flip() {
    const next: Scheme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `${SCHEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setDark(next === "dark");
  }

  return (
    <button type="button" role="menuitem" className={className} onClick={flip} disabled={dark === null}>
      {dark ? <Sun /> : <Moon />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
