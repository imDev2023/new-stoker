import type { Metadata } from "next";
import Link from "next/link";
import { Figures, type Figure } from "@/components/Figures";
import { getBurns, getPlatform } from "@/lib/api";
import { explorerUrl, formatDate, formatEntryAmount, formatFigure, quoteTicker, SOL_DECIMALS, units } from "@/lib/format";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Burn and Flywheel",
  description: "How the platform's revenue buys and burns STOKER and the most traded graduated coins, every run on-chain.",
};

/**
 * Burn and Flywheel (#11, the spec's `burns.html`): what the Burn and the Flywheel have spent and burned, each figure
 * linking to the record it is summed from, the published rule, the Flywheel's next picks and every buy and burn with its
 * transaction. Every part waits for a real value; a read that fails leaves the page at its title.
 */
export default async function BurnsPage() {
  const [burns, platform] = await Promise.all([getBurns().catch(() => null), getPlatform().catch(() => null)]);
  const sol = (lamports: string) => units(lamports, SOL_DECIMALS);
  const stoker = burns?.platformToken ? burns.burned.find((b) => b.coin.mint === burns.platformToken) : undefined;
  const burned = stoker ? units(stoker.amount, stoker.coin.decimals) : 0;
  const figures: Figure[] = burns
    ? [
        sol(burns.budgets.revenueLamports) > 0 && { key: "revenue", term: "Revenue so far", value: formatFigure(sol(burns.budgets.revenueLamports)), unit: "SOL", href: "/revenue#ledger" },
        sol(burns.budgets.burn.spent) > 0 && { key: "burn", term: "Spent on the Burn", value: formatFigure(sol(burns.budgets.burn.spent)), unit: "SOL", href: "#events" },
        sol(burns.budgets.flywheel.spent) > 0 && { key: "flywheel", term: "Spent on the Flywheel", value: formatFigure(sol(burns.budgets.flywheel.spent)), unit: "SOL", href: "#events" },
        stoker && burned > 0 && { key: "burned", term: `${quoteTicker(stoker.coin)} burned`, value: formatFigure(burned), href: "#events" },
      ].filter((f): f is Figure => Boolean(f))
    : [];

  return (
    <>
      <div className="shell page-head">
        <h1>Burn and Flywheel</h1>
        <Link className="arrow" href="/revenue">Stats</Link>
      </div>
      <Figures figures={figures} />

      {burns?.rule && (
        <section className="shell section" aria-labelledby="rule-title">
          <h2 id="rule-title" className="visually-hidden">The rule</h2>
          <p className={styles.lead}>{burns.rule}</p>
        </section>
      )}

      {burns && burns.nextFlywheel.length > 0 && (
        <section className="shell section" aria-labelledby="next-title">
          <div className="section-head">
            <h2 id="next-title">The Flywheel&apos;s next picks</h2>
          </div>
          <div className={styles.chips}>
            {burns.nextFlywheel.map((c) => (
              <Link key={c.mint} className="chip" href={`/coin/${c.mint}`}>{c.symbol}</Link>
            ))}
          </div>
        </section>
      )}

      {platform && burns && burns.events.length > 0 && (
        <section className="shell section" id="events" aria-labelledby="events-title">
          <div className="section-head">
            <h2 id="events-title">Every buy and burn</h2>
          </div>
          <div className="panel table-wrap">
            <table className="table" aria-labelledby="events-title">
              <thead>
                <tr>
                  <th scope="col">Run</th>
                  <th scope="col" className="r">Burned</th>
                  <th scope="col" className="r">SOL spent</th>
                  <th scope="col" className="r">Date</th>
                </tr>
              </thead>
              <tbody>
                {burns.events.map((e) => (
                  <tr key={e.signature} data-kind={e.kind}>
                    <td>{e.kind === "burn" ? "The Burn" : "The Flywheel"} · {quoteTicker(e.coin)}</td>
                    <td className="r num">{formatEntryAmount(e.amount, e.coin.decimals)}</td>
                    <td className="r num">{formatEntryAmount(e.lamports, SOL_DECIMALS)}</td>
                    <td className="r">
                      <a className="link" href={explorerUrl("tx", e.signature, platform)} target="_blank" rel="noreferrer">
                        <time dateTime={e.time}>{formatDate(e.time)}</time>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
