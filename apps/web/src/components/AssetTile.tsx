"use client";

import { useEffect, useRef, useState } from "react";
import type { QuoteRef } from "@launchpad/contract";
import { quoteTicker } from "@/lib/format";
import styles from "./AssetTile.module.css";

/**
 * A Quote Asset's logo, or its first letter, on a round tile in ink (the spec's `.asset-tile`): a coin's tile is square
 * on the heat, an asset's round, so the two never read as one another. `xl` is the asset page's head. A logo is the
 * token list's address and some of them no longer answer, so one that fails gives way to the letter, never a broken image.
 */
export function AssetTile({ quote, xl = false }: { quote: Pick<QuoteRef, "mint" | "symbol" | "logo">; xl?: boolean }) {
  const className = `tile ${styles.asset}${xl ? ` ${styles.xl}` : ""}`;
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // A logo can fail before the page hydrates, when React isn't listening yet: read what the browser already knows.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (!quote.logo || failed) return <span className={className} aria-hidden="true">{quoteTicker(quote).slice(0, 1)}</span>;
  // Shown as it is, never through an optimiser.
  return <img ref={img} className={className} src={quote.logo} alt="" loading={xl ? undefined : "lazy"} onError={() => setFailed(true)} />;
}
