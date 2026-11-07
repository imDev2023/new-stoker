import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AssetTile } from "@/components/AssetTile";
import { JsonLd } from "@/components/JsonLd";
import { CoinPanel, CoinTable } from "@/components/CoinTable";
import { MarketChart } from "@/components/MarketChart";
import { RiskLabels } from "@/components/RiskLabels";
import { getPlatform, getQuoteAsset, listLaunches } from "@/lib/api";
import { formatLiquidity, formatUsd, assetSubtitle, graduationAmount, ISSUER_LABELS, marketTitle, tokenProgramName } from "@/lib/assets";
import { explorerUrl, formatPriceCompact, isSol, quoteTicker, shortAddress } from "@/lib/format";
import { breadcrumbList, pageMeta } from "@/lib/meta";
import { siteOrigin } from "@/lib/origin";
import styles from "./page.module.css";

type Props = { params: Promise<{ mint: string }> };

/** How many of its coins the page lists, the most valuable first. */
const COINS_SHOWN = 8;

/** The asset, or null when the mint is no Quote Asset (or the API can't say), so the page answers 404. */
const quoteAsset = (mint: string) => getQuoteAsset(mint).catch(() => null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { mint } = await params;
  const quote = await quoteAsset(mint);
  if (!quote) return pageMeta({ path: `/asset/${mint}`, title: "Asset not found", index: false });
  const ticker = quoteTicker(quote);
  return pageMeta({ path: `/asset/${quote.mint}`, card: "own", title: ticker, description: `${ticker} as an asset a coin can be priced in: its price, its graduation target, its risk labels and the coins paired with it.` });
}

/**
 * One Quote Asset (#9, the spec's asset page): its head with the page's actions, TradingView's chart of the market behind
 * it when one is known (production's #124), its Quote Risk Labels, the coins paired with it as Home lists them, and its
 * facts beside them. A fact the registry doesn't have is left out, never shown as a zero.
 */
export default async function AssetPage({ params }: Props) {
  const { mint } = await params;
  const quote = await quoteAsset(mint);
  if (!quote) notFound();
  const [platform, coins, origin] = await Promise.all([
    getPlatform().catch(() => null),
    listLaunches({ quote: quote.mint, sort: "market_cap", limit: COINS_SHOWN }).then(
      (l) => l.launches.filter((c) => c.quote.mint === quote.mint),
      () => [],
    ),
    siteOrigin(),
  ]);
  const ticker = quoteTicker(quote);
  const target = graduationAmount(quote.graduationTarget?.raw ?? null, quote.decimals, ticker);
  const facts: [string, ReactNode][] = [
    ["Price", quote.price?.usd ? formatUsd(quote.price.usd) : null],
    ["In SOL", quote.price && !isSol(quote) ? formatPriceCompact(Number(quote.price.sol)) : null],
    ["Liquidity", quote.liquidityUsd ? formatLiquidity(quote.liquidityUsd) : null],
    ["A coin graduates at", target],
    ["Issuer", quote.category === "tokenized_stock" && quote.issuer ? ISSUER_LABELS[quote.issuer] : null],
    ["Referral share", quote.referralShare.allowed ? "Allowed" : "None"],
    ["Token program", tokenProgramName(quote.tokenProgram)],
    [
      "Mint",
      platform ? (
        <a className="link mono" href={explorerUrl("address", quote.mint, platform)} target="_blank" rel="noreferrer">{shortAddress(quote.mint)}</a>
      ) : (
        <span className="mono">{shortAddress(quote.mint)}</span>
      ),
    ],
  ];

  return (
    <div className="shell">
      <JsonLd data={breadcrumbList(origin, [["Home", "/"], ["Assets", "/assets"], [ticker, `/asset/${quote.mint}`]])} />
      <header className={styles.head}>
        <AssetTile quote={quote} xl />
        <div>
          <h1 className={styles.ticker}>{ticker}</h1>
          <p className="muted">{assetSubtitle(quote)}</p>
        </div>
        <div className={styles.actions}>
          {quote.category === "tokenized_stock" && <Link className="arrow" href={`/stock/${quote.mint}`}>Trade {ticker}</Link>}
          {quote.launchable && <Link className="button button-lg" href={`/launch?quote=${quote.mint}`}>Stoke a coin paired with {ticker}</Link>}
        </div>
      </header>
      <div className={styles.grid}>
        <div className={styles.main}>
          {quote.market && (
            <section className="panel pad" aria-labelledby="market-title">
              <div className="section-head">
                <h2 id="market-title">{marketTitle(quote.market)}</h2>
              </div>
              <MarketChart market={quote.market} />
            </section>
          )}
          <RiskLabels quote={quote} />
          {coins.length > 0 && (
            <section aria-labelledby="paired-title">
              <div className="section-head">
                <h2 id="paired-title">Coins paired with it</h2>
              </div>
              <CoinPanel>
                <CoinTable launches={coins} label={`Coins paired with ${ticker}`} compact />
              </CoinPanel>
            </section>
          )}
        </div>
        <aside className={styles.aside}>
          <dl className="panel pad kv" aria-label={`${ticker} facts`}>
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
