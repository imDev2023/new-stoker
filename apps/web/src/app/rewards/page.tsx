import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import type { PlatformInfo, RewardRuleVersion, WalletRewards } from "@launchpad/contract";
import { Steps } from "@/components/Steps";
import { getPlatform, getRewardRules, getWalletRewards } from "@/lib/api";
import { COIN_DECIMALS, explorerUrl, formatDate, formatEntryAmount, formatUnits } from "@/lib/format";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Holder rewards",
  description: "How a Reward Launch pays its holders, the rules in force, and the rewards of any wallet.",
};

/** A Solana address, as the API's contract reads one. */
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * The spec's three steps (`rewards.html`). The Reward Tax's rates are fee figures, which live on `/fees` alone (owner,
 * 2026-10-30), so the first step names where they are instead of the spec's "1%, 3% or 5%".
 */
const STEPS = [
  { title: "A tax on every transfer", text: <>Fixed by the Creator at launch, at one of the rates on <Link href="/fees#rewardTax">Fees</Link>.</> },
  { title: "Collected into rounds", text: "A round runs once enough tax has collected." },
  { title: "Paid by holding", text: "Pro rata, in the coin or the asset it trades in." },
];

const coins = (raw: string) => `${formatUnits(raw, COIN_DECIMALS, 0)} coins`;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Holder rewards (#12, the spec's `rewards.html`): how a Reward Launch pays its holders as three steps, any wallet's
 * rewards looked up in place (the address in `?wallet=`, so a lookup is a link and works before the page's script),
 * the rules in force and any change announced to them. A read that fails leaves its part out.
 */
export default async function RewardsPage({ searchParams }: Props) {
  const asked = (await searchParams).wallet;
  const wallet = typeof asked === "string" ? asked.trim() : "";
  const valid = ADDRESS.test(wallet);
  // A wallet's rewards: null when the API refuses the address, undefined when there is none to ask about or the read failed.
  const [rules, rewards, platform] = await Promise.all([
    getRewardRules().catch(() => null),
    valid ? getWalletRewards(wallet).catch(() => undefined) : undefined,
    getPlatform().catch(() => null),
  ]);
  const invalid = wallet !== "" && (!valid || rewards === null);
  return (
    <>
      <div className="shell page-head">
        <h1>Holder rewards</h1>
      </div>
      <Steps label="How holders are paid" steps={STEPS} />

      <section className="shell section" id="lookup" aria-labelledby="lookup-title">
        <div className="section-head">
          <h2 id="lookup-title">Your rewards</h2>
        </div>
        <Form action="/rewards" scroll={false} className={styles.lookup} aria-label="Look up a wallet's rewards">
          <label className={`search ${styles.search}`}>
            <span className="visually-hidden">Wallet address</span>
            <input
              key={wallet}
              className="input"
              name="wallet"
              defaultValue={wallet}
              placeholder="Wallet address"
              autoComplete="off"
              spellCheck={false}
              required
              pattern={ADDRESS.source.slice(1, -1)}
              aria-invalid={invalid}
            />
          </label>
          <button className="button button-lg" type="submit">
            Show
          </button>
        </Form>
        {invalid && <p className={styles.note}>Enter a Solana wallet address.</p>}
        {rewards && <WalletRewardsTable rewards={rewards} platform={platform} />}
      </section>

      {rules?.inForce && <RulesInForce rules={rules.inForce} />}
      {rules && rules.upcoming.length > 0 && <AnnouncedRules upcoming={rules.upcoming} />}
    </>
  );
}

/** A wallet's rewards, newest round first: the coin, the round's date (linked to the round's page, #13), and what it paid, linked to its transaction. */
function WalletRewardsTable({ rewards, platform }: { rewards: WalletRewards; platform: PlatformInfo | null }) {
  if (rewards.rewards.length === 0) return <p className={styles.note}>No rewards for this wallet yet.</p>;
  return (
    <div className={`panel table-wrap ${styles.rewards}`}>
      <table className="table" aria-label="Rewards" data-wallet={rewards.wallet}>
        <tbody>
          {rewards.rewards.map((r) => {
            const amount = `${formatEntryAmount(r.amount, r.payout.decimals)} ${r.payout.symbol}`;
            return (
              <tr key={`${r.round}.${r.mint}`} data-status={r.status}>
                <td>
                  <Link href={`/coin/${r.mint}`}>
                    <b>{r.symbol}</b>
                  </Link>
                </td>
                <td className="muted">
                  <Link className="link" href={`/rewards/rounds/${r.round}`}>
                    <time dateTime={r.roundStartedAt} data-date>{formatDate(r.roundStartedAt)}</time>
                  </Link>
                </td>
                <td className="r">
                  {r.status === "paid" && r.signature && platform ? (
                    <a className="link" href={explorerUrl("tx", r.signature, platform)} target="_blank" rel="noreferrer">
                      {amount}
                    </a>
                  ) : (
                    amount
                  )}
                  {(r.status === "unpaid" || r.status === "sending") && <span className={`badge ${styles.state}`}>Paying</span>}
                  {r.status === "returned" && <span className={`badge ${styles.state}`}>Returned to the pot</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The rules every round follows now. The treasury counts as a holder (owner, 2026-10-04, "the rewards page says so"):
 * it holds the coins swept from pool fees and takes its share of a round like any wallet; only the operations wallet,
 * which collects the tax, never does.
 */
function RulesInForce({ rules }: { rules: RewardRuleVersion }) {
  return (
    <section className="shell section" id="rules" aria-labelledby="rules-title">
      <div className="section-head">
        <h2 id="rules-title">Rules in force</h2>
      </div>
      <dl className="panel pad kv">
        <div>
          <dt>Version</dt>
          <dd>{rules.version}</dd>
        </div>
        <div>
          <dt>Minimum holding</dt>
          <dd>{coins(rules.minHolding)}</dd>
        </div>
        <div>
          <dt>A round runs once</dt>
          <dd>{coins(rules.roundThreshold)} of tax have collected</dd>
        </div>
        <div>
          <dt>Holders</dt>
          <dd>
            Every wallet but the operations wallet, <Link className="link" href="/revenue#where">the treasury</Link> included
          </dd>
        </div>
        <div>
          <dt>In force since</dt>
          <dd>
            <time dateTime={rules.effectiveAt} data-date>{formatDate(rules.effectiveAt)}</time>
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** A change to the rules is announced ahead of the day it applies (ADR 0006), so a holder sees it coming. */
function AnnouncedRules({ upcoming }: { upcoming: RewardRuleVersion[] }) {
  return (
    <section className="shell section" id="announced" aria-labelledby="announced-title">
      <div className="section-head">
        <h2 id="announced-title">Announced changes</h2>
      </div>
      <dl className="panel pad kv">
        {upcoming.map((r) => (
          <div key={r.version} data-version={r.version}>
            <dt>
              Version {r.version} from <time dateTime={r.effectiveAt} data-date>{formatDate(r.effectiveAt)}</time>
            </dt>
            <dd>
              {coins(r.minHolding)} to be paid, a round from {coins(r.roundThreshold)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
