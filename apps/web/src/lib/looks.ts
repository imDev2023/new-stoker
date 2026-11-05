/**
 * Review-only (#26): the design candidates the owner picks from, on the real pages and without a deploy. `?look=` shows
 * a candidate whole and `?look=control` the current look; `?paper=`, `?type=` and `?form=` set one part each, so any part
 * can be seen with any other. The choice is kept in cookies, which the root layout writes onto <html> as `data-paper`,
 * `data-type` and `data-form`, the attributes globals.css's candidate blocks answer, so it holds across every page and
 * reload until it is changed. Removed with those blocks, the fonts in layout.tsx and components/LookSwitch.tsx once the
 * owner picks; the pick then becomes the default in a ticket of its own (#28).
 *
 * The first round (A, B, C) moved the page off cream and swapped the sans and the mono. The owner picked B and found it
 * still read like the competitors (2026-11-05), so the second round (D, E, F) keeps B's paper and type pair and replaces
 * what Peak shares with it: the serif on every headline, the hairline row of figures, the ticks, the serif wordmark.
 */
export const PAPERS = ["porcelain", "sage", "white", "bottle", "furnace"] as const;
export type Paper = (typeof PAPERS)[number];

export const TYPES = ["plex", "albert", "atkinson", "albert-display", "archivo"] as const;
export type TypePair = (typeof TYPES)[number];

/** The pieces that change shape: the wordmark, the figures, the checks, the buttons and where the bands fall. */
export const FORMS = ["d", "e", "f"] as const;
export type Form = (typeof FORMS)[number];

/** Each candidate whole: a page colour and a type pair, and for the second round a form. */
export const LOOKS = {
  a: { paper: "porcelain", type: "plex" },
  b: { paper: "sage", type: "albert" },
  c: { paper: "white", type: "atkinson" },
  d: { paper: "bottle", type: "albert-display", form: "d" },
  e: { paper: "furnace", type: "archivo", form: "e" },
  f: { paper: "sage", type: "albert-display", form: "f" },
} as const satisfies Record<string, { paper: Paper; type: TypePair; form?: Form }>;

export const PAPER_COOKIE = "review-paper";
export const TYPE_COOKIE = "review-type";
export const FORM_COOKIE = "review-form";

export const isPaper = (value: string | null | undefined): value is Paper => (PAPERS as readonly string[]).includes(value ?? "");
export const isTypePair = (value: string | null | undefined): value is TypePair => (TYPES as readonly string[]).includes(value ?? "");
export const isForm = (value: string | null | undefined): value is Form => (FORMS as readonly string[]).includes(value ?? "");
export const isLook = (value: string | null | undefined): value is keyof typeof LOOKS => Object.hasOwn(LOOKS, value ?? "");
