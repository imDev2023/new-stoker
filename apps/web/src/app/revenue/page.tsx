import type { Metadata } from "next";
import Link from "next/link";
import type { QuoteAsset, RevenueAsset, RevenueDay, RevenueStreams } from "@launchpad/contract";
import { AssetTile } from "@/components/AssetTile";
import { Figures, type Figure } from "@/components/Figures";
import { LedgerTable } from "@/components/LedgerTable";
import { getBurns, getPlatform, getRevenue, listLedger, listQuotes } from "@/lib/api";
import { pct } from "@/lib/fees";
import { explorerUrl, formatEntryAmount, formatFigure, isSol, quoteTicker, shortAddress, SOL_DECIMALS, units } from "@/lib/format";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Stats",
  description: "The platform's revenue, the Creators' half, and every buy and burn, each a sum of the public ledger.",
};

/** How many days the daily bars span at least, so a young platform's few days read as recent days, not as wide blocks. */
const MIN_DAYS = 30;

/** A revenue amount in SOL: SOL as it is, any other asset at the Quote Registry's price, a coin without one at nothing. */
function valuer(quotes: QuoteAsset[]) {
  const inSol = new Map(quotes.map((q) => [q.mint, Number(q.price?.sol ?? 0)]));
  return (asset: RevenueAsset, raw: string) => units(raw, asset.decimals) * (isSol(asset) ? 1 : (inSol.get(asset.mint) ?? 0));
}

/**
 * The daily bars, oldest on the left: every calendar day from the first listed to the last, a day without revenue a gap,
 * so the bars never close up over a quiet day. The API lists only the days with revenue, newest first.
 */
function dailyBars(days: RevenueDay[], value: (asset: RevenueAsset, raw: string) => number) {
  if (!days.length) return null;
  const byDay = new Map(days.map((d) => [d.day, d.assets.reduce((s, a) => s + value(a.asset, a.total), 0)]));
  const last = Date.parse(`${days[0]!.day}T00:00:00Z`);
  const first = Date.parse(`${days.at(-1)!.day}T00:00:00Z`);
  const span = Math.max(MIN_DAYS, Math.round((last - first) / 86_400_000) + 1);
  const values = Array.from({ length: span }, (_, i) => byDay.get(new Date(last - (span - 1 - i) * 86_400_000).toISOString().slice(0, 10)) ?? 0);
  const max = Math.max(...values);
  if (!(max > 0)) return null;
  const w = 300 / span;
  return values.map((v, i) => ({ x: i * w + w * 0.15, w: w * 0.7, h: (v / max) * 96 })).filter((b) => b.h > 0);
}

/** One asset's streams, each only once it has collected something. */
const STREAMS: [keyof RevenueStreams | "creatorForwarded", string][] = [
  ["platformFee", "Curves"],
  ["poolFee", "Pools"],
  ["feeKey", "Fee Keys"],
  ["creatorForwarded", "Sent to Creators"],
];

/**
 * Stats (#11, the spec's `revenue.html`, the header's Stats): the platform's revenue, the Creators' half and the
 * Platform Token's burns as figures, each linking to the record it is summed from; the daily revenue, the totals by
 * asset, the Ledger itself and the wallets it moves between. Every read stands alone, so one that fails leaves its part
 * out rather than failing the page, and every part waits for a real value.
 */
export default async function StatsPage() {
  const [platform, revenue, burns, ledger, quotes] = await Promise.all([
    getPlatform().catch(() => null),
    getRevenue().catch(() => null),
    getBurns().catch(() => null),
    listLedger().catch(() => null),
    listQuotes().then((l) => l.quotes, () => []),
  ]);
  const value = valuer(quotes);
  const renderedAt = Date.now();

  // Every stream the platform collected, the Creators' half included, as the spec sums it (the Burn's own basis is net of that half).
  const revenueSol = (revenue?.totals ?? []).reduce((s, t) => s + value(t.asset, t.total), 0);
  const creatorsSol = (revenue?.totals ?? []).reduce((s, t) => s + value(t.asset, t.creatorForwarded), 0);
  const stoker = burns?.platformToken ? burns.burned.find((b) => b.coin.mint === burns.platformToken) : undefined;
  const burned = stoker ? units(stoker.amount, stoker.coin.decimals) : 0;
  const figures: Figure[] = [
    revenueSol > 0 && { key: "revenue", term: "Revenue, all time", value: formatFigure(revenueSol), unit: "SOL", href: "#ledger" },
    creatorsSol > 0 && { key: "creators", term: "Sent to Creators", value: formatFigure(creatorsSol), unit: "SOL", href: "#ledger" },
    stoker && burned > 0 && { key: "burned", term: `${quoteTicker(stoker.coin)} burned`, value: formatFigure(burned), href: "/burns#events" },
    burns && burns.shares.burnBps > 0 && { key: "share", term: "Of revenue to the Burn", value: pct(burns.shares.burnBps), href: "/fees#share" },
  ].filter((f): f is Figure => Boolean(f));

  const bars = revenue ? dailyBars(revenue.days, value) : null;
  const totals = (revenue?.totals ?? [])
    .map((t) => ({ t, rows: STREAMS.filter(([key]) => BigInt(t[key]) > 0n) }))
    .filter(({ rows }) => rows.length > 0);

  return (
    <>
      <div className="shell page-head">
        <h1>Stats</h1>
        <Link className="arrow" href="/burns">Burn and Flywheel</Link>
      </div>
      <Figures figures={figures} />

      {bars && (
        <section className="shell section" id="days" aria-labelledby="days-title">
          <div className="section-head">
            <h2 id="days-title">Daily revenue</h2>
            <span className="muted">SOL</span>
          </div>
          <div className="panel pad">
            <svg className={styles.bars} viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true" data-bars>
              {bars.map((b, i) => (
                <rect key={i} x={b.x} y={100 - b.h} width={b.w} height={b.h} rx="1" />
              ))}
            </svg>
          </div>
        </section>
      )}

      {totals.length > 0 && (
        <section className="shell section" id="assets" aria-labelledby="assets-title">
          <div className="section-head">
            <h2 id="assets-title">By asset</h2>
          </div>
          <div className={styles.cards}>
            {totals.map(({ t, rows }) => (
              <div key={t.asset.mint} className="panel pad" data-asset={t.asset.mint}>
                <div className={styles.head}>
                  <AssetTile quote={t.asset} />
                  <span>
                    <b>{quoteTicker(t.asset)}</b>
                    <span>All time</span>
                  </span>
                </div>
                <dl className="kv">
                  {rows.map(([key, term]) => (
                    <div key={key}>
                      <dt>{term}</dt>
                      <dd className="num">{formatEntryAmount(t[key], t.asset.decimals)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {platform && ledger && ledger.entries.length > 0 && (
        <section className="shell section" id="ledger" aria-labelledby="ledger-title">
          <div className="section-head">
            <h2 id="ledger-title">Ledger</h2>
          </div>
          <LedgerTable initial={ledger} platform={platform} renderedAt={renderedAt} />
        </section>
      )}

      {revenue && (
        <section className="shell section" id="where" aria-labelledby="where-title">
          <div className="section-head">
            <h2 id="where-title">Where it goes</h2>
          </div>
          <dl className="panel pad kv">
            <div>
              <dt>To Creators</dt>
              <dd>Half, within the hour</dd>
            </div>
            <div>
              <dt>Operations wallet</dt>
              <dd>
                {platform ? (
                  <a className="link mono" href={explorerUrl("address", revenue.operationsWallet, platform)} target="_blank" rel="noreferrer">
                    {shortAddress(revenue.operationsWallet)}
                  </a>
                ) : (
                  <span className="mono">{shortAddress(revenue.operationsWallet)}</span>
                )}
              </dd>
            </div>
            {revenue.treasury && (
              <div>
                <dt>Treasury</dt>
                <dd>
                  {platform ? (
                    <a className="link mono" href={explorerUrl("address", revenue.treasury, platform)} target="_blank" rel="noreferrer">
                      {shortAddress(revenue.treasury)}
                    </a>
                  ) : (
                    <span className="mono">{shortAddress(revenue.treasury)}</span>
                  )}
                </dd>
              </div>
            )}
            {BigInt(revenue.sweepThresholdLamports) > 0n && (
              <div>
                <dt>Swept above</dt>
                <dd>{formatEntryAmount(revenue.sweepThresholdLamports, SOL_DECIMALS)} SOL</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </>
  );
}
