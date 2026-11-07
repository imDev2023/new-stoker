"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState } from "react";
import type { AirdropStatus, CreatorEarnings, CreatorForward, CurveStatus, PlatformInfo } from "@launchpad/contract";
import { getAirdrop, getCreatorEarnings, listCreatorForwards } from "@/lib/api";
import { explorerUrl, formatDate, formatEntryAmount, formatFigure, formatUnits, quoteTicker, SOL_DECIMALS, units } from "@/lib/format";
import { AirdropPanel } from "./AirdropPanel";
import { AssetTile } from "./AssetTile";
import { PairName, PairTile } from "./Pair";
import { WalletButton } from "./WalletButton";
import styles from "./CreatorEarnings.module.css";

const REFRESH_MS = 10_000;

/** Where a coin earns its Creator: its curve until it sells out, its Raydium pool after Graduation. */
const VENUE: Record<CurveStatus, string> = { live: "Curve", graduating: "Graduating", graduated: "Pool" };

type Loaded = { creator: string; earnings: CreatorEarnings; forwards: CreatorForward[]; airdrops: AirdropStatus[] };

/**
 * The connected Creator's own page (`/creator`, ADR 0009; owner, 2026-10-08: no public creator page, reached from the
 * account menu once the wallet has launched a coin): what their coins earned in each Quote Asset, what has been sent
 * and what is still to come, each coin, the airdrops they launched with (sent from here, #13), every payment with its
 * transaction, and how they are paid. Production's `CreatorDashboard` in the spec's system: every part waits for a real
 * value, and nothing loaded for another wallet is shown for this one.
 */
export function CreatorEarningsView({ platform }: { platform: PlatformInfo }) {
  const { publicKey } = useWallet();
  const creator = publicKey?.toBase58() ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!creator) return;
    let gone = false;
    const refresh = async () => {
      try {
        const [earnings, { forwards }] = await Promise.all([getCreatorEarnings(creator), listCreatorForwards(creator)]);
        if (!earnings) return;
        // A coin launched without an airdrop answers 404, read as none.
        const airdrops = (await Promise.all(earnings.launches.map((l) => getAirdrop(l.mint).catch(() => null)))).filter((a): a is AirdropStatus => a !== null);
        if (!gone) setLoaded({ creator, earnings, forwards, airdrops });
      } catch {
        // The last good read stays; the next tick tries again.
      }
    };
    void refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      gone = true;
      clearInterval(id);
    };
  }, [creator]);

  const own = loaded?.creator === creator ? loaded : null;

  return (
    <>
      <div className="shell page-head">
        <h1>Your earnings</h1>
        {own && own.earnings.launches.length > 0 && (
          <Link className="arrow" href="/fees">
            Every fee, explained
          </Link>
        )}
      </div>
      {!creator ? (
        <section className="shell section" aria-label="Connect">
          <div className={styles.connect}>
            <WalletButton block />
          </div>
        </section>
      ) : !own ? (
        <div className="shell" aria-busy="true" />
      ) : own.earnings.launches.length === 0 ? (
        <section className="shell section" aria-label="No coins yet">
          <div className={styles.none}>
            <p className="muted">No coin launched from this wallet yet.</p>
            <Link className="button button-lg" href="/launch">
              Stoke a coin
            </Link>
          </div>
        </section>
      ) : (
        <Earnings loaded={own} platform={platform} />
      )}
    </>
  );
}

function Earnings({ loaded: { earnings, forwards, airdrops }, platform }: { loaded: Loaded; platform: PlatformInfo }) {
  // An asset whose coins have never traded has earned nothing: nothing to show for it.
  const assets = earnings.assets.filter((a) => a.earned !== "0" || a.forwarded !== "0");
  const symbols = new Map(earnings.launches.map((l) => [l.mint, l]));
  const graduationFee = platform.graduationFeeLamports === "0" ? null : formatUnits(platform.graduationFeeLamports, SOL_DECIMALS, 4);

  return (
    <>
      {assets.length > 0 && (
        <section className="shell" aria-label="Earned" data-figures>
          <dl className="figures">
            {assets.map((a) => (
              <div key={a.quote.mint} data-figure={a.quote.mint}>
                <dt>Earned in {quoteTicker(a.quote)}</dt>
                <dd>
                  {formatFigure(units(a.earned, a.quote.decimals))}
                  <small>{quoteTicker(a.quote)}</small>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {assets.length > 0 && (
        <section className="shell section" id="assets" aria-labelledby="assets-title">
          <div className="section-head">
            <h2 id="assets-title">By asset</h2>
          </div>
          <div className={styles.cards}>
            {assets.map((a) => {
              const rows: [string, string][] = (
                [
                  ["Earned", a.earned],
                  ["Sent to you", a.forwarded],
                  ["To come", a.pending],
                  ["Kept as Graduation Fees", a.withheld],
                ] as [string, string][]
              ).filter(([, raw]) => raw !== "0");
              return (
                <div key={a.quote.mint} className="panel pad" data-asset={a.quote.mint}>
                  <div className={styles.cardHead}>
                    <AssetTile quote={a.quote} />
                    <b>{quoteTicker(a.quote)}</b>
                  </div>
                  <dl className="kv">
                    {rows.map(([term, raw]) => (
                      <div key={term}>
                        <dt>{term}</dt>
                        <dd className="num">{formatEntryAmount(raw, a.quote.decimals)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="shell section" id="coins" aria-labelledby="coins-title">
        <div className="section-head">
          <h2 id="coins-title">Your coins</h2>
        </div>
        <div className="panel table-wrap">
          <table className="table" aria-label="Your coins">
            <thead>
              <tr>
                <th scope="col">Coin</th>
                <th scope="col">Trades on</th>
                <th scope="col" className="r">Earned</th>
              </tr>
            </thead>
            <tbody>
              {earnings.launches.map((l) => {
                const earned = (BigInt(l.curve) + BigInt(l.pool)).toString();
                return (
                  <tr key={l.mint} data-mint={l.mint}>
                    <td>
                      <Link className={styles.coin} href={`/coin/${l.mint}`}>
                        <PairTile image={l.image} symbol={l.symbol} quote={l.quote} />
                        <span className={styles.names}>
                          <b>
                            <PairName symbol={l.symbol} quote={l.quote} />
                          </b>
                          <span className="muted">{l.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={styles.badges}>
                        <span className="badge">{VENUE[l.status]}</span>
                        {l.graduationFee && <span className="badge">{l.graduationFee.settledAt ? "Graduation Fee paid" : "Graduation Fee due"}</span>}
                      </span>
                    </td>
                    <td className="r num">{earned === "0" ? "" : `${formatEntryAmount(earned, l.quote.decimals)} ${quoteTicker(l.quote)}`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {airdrops.length > 0 && (
        <section className="shell section" id="airdrops" aria-labelledby="airdrops-title">
          <div className="section-head">
            <h2 id="airdrops-title">Airdrops</h2>
          </div>
          <div className={styles.airdrops}>
            {airdrops.map((a) => {
              const coin = symbols.get(a.mint)!;
              return <AirdropPanel key={a.mint} initial={a} symbol={coin.symbol} quote={coin.quote} platform={platform} />;
            })}
          </div>
        </section>
      )}

      {forwards.length > 0 && (
        <section className="shell section" id="payments" aria-labelledby="payments-title">
          <div className="section-head">
            <h2 id="payments-title">Payments</h2>
            <Link className="arrow" href="/revenue#ledger">
              The Ledger
            </Link>
          </div>
          <div className="panel table-wrap">
            <table className="table" aria-label="Payments">
              <tbody>
                {forwards.map((f) => (
                  <tr key={f.signature} data-status={f.status}>
                    <td>
                      <a className="link num" href={explorerUrl("tx", f.signature, platform)} target="_blank" rel="noreferrer">
                        {formatEntryAmount(f.amount, f.quote.decimals)} {quoteTicker(f.quote)}
                      </a>
                    </td>
                    <td className="r muted">
                      {f.status === "sending" ? <span className="badge">On its way</span> : <time dateTime={f.time}>{formatDate(f.time)}</time>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="shell section" id="paid" aria-labelledby="paid-title">
        <div className="section-head">
          <h2 id="paid-title">How you&apos;re paid</h2>
        </div>
        <dl className={`panel pad kv ${styles.rules}`}>
          <div>
            <dt>On the curve</dt>
            <dd>Half of each trade&apos;s Platform Fee</dd>
          </div>
          <div>
            <dt>After graduation</dt>
            <dd>Half of the pool&apos;s creator fee</dd>
          </div>
          <div>
            <dt>Sent</dt>
            <dd>Within about an hour, from {formatUnits(platform.creatorForward.minLamports, SOL_DECIMALS)} SOL</dd>
          </div>
          {graduationFee && (
            <div>
              <dt>Graduation Fee</dt>
              <dd>{graduationFee} SOL from earnings</dd>
            </div>
          )}
          <div>
            <dt>Nothing to claim</dt>
            <dd>Paid to this wallet</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
