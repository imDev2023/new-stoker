import type { MetadataRoute } from "next";
import { LAUNCH_LIST_MAX } from "@launchpad/contract";
import { listLaunches, listQuotes } from "@/lib/api";
import { siteOrigin } from "@/lib/origin";
import { isStock } from "@/lib/stocks";
import { FOOTER_GROUPS, NAV_LINKS } from "@/lib/site";

/** The API pages its list by offset up to here, so a sitemap names the newest ten thousand coins. */
const COINS_MAX = 10_000;

/** Every coin, newest first, in as many pages of the list as it takes. */
async function everyCoin() {
  const mints: string[] = [];
  let offset: number | null = 0;
  while (offset !== null && offset < COINS_MAX) {
    const page = await listLaunches({ sort: "new", limit: LAUNCH_LIST_MAX, offset });
    mints.push(...page.launches.map((l) => l.mint));
    offset = page.nextOffset;
  }
  return mints;
}

/**
 * Every page there is to find (#14), at the origin the request came in on: the home page, each section and every page
 * the footer links to, every coin, every Quote Asset and every tokenized stock. A list the API can't give is left out
 * rather than failing the whole file. A wallet's own pages are nobody's to index and are never named.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, coins, quotes] = await Promise.all([siteOrigin(), everyCoin().catch(() => []), listQuotes().then((l) => l.quotes, () => [])]);
  const pages = new Set<string>(["/", ...NAV_LINKS.map((l) => l.href), ...FOOTER_GROUPS.flatMap((g) => g.links.map((l) => l.href))]);
  const at = (path: string) => ({ url: `${origin}${path}` });
  return [
    ...[...pages].map(at),
    ...coins.map((mint) => at(`/coin/${mint}`)),
    ...quotes.map((q) => at(`/asset/${q.mint}`)),
    ...quotes.filter(isStock).map((q) => at(`/stock/${q.mint}`)),
  ];
}
