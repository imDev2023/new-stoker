/**
 * Review-only (#26): the design candidates the owner picks a type pair and a page colour from, on the real pages and
 * without a deploy. `?look=a`, `b` or `c` shows a candidate whole and `?look=control` the current look; `?paper=` and
 * `?type=` set one half each, so any paper can be seen with any type pair. The choice is kept in two cookies, which the
 * root layout writes onto <html> as `data-paper` and `data-type`, the attributes globals.css's candidate blocks answer,
 * so it holds across every page and reload until it is changed. Removed with those blocks, the fonts in layout.tsx and
 * components/LookSwitch.tsx once the owner picks; the pick then becomes the default in a ticket of its own.
 */
export const PAPERS = ["porcelain", "sage", "white"] as const;
export type Paper = (typeof PAPERS)[number];

export const TYPES = ["plex", "albert", "atkinson"] as const;
export type TypePair = (typeof TYPES)[number];

/** Each candidate whole: a page colour and a type pair. */
export const LOOKS = {
  a: { paper: "porcelain", type: "plex" },
  b: { paper: "sage", type: "albert" },
  c: { paper: "white", type: "atkinson" },
} as const satisfies Record<string, { paper: Paper; type: TypePair }>;

export const PAPER_COOKIE = "review-paper";
export const TYPE_COOKIE = "review-type";

export const isPaper = (value: string | null | undefined): value is Paper => (PAPERS as readonly string[]).includes(value ?? "");
export const isTypePair = (value: string | null | undefined): value is TypePair => (TYPES as readonly string[]).includes(value ?? "");
export const isLook = (value: string | null | undefined): value is keyof typeof LOOKS => Object.hasOwn(LOOKS, value ?? "");
