"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  LINK_KINDS, type CandleInterval, type CandleList, type HolderList, type LaunchSummary, type LaunchTrust, type LinkKind,
  type PlatformInfo, type QuoteAsset, type Trade,
} from "@launchpad/contract";
import { getCandles, getHolders, getLaunch, getTrust, listTrades } from "@/lib/api";
import {
  COIN_DECIMALS, explorerUrl, formatChange, formatDate, formatFigure, formatPriceCompact, quoteTicker, shortAddress, timeAgo, units,
} from "@/lib/format";
import { CoinTile, PairName, PairTile } from "./Pair";
import { LineChart } from "./LineChart";
import { TradePanel } from "./TradePanel";
import styles from "./CoinMarket.module.css";

/** How often the price, the curve, the trades and the chart are read again. */
const REFRESH_MS = 4_000;
/** Holders are read from the chain on every request, so they and the trust figures refresh less often, and after a trade. */
const HOLDERS_REFRESH_MS = 12_000;
/** The chart's intervals, the spec's four. */
const INTERVALS = ["5m", "15m", "1h", "1d"] as const satisfies readonly CandleInterval[];

const LINK_LABELS: Record<LinkKind, string> = {
  telegram: "Telegram", x: "X", website: "Website", discord: "Discord", tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube",
};
const HOLDER_LABELS: Partial<Record<HolderList["holders"][number]["kind"], string>> = {
  curve: "Curve", pool: "Raydium pool", creator: "Creator", treasury: "Treasury", operations: "Operations",
};

/**
 * The live part of a coin page, laid out as the spec's `coin.html`: the title row (the pair, its name, the before-you-buy
 * marks and the price with its day's change), then the chart, the curve and the trades and holders in the main column,
 * and the trade panel, the asset the coin is paired with and its facts beside them; on a phone the chart comes first,
 * then the trade panel. Everything is drawn here from data and kept up to date from the browser; after Graduation the
 * same page trades in the coin's Raydium pool.
 */
export function CoinMarket({
  initial, platform, quoteAsset, initialTrades, initialCandles, initialHolders, initialTrust, renderedAt,
}: {
  initial: LaunchSummary;
  platform: PlatformInfo;
  /** The asset the coin is paired with, for its card; null when the registry could not be read. */
  quoteAsset: QuoteAsset | null;
  initialTrades: Trade[];
  initialCandles: CandleList;
  /** Null when the chain couldn't be read at render; the next refresh retries. */
  initialHolders: HolderList | null;
  initialTrust: LaunchTrust | null;
  /** The server's clock at render, so the trades' ages hydrate to the same text. */
  renderedAt: number;
}) {
  const [launch, setLaunch] = useState(initial);
  const [trades, setTrades] = useState(initialTrades);
  const [candles, setCandles] = useState(initialCandles);
  const [holders, setHolders] = useState(initialHolders);
  const [trust, setTrust] = useState(initialTrust);
  const [now, setNow] = useState(renderedAt);
  const [tab, setTab] = useState<"trades" | "holders">("trades");
  const shownInterval = useRef<CandleInterval>(initialCandles.interval);
  const q = quoteTicker(launch.quote);

  // Candles for an interval the visitor has since switched away from are dropped.
  const loadCandles = useCallback(async (interval: CandleInterval) => {
    const c = await getCandles(launch.mint, interval);
    if (c.interval === shownInterval.current) setCandles(c);
  }, [launch.mint]);

  const refresh = useCallback(async () => {
    const [l, t] = await Promise.allSettled([getLaunch(launch.mint), listTrades(launch.mint), loadCandles(shownInterval.current)]);
    // Whatever failed keeps its last good value; the next tick retries.
    if (l.status === "fulfilled" && l.value) setLaunch(l.value);
    if (t.status === "fulfilled") setTrades(t.value.trades);
    setNow(Date.now());
  }, [launch.mint, loadCandles]);

  const refreshHolders = useCallback(async () => {
    const [h, t] = await Promise.allSettled([getHolders(launch.mint), getTrust(launch.mint)]);
    if (h.status === "fulfilled") setHolders(h.value);
    if (t.status === "fulfilled") setTrust(t.value);
  }, [launch.mint]);

  useEffect(() => {
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => void refreshHolders(), HOLDERS_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshHolders]);

  function changeInterval(next: CandleInterval) {
    shownInterval.current = next;
    setCandles((c) => ({ ...c, interval: next }));
    loadCandles(next).catch(() => undefined);
  }

  const change = formatChange(launch.market.change24h);
  const marks = beforeYouBuy(holders, trust);
  const cap = launch.market.marketCap?.quote;
  const volume = launch.market.volume24h.quote;

  return (
    <div className="shell">
      <header className={styles.head}>
        <PairTile image={launch.image} symbol={launch.symbol} quote={launch.quote} large />
        <div className={styles.words}>
          <h1 className={styles.pair}>
            <PairName symbol={launch.symbol} quote={launch.quote} />
          </h1>
          <p className="muted">
            {launch.name} · <a className="link" href={explorerUrl("address", launch.mint, platform)} target="_blank" rel="noreferrer">Explorer</a>
          </p>
          {marks.length > 0 && (
            <ul className={styles.marks} aria-label="Before you buy">
              {marks.map(([tone, text]) => (
                <li key={text} className={styles[tone]}>{text}</li>
              ))}
            </ul>
          )}
        </div>
        {launch.market.price !== null && (
          <p className={styles.price}>
            <b>{formatPriceCompact(launch.market.price)} {q}</b>
            {change.text && <span className={change.direction ?? undefined}>{change.text}</span>}
          </p>
        )}
      </header>

      <div className={styles.grid}>
        <div className={styles.main}>
          <section className={`panel pad ${styles.chartPanel}`} aria-label="Price">
            <div className="section-head">
              <dl className={styles.stats}>
                {cap ? <div><dt>Market cap</dt><dd>{formatFigure(cap)} {q}</dd></div> : null}
                {volume ? <div><dt>24h volume</dt><dd>{formatFigure(volume)} {q}</dd></div> : null}
              </dl>
              <div className="seg" role="radiogroup" aria-label="Interval">
                {INTERVALS.map((i) => (
                  <label key={i}>
                    <input type="radio" name="interval" value={i} checked={candles.interval === i} onChange={() => changeInterval(i)} />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <LineChart candles={candles.candles} />
          </section>

          <Graduation launch={launch} />

          <section className="panel" aria-label="Activity">
            <div className={`pad ${styles.tabs}`}>
              <div className="seg" role="radiogroup" aria-label="Activity">
                {(["trades", "holders"] as const).map((t) => (
                  <label key={t}>
                    <input type="radio" name="activity" value={t} checked={tab === t} onChange={() => setTab(t)} />
                    {t === "trades" ? "Trades" : "Top holders"}
                  </label>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              {tab === "trades" ? (
                <Trades trades={trades} launch={launch} platform={platform} now={now} />
              ) : (
                <Holders holders={holders} platform={platform} />
              )}
            </div>
          </section>
        </div>

        <aside className={styles.aside}>
          <TradePanel launch={launch} platform={platform} onTraded={() => void Promise.all([refresh(), refreshHolders()])} />
          {quoteAsset && <QuoteCard asset={quoteAsset} />}
          <About launch={launch} platform={platform} />
        </aside>
      </div>
    </div>
  );
}

type Tone = "ok" | "caution" | "down" | "none";

/**
 * Before you buy (ADR 0013): what the Creator holds, who sniped the launch and how much the ten largest wallets hold,
 * each a dot and a few words; a mark waits for the figures it reads.
 */
function beforeYouBuy(holders: HolderList | null, trust: LaunchTrust | null): [Tone, string][] {
  const marks: [Tone, string][] = [];
  if (holders) {
    const c = holders.creator;
    marks.push(c.status === "holding" ? ["ok", `Creator ${(c.share * 100).toFixed(1)}%`] : c.status === "sold" ? ["down", "Creator sold"] : ["none", "Creator 0%"]);
  }
  if (trust) {
    const n = trust.snipers.wallets.length;
    marks.push(n === 0 ? ["ok", "No snipers"] : ["caution", `${n} sniper${n === 1 ? "" : "s"}`]);
  }
  if (holders) {
    const top = holders.holders.filter((h) => h.kind !== "curve" && h.kind !== "pool").slice(0, 10).reduce((s, h) => s + h.share, 0);
    // Before the first buy nobody but the curve holds any: no mark, rather than a zero (the spec's rule).
    if (top > 0) marks.push([top > 0.5 ? "caution" : "ok", `Top 10 ${(top * 100).toFixed(1)}%`]);
  }
  return marks;
}

/** The curve's progress toward its Graduation Target, or the pool it trades in since. */
function Graduation({ launch }: { launch: LaunchSummary }) {
  const q = quoteTicker(launch.quote);
  const raised = units(launch.curve.raised, launch.quote.decimals);
  const target = units(launch.graduationTarget, launch.quote.decimals);
  const status = launch.curve.status;
  const share = status === "live" ? Math.min(1, raised / target) : 1;
  const percent = Math.round(share * 100);
  return (
    <section className="panel pad" aria-labelledby="curve-title">
      <div className={styles.curveHead}>
        <h2 id="curve-title">Graduation</h2>
        {status === "graduated" ? <span className="badge badge-gold">Graduated</span> : <span>{percent}%</span>}
      </div>
      <div className="progress" role="progressbar" aria-labelledby="curve-title" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <span style={{ "--value": `${share * 100}%` } as CSSProperties} />
      </div>
      <p className={styles.note}>
        {status === "graduated"
          ? "Trades in its own Raydium pool, liquidity locked."
          : status === "graduating"
            ? "Sold out. Raydium is moving it to its own pool."
            : `${formatFigure(raised)} of ${formatFigure(target)} ${q} raised.`}
      </p>
    </section>
  );
}

function Trades({ trades, launch, platform, now }: { trades: Trade[]; launch: LaunchSummary; platform: PlatformInfo; now: number }) {
  if (trades.length === 0) return null;
  return (
    <table className="table" aria-label="Trades">
      <thead>
        <tr>
          <th scope="col">Side</th>
          <th scope="col" className="r">{launch.symbol}</th>
          <th scope="col" className="r">{quoteTicker(launch.quote)}</th>
          <th scope="col" className={styles.wide}>Trader</th>
          <th scope="col" className={`r ${styles.when}`}>Time</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.signature}>
            <td className={t.side === "buy" ? "up" : "down"}>{t.side === "buy" ? "Buy" : "Sell"}</td>
            <td className="r">{formatFigure(units(t.baseAmount, COIN_DECIMALS))}</td>
            <td className="r">{formatPriceCompact(units(t.quoteAmount, launch.quote.decimals))}</td>
            <td className={styles.wide}>
              <a className="link mono" href={explorerUrl("address", t.trader, platform)} target="_blank" rel="noreferrer">{shortAddress(t.trader)}</a>
            </td>
            <td className={`r ${styles.when}`}>
              <a className="link" href={explorerUrl("tx", t.signature, platform)} target="_blank" rel="noreferrer">
                <time dateTime={t.time}>{timeAgo(t.time, now)}</time>
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Holders({ holders, platform }: { holders: HolderList | null; platform: PlatformInfo }) {
  if (!holders || holders.holders.length === 0) return null;
  return (
    <table className="table" aria-label="Top holders">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Wallet</th>
          <th scope="col" className="r">Share</th>
        </tr>
      </thead>
      <tbody>
        {holders.holders.map((h, i) => (
          <tr key={h.owner}>
            <td className="muted">{i + 1}</td>
            <td>
              <span className={styles.holder}>
                <a className="link mono" href={explorerUrl("address", h.owner, platform)} target="_blank" rel="noreferrer">{shortAddress(h.owner)}</a>
                {HOLDER_LABELS[h.kind] && <span className="badge">{HOLDER_LABELS[h.kind]}</span>}
              </span>
            </td>
            <td className="r">{(h.share * 100).toFixed(2)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The asset the coin is paired with: its price, its liquidity, where a coin graduates in it, and its risk labels. */
function QuoteCard({ asset }: { asset: QuoteAsset }) {
  const symbol = quoteTicker(asset);
  const cautions = (asset.labels ?? []).filter((l) => l.severity === "caution").length;
  const usd = asset.price?.usd ? Number(asset.price.usd) : null;
  const facts = [
    [`1 ${symbol}`, usd ? (usd >= 1 ? usd.toLocaleString("en-US", { style: "currency", currency: "USD" }) : `$${formatPriceCompact(usd)}`) : null],
    ["Liquidity", asset.liquidityUsd ? `$${formatFigure(asset.liquidityUsd)}` : null],
    ["Graduates at", asset.graduationTarget ? `${formatFigure(units(asset.graduationTarget.raw, asset.decimals))} ${symbol}` : null],
  ].filter((f): f is [string, string] => f[1] !== null);
  return (
    <Link className={`panel pad ${styles.quoteCard}`} href={`/asset/${asset.mint}`}>
      <div className={styles.cardHead}>
        {asset.logo ? <img className={`tile ${styles.assetTile}`} src={asset.logo} alt="" loading="lazy" /> : <CoinTile image={null} symbol={symbol} />}
        <span className={styles.cardName}>
          <b>Paired with {symbol}</b>
          {asset.name && <span>{asset.name}</span>}
        </span>
        <span className={cautions ? "badge badge-warn" : "badge"}>
          {asset.labels === null ? "Not checked yet" : cautions ? `${cautions} risk label${cautions === 1 ? "" : "s"}` : "No risk labels"}
        </span>
      </div>
      {facts.length > 0 && (
        <dl className="kv">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </Link>
  );
}

/** The coin's description and facts: how it launched, what its Creator earns (in words), its dates, addresses and links. */
function About({ launch, platform }: { launch: LaunchSummary; platform: PlatformInfo }) {
  const address = (value: string) => (
    <a className="link mono" href={explorerUrl("address", value, platform)} target="_blank" rel="noreferrer">{shortAddress(value)}</a>
  );
  const date = (iso: string) => <time dateTime={iso}>{formatDate(iso)}</time>;
  const links = LINK_KINDS.map((k) => [k, launch.links[k]] as const).filter((l): l is readonly [LinkKind, string] => Boolean(l[1]));
  const facts: [string, ReactNode][] = [
    ["Launch type", launch.rewardTax ? `Reward Launch, ${launch.rewardTax.bps / 100}%` : "Standard"],
    ["Creator earns", <Link key="fees" className="link" href="/fees">Half of what we collect</Link>],
    ["Launched", date(launch.createdAt)],
    ...(launch.graduation ? [["Graduated", date(launch.graduation.graduatedAt)] as [string, ReactNode]] : []),
    ["Protected until", date(launch.protection.until)],
    ...(launch.copyOf
      ? [["Copy of", <Link key="copy" className="link" href={`/coin/${launch.copyOf.mint}`}>{launch.copyOf.symbol}</Link>] as [string, ReactNode]]
      : []),
    ["Creator", address(launch.creator)],
    ["Coin", address(launch.mint)],
    ...links.map(([kind, href]) => [
      LINK_LABELS[kind],
      <a key={kind} className="link" href={href} target="_blank" rel="noreferrer nofollow">{href.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>,
    ] as [string, ReactNode]),
  ];
  return (
    <section className="panel pad" aria-labelledby="about-title">
      <h2 id="about-title" className="visually-hidden">About {launch.symbol}</h2>
      {launch.description && <p className={styles.desc}>{launch.description}</p>}
      <dl className="kv">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
