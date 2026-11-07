import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AssetTile } from "@/components/AssetTile";
import { CoinPanel, CoinTable } from "@/components/CoinTable";
import { MarketHours } from "@/components/MarketHours";
import { RiskLabels } from "@/components/RiskLabels";
import { StockChart } from "@/components/StockChart";
import { StockTrade } from "@/components/StockTrade";
import { StockUnder } from "@/components/StockUnder";
import { getPlatform, getQuoteAsset, listLaunches } from "@/lib/api";
import { formatLiquidity, formatUsd, ISSUER_LABELS, marketTitle, tokenProgramName } from "@/lib/assets";
import { explorerUrl, formatPriceCompact, quoteTicker, shortAddress } from "@/lib/format";
import { JUPITER_REFERRAL } from "@/lib/jupiterReferral";
import { formatStockChange, isStock, stockGap } from "@/lib/stocks";
import styles from "./page.module.css";

type Props = { params: Promise<{ mint: string }> };

/** How many of its coins the page lists, the most valuable first (the asset page's). */
const COINS_SHOWN = 8;

/** The stock, or null when the mint is no tokenized stock the registry quotes (or the API can't say), so the page answers 404. */
const stock = (mint: string) => getQuoteAsset(mint).then((q) => (q && isStock(q) ? q : null), () => null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await stock((await params).mint);
  if (!s) return { title: "Stock not found", robots: { index: false } };
  const ticker = quoteTicker(s);
  return { title: ticker, description: `${ticker}, a tokenized stock on Solana: its price beside the stock it tracks, its issuer and risk labels, and a trade.` };
}

/**
 * One tokenized stock (#10, the spec's stock page): its head with the price, the day's change and, under them, the
 * stock it tracks at its last price with the gap; the US market's hours beside Solana's; the token's own line from
 * the prices the registry records; its risk labels and the coins paired with it; and beside them a trade through
 * Jupiter in USDC or SOL and its facts. Every part #3's fields feed (the change, the gap, the line) is left out while
 * they are absent, and a fact the registry doesn't have is left out, never shown as a zero.
 */
export default async function StockPage({ params }: Props) {
  const { mint } = await params;
  const s = await stock(mint);
  if (!s) notFound();
  const [platform, coins] = await Promise.all([
    getPlatform().catch(() => null),
    listLaunches({ quote: s.mint, sort: "market_cap", limit: COINS_SHOWN }).then(
      (l) => l.launches.filter((c) => c.quote.mint === s.mint),
      () => [],
    ),
  ]);
  const ticker = quoteTicker(s);
  const day = formatStockChange(s.change24h);
  const gap = stockGap(s);
  const facts: [string, ReactNode][] = [
    ["Tracks", s.market ? marketTitle(s.market) : null],
    ["Issuer", s.issuer ? ISSUER_LABELS[s.issuer] : null],
    ["Liquidity", s.liquidityUsd ? formatLiquidity(s.liquidityUsd) : null],
    ["In SOL", s.price ? formatPriceCompact(Number(s.price.sol)) : null],
    ["Token program", tokenProgramName(s.tokenProgram)],
    [
      "Mint",
      platform ? (
        <a className="link mono" href={explorerUrl("address", s.mint, platform)} target="_blank" rel="noreferrer">{shortAddress(s.mint)}</a>
      ) : (
        <span className="mono">{shortAddress(s.mint)}</span>
      ),
    ],
  ];

  return (
    <div className="shell">
      <header className={styles.head}>
        <AssetTile quote={s} lg />
        <div className={styles.words}>
          <h1 className={styles.ticker}>{ticker}</h1>
          <p className="muted">{[s.name, s.issuer ? ISSUER_LABELS[s.issuer] : null].filter(Boolean).join(" · ")}</p>
        </div>
        {s.price?.usd && (
          <p className={styles.price}>
            <b>{formatUsd(s.price.usd)}</b>
            {day.text && <span className={day.direction ?? undefined}>{day.text}</span>}
            {gap && s.market?.last && (
              <StockUnder ticker={s.market.ticker} last={s.market.last.price} gap={gap} />
            )}
          </p>
        )}
      </header>
      <MarketHours row />

      <div className={styles.grid}>
        <div className={styles.main}>
          <StockChart mint={s.mint} />
          <RiskLabels quote={s} />
          {(coins.length > 0 || s.launchable) && (
            <section aria-labelledby="paired-title">
              <div className="section-head">
                <h2 id="paired-title">Coins paired with it</h2>
                {s.launchable && <Link className="arrow" href={`/launch?quote=${s.mint}`}>{coins.length > 0 ? "Stoke one" : "Stoke the first"}</Link>}
              </div>
              {coins.length > 0 && (
                <CoinPanel>
                  <CoinTable launches={coins} label={`Coins paired with ${ticker}`} compact />
                </CoinPanel>
              )}
            </section>
          )}
        </div>
        <aside className={styles.aside}>
          <StockTrade mint={s.mint} ticker={ticker} fee={JUPITER_REFERRAL !== ""} />
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
