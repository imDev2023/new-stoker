/**
 * Where the site's links go: the header's sections, the footer's groups, the socials and the contact address, read
 * by the header, the phone bar and the footer, so a link is changed in one place. Every route is production's; Stocks
 * is the spec's new section (docs/design/playground). Nothing links to the repository (owner, 2026-10-30).
 *
 * PLACEHOLDERS (owner, 2026-10-07): the X and Telegram addresses are the handles the owner intends and may not exist
 * yet; replace them before the site opens.
 */
export const SITE_LINKS = {
  x: { label: "X", href: "https://x.com/stokermarkets", handle: "@stokermarkets" },
  telegram: { label: "Telegram", href: "https://t.me/stokermarkets" },
  email: "info@stoker.markets",
} as const;

export type NavLink = { href: string; label: string; also?: readonly string[] };

/** Launching is the header's one filled button; every launch button says this (owner, 2026-10-09). */
export const LAUNCH_LINK = { href: "/launch", label: "Stoke a coin" } as const satisfies NavLink;

/**
 * The header's eight sections, in the spec's order; the phone bar under 900px keeps the first five. A detail page
 * belongs to its list's section (a coin to Explore, an asset to Assets, a stock to Stocks), and Burns to Stats
 * (owner, 2026-10-25).
 */
export const NAV_LINKS = [
  { href: "/coins", label: "Explore", also: ["/coin"] },
  { href: "/stocks", label: "Stocks", also: ["/stock"] },
  { href: "/swap", label: "Swap" },
  { href: "/assets", label: "Assets", also: ["/asset"] },
  { href: "/rewards", label: "Rewards" },
  { href: "/revenue", label: "Stats", also: ["/burns"] },
  { href: "/curated", label: "Curated" },
  { href: "/api", label: "Developers" },
] as const satisfies readonly NavLink[];

/** How many sections the phone bar shows. */
export const PHONE_SECTIONS = 5;

/** The section a path belongs to, or null: its own route, or one of the routes it stands for. */
export function sectionOf(pathname: string): string | null {
  const top = `/${pathname.split("/")[1] ?? ""}`;
  const links: readonly NavLink[] = NAV_LINKS;
  return links.find((l) => l.href === top || l.also?.includes(top))?.href ?? null;
}

/** The legal pages, with the Fees page, the one place a fee figure is shown (owner, 2026-10-30). */
export const LEGAL_LINKS = [
  { href: "/fees", label: "Fees" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/risk", label: "Risk disclosure" },
] as const satisfies readonly NavLink[];

/** The footer, grouped as the spec groups it. A Creator's earnings page is their own and linked from the account menu only. */
export const FOOTER_GROUPS = [
  { title: "Trade", links: [{ href: "/coins", label: "Explore" }, { href: "/stocks", label: "Stocks" }, { href: "/swap", label: "Swap" }, { href: "/assets", label: "Assets" }] },
  { title: "Create", links: [LAUNCH_LINK, { href: "/rewards", label: "Rewards" }, { href: "/curated", label: "Curated" }] },
  {
    title: "Records",
    links: [{ href: "/revenue", label: "Stats" }, { href: "/burns", label: "Burns" }, { href: "/announcements", label: "Announcements" }, { href: "/api", label: "Developers" }],
  },
  { title: "Legal", links: LEGAL_LINKS },
] as const satisfies readonly { title: string; links: readonly NavLink[] }[];
