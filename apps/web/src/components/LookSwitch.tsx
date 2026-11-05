"use client";

import { useEffect } from "react";
import { isLook, isPaper, isTypePair, LOOKS, PAPER_COOKIE, TYPE_COOKIE } from "@/lib/looks";

/** A month: long enough for a review, and the switch goes once the owner picks. */
const KEPT_SECONDS = 30 * 24 * 60 * 60;

/** Puts one half of the pick on <html> and in its cookie, or takes it off both when the value is empty or unknown. */
function apply(attribute: string, cookie: string, value: string | null) {
  const root = document.documentElement;
  if (value) {
    root.setAttribute(attribute, value);
    document.cookie = `${cookie}=${value}; path=/; max-age=${KEPT_SECONDS}; samesite=lax`;
  } else {
    root.removeAttribute(attribute);
    document.cookie = `${cookie}=; path=/; max-age=0; samesite=lax`;
  }
}

/**
 * Review-only (#26; lib/looks.ts): reads `?look=`, `?paper=` and `?type=` once the page has loaded and keeps the pick in
 * its cookies, so every later page and reload is drawn in it by the server. The first page of a new pick paints the
 * look it had for a frame first; a script in the head would avoid that, but the not-found page client-renders the
 * layout, where React never runs a script element (the original's `?theme=`, ThemeOverride, did the same).
 */
export function LookSwitch() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const look = query.get("look");
    const whole = isLook(look) ? LOOKS[look] : look === "control" ? { paper: null, type: null } : undefined;
    const paper = query.has("paper") ? query.get("paper") : whole === undefined ? undefined : whole.paper;
    const type = query.has("type") ? query.get("type") : whole === undefined ? undefined : whole.type;
    if (paper !== undefined) apply("data-paper", PAPER_COOKIE, isPaper(paper) ? paper : null);
    if (type !== undefined) apply("data-type", TYPE_COOKIE, isTypePair(type) ? type : null);
  }, []);
  return null;
}
