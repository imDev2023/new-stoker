import { useEffect, useState } from "react";
import type { CopyCheck, CopyVerdict } from "@launchpad/contract";
import { checkCopy } from "./api";

export type CopyField = "name" | "symbol" | "image";

const DEBOUNCE_MS = 350;

/**
 * Copy Protection (ADR 0012) as the Creator types (production's `useCopyCheck`, `12dbc10:apps/web/src/components/CopyCheck.tsx`):
 * the name, the ticker and the image are checked against the coins launched here inside their window, and each field
 * wears its verdict once the API has answered. Prepare gives the same answer, so nothing there is a surprise; a check
 * that fails never blocks the form, since prepare checks again and says what it refuses.
 */
export function useCopyCheck({ name, symbol, image, creator }: { name: string; symbol: string; image: File | null; creator: string | null }) {
  const [result, setResult] = useState<{ check: CopyCheck; asked: { name: string; symbol: string; image: File | null } } | null>(null);
  const trimmedName = name.trim();
  const trimmedSymbol = symbol.trim();
  const anything = trimmedName !== "" || trimmedSymbol !== "" || image !== null;

  useEffect(() => {
    if (!anything) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const form = new FormData();
        if (creator) form.set("creator", creator);
        if (trimmedName) form.set("name", trimmedName);
        if (trimmedSymbol) form.set("symbol", trimmedSymbol);
        if (image) form.set("image", image);
        const check = await checkCopy(form, controller.signal);
        if (!controller.signal.aborted) setResult({ check, asked: { name: trimmedName, symbol: trimmedSymbol, image } });
      } catch {
        // Unanswered: the field shows no verdict, and prepare checks again.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [anything, trimmedName, trimmedSymbol, image, creator]);

  /** A field's verdict, only while it answers what the field holds now: a stale one is never shown. */
  const verdict = (field: CopyField): CopyVerdict | null => {
    if (!result) return null;
    const current = field === "name" ? trimmedName : field === "symbol" ? trimmedSymbol : image;
    if (!current || result.asked[field] !== current) return null;
    return result.check[field];
  };

  const name_ = verdict("name");
  const symbol_ = verdict("symbol");
  const image_ = verdict("image");
  return {
    name: name_,
    symbol: symbol_,
    image: image_,
    /** The first refusal prepare would give, in the API's own sentence; null when nothing is taken. */
    refusal: [name_, symbol_, image_].find((v) => v?.status === "taken")?.reason ?? null,
  };
}

/** The day a protection window ends, as the verdict says it: Nov 12, in UTC so the server and every browser agree. */
export function protectedUntil(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
