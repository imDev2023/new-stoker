/**
 * Light or dark: the page follows the visitor's system setting until they choose in the account menu
 * (components/SchemeToggle.tsx), which writes this cookie; the root layout reads it onto <html> as `data-theme`, the
 * attribute the tokens in globals.css answer, so a page never paints the other scheme first. A plain module, not the
 * toggle's: a server component importing from a client module gets a client reference in place of the string.
 */
export const SCHEME_COOKIE = "scheme";

export type Scheme = "light" | "dark";

export const isScheme = (value: string | undefined): value is Scheme => value === "light" || value === "dark";

/** The paper of each scheme (globals.css), for the browser's own chrome. */
export const PAPER: Record<Scheme, string> = { light: "#f6f4ef", dark: "#0c0c0d" };
