import type { Metadata } from "next";
import { REWARD_TAX_RATES, type BurnsPage, type PlatformInfo } from "@launchpad/contract";
import { getBurns, getPlatform } from "@/lib/api";
import { orList, pct } from "@/lib/fees";
import { formatUnits, SOL_DECIMALS } from "@/lib/format";
import { JUPITER_REFERRAL, JUPITER_REFERRAL_FEE_BPS } from "@/lib/jupiterReferral";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Fees",
  description: "Every fee you can pay on Stoker, who pays it, when, in what asset and who receives it, each figure read from the chain.",
};

type Fee = {
  id: string;
  name: string;
  /** The figure, or null while the chain can't be read: the entry stays, its figure waits. */
  amount: string | null;
  text: string;
  pays: string;
  when: string;
  asset: string;
  receives: string;
};

/**
 * Every fee, one entry each, in the spec's order and words (`fees.html`). An entry that does not apply on this deployment
 * is left out: the Graduation Fee when it is 0, the SOL route when there is none, the swap's referral fee until the
 * referral account is set.
 */
function feesOf(p: PlatformInfo | null): Fee[] {
  const graduation = p && p.graduationFeeLamports !== "0" ? formatUnits(p.graduationFeeLamports, SOL_DECIMALS, 9) : null;
  const rate = (bps: number | undefined, of = "of every trade") => (bps === undefined ? null : `${pct(bps)} ${of}`);
  const fees: (Fee | false)[] = [
    {
      id: "create",
      name: "Creating a coin",
      amount: "No platform fee",
      text: "Solana charges the launch transaction's network fee and the rent of the coin's accounts; the review on the launch form shows the figure. A First Buy pays a curve trade's fees like any trade, and a Reward Launch costs nothing more to create.",
      pays: "The Creator",
      when: "At launch",
      asset: "SOL",
      receives: "Solana",
    },
    (p === null || graduation !== null) && {
      id: "graduation",
      name: "Graduation Fee",
      amount: graduation && `${graduation} SOL's worth, once`,
      text: "Taken out of the Creator's earnings on the coin, never on top of them, from the next Creator Forward on until paid, and never more than the Creator is owed at the time. Each part is a graduation_fee entry on the Ledger.",
      pays: "The Creator, from their earnings",
      when: "Once the coin graduates",
      asset: "The coin's Quote Asset",
      receives: "The platform",
    },
    {
      id: "platform",
      name: "Platform Fee on the curve",
      amount: rate(p?.platformFeeBps),
      text: "Half of it is forwarded to the coin's Creator as Creator Earnings, sent to their wallet with nothing to claim. The platform keeps the other half.",
      pays: "The trader",
      when: "Every curve trade",
      asset: "The coin's Quote Asset",
      receives: "The platform and the Creator",
    },
    {
      id: "creator",
      name: "Creator Fee on the curve",
      amount: p ? (p.creatorFeeBps === 0 ? "None" : rate(p.creatorFeeBps)) : null,
      text:
        p && p.creatorFeeBps !== 0
          ? "LaunchLab's on-chain creator share, paid into the Creator's LaunchLab vault on top of Creator Earnings."
          : "LaunchLab's on-chain creator share. None on Stoker: Creators are paid through Creator Earnings instead.",
      pays: "The trader",
      when: "Every curve trade",
      asset: "The coin's Quote Asset",
      receives: "The Creator's LaunchLab vault",
    },
    {
      id: "raydiumCurve",
      name: "Raydium's curve fee",
      amount: rate(p?.raydiumFee.curveBps),
      text: "The LaunchLab program's own fee, set by Raydium on the Quote Asset's config.",
      pays: "The trader",
      when: "Every curve trade",
      asset: "The coin's Quote Asset",
      receives: "Raydium",
    },
    {
      id: "referral",
      name: "Referral share",
      amount: rate(p?.referralShareBps, "of a referred trade"),
      text: "Only where the Quote Asset's Raydium config allows a share fee. SOL's does; most others, every tokenized stock among them, allow none. Never on a pool trade.",
      pays: "The trader",
      when: "A curve trade opened through a referral link",
      asset: "The coin's Quote Asset",
      receives: "The referrer",
    },
    {
      id: "poolCreator",
      name: "Pool creator fee",
      amount: rate(p?.poolCreatorFeeBps),
      text: "The platform is every graduated pool's creator and collects it. Raydium keeps a share at collection; half of what arrives is forwarded to the coin's Creator.",
      pays: "The trader",
      when: "Every pool trade",
      asset: "The asset going into the pool",
      receives: "The platform and the Creator",
    },
    {
      id: "pool",
      name: "Pool trade fee",
      amount: rate(p?.raydiumFee.poolBps),
      text: "Raydium's CPMM fee. Part of it belongs to the pool's liquidity providers; every graduated pool's liquidity is locked for good with the platform holding its Fee Key, so that part reaches the platform.",
      pays: "The trader",
      when: "Every pool trade",
      asset: "The asset going into the pool",
      receives: "The platform and Raydium",
    },
    {
      id: "rewardTax",
      name: "Reward Tax",
      amount: `${orList(REWARD_TAX_RATES.map(pct))} of every transfer`,
      text: "Only on a Reward Launch, at the rate its Creator fixed at launch, which nobody can change. Paid to the coin's holders in Reward Rounds.",
      pays: "Whoever sends the coin",
      when: "Every transfer",
      asset: "The coin",
      receives: "The coin's holders",
    },
    p?.solRoute != null && {
      id: "route",
      name: "Buying with SOL a coin paired with another asset",
      amount: "The swap's own fee, if any",
      text: `The buy swaps SOL into the Quote Asset${p.solRoute === "jupiter" ? " through Jupiter" : ""} first, spending only what the swap is sure to deliver: up to ${pct(p.solRouteToleranceBps)} under the current price. Anything beyond stays in your wallet.`,
      pays: "The trader",
      when: "A SOL buy of a coin not paired with SOL",
      asset: "SOL",
      receives: p.solRoute === "jupiter" ? "Jupiter and its pools" : "The route's pools",
    },
    JUPITER_REFERRAL !== "" && {
      id: "swap",
      name: "Swapping on the Swap and Stocks pages",
      amount: `${pct(JUPITER_REFERRAL_FEE_BPS)} of every swap`,
      text: "Jupiter's referral fee. Jupiter keeps a fifth of it; the platform receives the rest. Nothing is forwarded to a Creator: no coin is involved.",
      pays: "The swapper",
      when: "Every swap on the Swap and Stocks pages",
      asset: "The asset swapped",
      receives: "The platform and Jupiter",
    },
    {
      id: "network",
      name: "Network fees and rent",
      amount: "Solana's own",
      text: "Every transaction pays Solana's fee, and one that opens an account pays its rent. Shown on every review before you sign.",
      pays: "Whoever signs",
      when: "Every transaction",
      asset: "SOL",
      receives: "Solana",
    },
  ];
  return fees.filter((f): f is Fee => f !== false);
}

/** What the platform does with its share: the Burn's two lines only once `GET /v1/burns` answers. */
function sharesOf(burns: BurnsPage | null): [string, string, string][] {
  return [
    ["creators", "Forwarded to Creators", "Half, within an hour"],
    ...(burns
      ? ([
          ["burn", "The Burn", `${pct(burns.shares.burnBps)} buys and burns STOKER`],
          ["flywheel", "The Flywheel", `${pct(burns.shares.flywheelBps)} buys and burns the top ${burns.shares.flywheelTopN}`],
        ] as [string, string, string][])
      : []),
    ["treasury", "Swept to the treasury", "The rest, hourly"],
  ];
}

/**
 * Fees (#11, the spec's `fees.html`): the one page with a fee figure (owner, 2026-10-30), every rate read from the chain
 * through `GET /v1/platform` and the Burn's shares from `GET /v1/burns` as the page renders, never a constant. A read
 * that fails leaves its figures out, never the entries.
 */
export default async function FeesPage() {
  const [platform, burns] = await Promise.all([getPlatform().catch(() => null), getBurns().catch(() => null)]);
  const fees = feesOf(platform);
  return (
    <>
      <div className="shell page-head">
        <div>
          <h1>Fees</h1>
          <p>Every fee, read from the chain. Half of what the platform collects on a coin&apos;s trades is its Creator&apos;s.</p>
        </div>
      </div>
      <div className="shell doc">
        <nav aria-label="On this page">
          <a href="#fees">Every fee</a>
          <a href="#share">What the platform does with its share</a>
        </nav>
        <div>
          <h2 className="visually-hidden">Every fee</h2>
          <ol className={styles.list} id="fees" aria-label="Every fee">
            {fees.map((f) => (
              <li key={f.id} id={f.id} data-fee={f.id}>
                <h3>{f.name}</h3>
                {f.amount && <span className={styles.amount}>{f.amount}</span>}
                <p>{f.text}</p>
                <dl>
                  <div><dt>Who pays</dt><dd>{f.pays}</dd></div>
                  <div><dt>When</dt><dd>{f.when}</dd></div>
                  <div><dt>In</dt><dd>{f.asset}</dd></div>
                  <div><dt>Who receives it</dt><dd>{f.receives}</dd></div>
                </dl>
              </li>
            ))}
          </ol>
          <section className={styles.share} id="share" aria-labelledby="share-title">
            <div className="section-head">
              <h2 id="share-title">What the platform does with its share</h2>
            </div>
            <dl className="kv panel pad">
              {sharesOf(burns).map(([key, term, value]) => (
                <div key={key}>
                  <dt>{term}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
