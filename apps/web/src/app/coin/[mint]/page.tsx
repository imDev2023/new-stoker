import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoinMarket } from "@/components/CoinMarket";
import { JsonLd } from "@/components/JsonLd";
import { getCandles, getHolders, getLaunch, getPlatform, getQuoteAsset, getTrust, listTrades } from "@/lib/api";
import { quoteTicker } from "@/lib/format";
import { breadcrumbList, clip, pageMeta } from "@/lib/meta";
import { siteOrigin } from "@/lib/origin";

type Props = { params: Promise<{ mint: string }> };

/** The chart's first interval, the spec's checked one. */
const FIRST_INTERVAL = "15m";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mint } = await params;
  const launch = await getLaunch(mint).catch(() => null);
  if (!launch) return pageMeta({ path: `/coin/${mint}`, title: "Coin not found", index: false });
  const quote = quoteTicker(launch.quote);
  // Its own description when the Creator wrote one; otherwise its pair and what its Creator earns, in words (production's).
  const description =
    launch.description?.trim() ||
    `${launch.name} (${launch.symbol}) trades on Stoker paired with ${quote}; its creator earns half of what the platform collects on its trades, every payment on the public ledger.`;
  return pageMeta({ path: `/coin/${launch.mint}`, title: `${launch.symbol} / ${quote}`, description: clip(description), card: "own" });
}

/**
 * A coin's page (the spec's `coin.html`, ADR 0017; production's route `/coin/[mint]`): the title row with the pair, the
 * before-you-buy marks and the price, then the chart, the curve and the trades and holders beside the trade panel, the
 * asset it is paired with and the facts. Everything is read here and handed to the market as data (a server tree passed
 * into a client component warns on some coins, CLAUDE.md's trap), and the market keeps it up to date from the browser.
 * A read that fails leaves its part out; only a coin the API doesn't know is the not-found page.
 */
export default async function CoinPage({ params }: Props) {
  const { mint } = await params;
  // Any mint the API doesn't know answers 404, which is the not-found page; an API that can't answer is an error.
  const launch = await getLaunch(mint);
  if (!launch) notFound();
  const [platform, trades, candles, holders, trust, quoteAsset, origin] = await Promise.all([
    getPlatform(),
    listTrades(mint).catch(() => null),
    getCandles(mint, FIRST_INTERVAL).catch(() => null),
    getHolders(mint).catch(() => null),
    getTrust(mint).catch(() => null),
    getQuoteAsset(launch.quote.mint).catch(() => null),
    siteOrigin(),
  ]);
  const pair = `${launch.symbol} / ${quoteTicker(launch.quote)}`;
  return (
    <>
      <JsonLd data={breadcrumbList(origin, [["Home", "/"], ["Explore", "/coins"], [pair, `/coin/${launch.mint}`]])} />
      <CoinMarket
        initial={launch}
        platform={platform}
        quoteAsset={quoteAsset}
        initialTrades={trades?.trades ?? []}
        initialCandles={candles ?? { interval: FIRST_INTERVAL, candles: [] }}
        initialHolders={holders}
        initialTrust={trust}
        renderedAt={Date.now()}
      />
    </>
  );
}
