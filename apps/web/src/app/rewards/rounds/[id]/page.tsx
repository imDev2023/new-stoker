import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PlatformInfo, RewardPayout, RewardRoundDetail } from "@launchpad/contract";
import { getLaunch, getPlatform, getRewardRound } from "@/lib/api";
import { COIN_DECIMALS, explorerUrl, formatDate, formatEntryAmount, formatUnits, shortAddress } from "@/lib/format";
import styles from "./page.module.css";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const round = await getRewardRound((await params).id).catch(() => null);
  if (!round) return { title: "Round not found", robots: { index: false } };
  const launch = await getLaunch(round.mint).catch(() => null);
  return {
    title: `${launch?.symbol ?? shortAddress(round.mint)} round of ${formatDate(round.startedAt)}`,
    description: "One Reward Round: the Reward Launch it paid, its snapshot of holders, the pot and every payout.",
  };
}

const coins = (raw: string) => formatUnits(raw, COIN_DECIMALS, 0);

/**
 * A single Reward Round (#13; production's `/rewards/rounds/<id>`, in the spec's system): the pot, the holders and what
 * has been paid as figures, the round's facts, and every payout, each wallet linked to its own rewards and each paid
 * amount to its transaction. Linked from a wallet's rewards on `/rewards`.
 */
export default async function RewardRoundPage({ params }: Props) {
  const round = await getRewardRound((await params).id);
  if (!round) notFound();
  const [launch, platform] = await Promise.all([getLaunch(round.mint).catch(() => null), getPlatform().catch(() => null)]);
  const symbol = launch?.symbol ?? shortAddress(round.mint);
  const paid = (raw: string) => formatEntryAmount(raw, round.payout.decimals);
  const figures = [
    round.pot !== "0" && { key: "pot", term: "Pot", value: paid(round.pot), unit: round.payout.symbol },
    round.eligibleHolders > 0 && { key: "holders", term: round.eligibleHolders === 1 ? "Eligible holder" : "Eligible holders", value: round.eligibleHolders.toLocaleString("en-US") },
    round.status === "paying" && round.paid !== "0" && { key: "paid", term: "Paid so far", value: paid(round.paid), unit: round.payout.symbol },
  ].filter((f): f is { key: string; term: string; value: string; unit?: string } => Boolean(f));

  return (
    <>
      <div className="shell page-head">
        <h1>
          <Link href={`/coin/${round.mint}`}>{symbol}</Link> round
        </h1>
        <Link className="arrow" href="/rewards">
          Holder rewards
        </Link>
      </div>

      {figures.length > 0 && (
        <section className="shell" aria-label="Figures" data-figures>
          <dl className="figures">
            {figures.map((f) => (
              <div key={f.key} data-figure={f.key}>
                <dt>{f.term}</dt>
                <dd>
                  {f.value}
                  {f.unit && <small>{f.unit}</small>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="shell section" id="round" aria-labelledby="round-title">
        <div className="section-head">
          <h2 id="round-title">{round.status === "paid" ? "Paid in full" : "Paying out"}</h2>
        </div>
        <RoundFacts round={round} symbol={symbol} />
      </section>

      {round.payouts.length > 0 && (
        <section className="shell section" id="payouts" aria-labelledby="payouts-title">
          <div className="section-head">
            <h2 id="payouts-title">Payouts</h2>
          </div>
          <div className="panel table-wrap">
            <table className="table" aria-label="Payouts">
              <thead>
                <tr>
                  <th scope="col">Wallet</th>
                  <th scope="col" className="r">Held</th>
                  <th scope="col" className="r">Paid</th>
                </tr>
              </thead>
              <tbody>
                {round.payouts.map((p) => (
                  <Payout key={p.wallet} payout={p} symbol={round.payout.symbol} amount={paid(p.amount)} platform={platform} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/** The round's facts: what it pays in, the tax sold for it, the snapshot, the rules it follows and when it ran. */
function RoundFacts({ round, symbol }: { round: RewardRoundDetail; symbol: string }) {
  return (
    <dl className="panel pad kv">
      <div>
        <dt>Paid in</dt>
        <dd>{round.payout.symbol}</dd>
      </div>
      {round.sold !== null && round.sold !== "0" && (
        <div>
          <dt>Tax sold for it</dt>
          <dd className="num">
            {coins(round.sold)} {symbol}
          </dd>
        </div>
      )}
      <div>
        <dt>Snapshot slot</dt>
        <dd className="mono">{round.snapshotSlot}</dd>
      </div>
      <div>
        <dt>Rules</dt>
        <dd>
          <Link className="link" href="/rewards#rules">
            Version {round.rulesVersion}
          </Link>
        </dd>
      </div>
      <div>
        <dt>Started</dt>
        <dd>
          <time dateTime={round.startedAt} data-date>{formatDate(round.startedAt)}</time>
        </dd>
      </div>
      {round.finishedAt && (
        <div>
          <dt>Finished</dt>
          <dd>
            <time dateTime={round.finishedAt} data-date>{formatDate(round.finishedAt)}</time>
          </dd>
        </div>
      )}
    </dl>
  );
}

/** One wallet's payout: its address, linked to its own rewards; what it held at the snapshot; what it was paid. */
function Payout({ payout: p, symbol, amount, platform }: { payout: RewardPayout; symbol: string; amount: string; platform: PlatformInfo | null }) {
  const text = `${amount} ${symbol}`;
  return (
    <tr data-status={p.status}>
      <td>
        <Link className="link mono" href={`/rewards?wallet=${p.wallet}`}>
          {shortAddress(p.wallet)}
        </Link>
      </td>
      <td className="r num">{coins(p.holding)}</td>
      <td className="r">
        <span className={styles.paid}>
          {p.status === "paid" && p.signature && platform ? (
            <a className="link num" href={explorerUrl("tx", p.signature, platform)} target="_blank" rel="noreferrer">
              {text}
            </a>
          ) : (
            <span className="num">{text}</span>
          )}
          {(p.status === "unpaid" || p.status === "sending") && <span className="badge">Paying</span>}
          {p.status === "returned" && <span className="badge">Returned to the pot</span>}
        </span>
      </td>
    </tr>
  );
}
