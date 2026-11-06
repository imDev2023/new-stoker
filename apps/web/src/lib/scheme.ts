/**
 * Light or dark: the page follows the visitor's system setting until they choose in the account menu
 * (components/SchemeToggle.tsx), which writes this cookie; the root layout reads it onto <html> as `data-theme`, the
 * attribute the tokens in globals.css answer, so a page never paints the other scheme first. A plain module, not the
 * toggle's: a server component importing from a client module gets a client reference in place of the string.
 */
export const SCHEME_COOKIE = "scheme";

export type Scheme = "light" | "dark";

export const isScheme = (value: string | undefined): value is Scheme => value === "light" || value === "dark";

/**
 * The band of each scheme (globals.css, `--band`), for the browser's own chrome: the header sits on it, so the browser's
 * bar runs on into the site's.
 */
export const CHROME: Record<Scheme, string> = { light: "#0f130e", dark: "#171e15" };
