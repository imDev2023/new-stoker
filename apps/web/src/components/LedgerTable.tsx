"use client";

import { useState } from "react";
import type { LedgerEntry, LedgerKind, LedgerPage, PlatformInfo } from "@launchpad/contract";
import { listLedger } from "@/lib/api";
import { explorerUrl, formatEntryAmount, quoteTicker, timeAgo } from "@/lib/format";
import styles from "./LedgerTable.module.css";

/** Each kind of entry in words (the spec's, carried from production's Ledger). */
const KIND: Record<LedgerKind, string> = {
  platform_fee: "Platform Fee from curves",
  pool_fee: "Platform Fee from a pool",
  fee_key: "Fee Key LP fees",
  sweep: "Swept to treasury",
  creator_forward: "Forwarded to a Creator",
  burn: "Platform Token burn",
  flywheel: "Flywheel burn",
  arweave_top_up: "Arweave credits bought",
  metadata_upload: "Permanent metadata",
  reward_sale: "Reward Tax sold for holders",
  graduation_fee: "Graduation Fee, kept from a Creator's share",
};

const WSOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Newest transaction first, as the Ledger lists them; within one transaction SOL first, then by ticker: a pool pays out
 * its two tokens in the order of their mint addresses, which says nothing to a reader (carried from production).
 */
function inReadingOrder(entries: LedgerEntry[]) {
  const position = new Map<string, number>();
  entries.forEach((e) => position.set(e.signature, position.get(e.signature) ?? position.size));
  const rank = (e: LedgerEntry) => (e.asset.mint === WSOL_MINT ? "" : quoteTicker(e.asset));
  return [...entries].sort((a, b) => position.get(a.signature)! - position.get(b.signature)! || rank(a).localeCompare(rank(b), "en"));
}

/**
 * The Ledger (the spec's table on Stats): every movement of platform revenue, newest first, each with the transaction
 * it is in, and older pages on request so the whole record stays reachable. `renderedAt` is the server's clock, so the
 * times the server wrote are the ones the browser hydrates.
 */
export function LedgerTable({ initial, platform, renderedAt }: { initial: LedgerPage; platform: PlatformInfo; renderedAt: number }) {
  const [entries, setEntries] = useState(initial.entries);
  const [next, setNext] = useState(initial.next);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function older() {
    setLoading(true);
    setFailed(false);
    try {
      const page = await listLedger(next);
      setEntries((shown) => [...shown, ...page.entries]);
      setNext(page.next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="panel table-wrap">
        <table className="table" aria-labelledby="ledger-title">
          <thead>
            <tr>
              <th scope="col">Entry</th>
              <th scope="col" className={styles.wide}>Coin</th>
              <th scope="col" className="r">Amount</th>
              <th scope="col" className="r">Time</th>
            </tr>
          </thead>
          <tbody>
            {inReadingOrder(entries).map((e) => (
              <tr key={`${e.signature}.${e.index}`} data-kind={e.kind}>
                <td>
                  {KIND[e.kind]}
                  {e.launch && <span className={styles.narrow}>{e.launch.symbol}</span>}
                </td>
                <td className={`muted ${styles.wide}`}>{e.launch?.symbol}</td>
                {/* A sweep moves what the wallet holds less its costs, which waver by a few lamports between runs. */}
                <td className="r num" data-wavers={e.kind === "sweep" || undefined}>
                  {formatEntryAmount(e.amount, e.asset.decimals)} {quoteTicker(e.asset)}
                </td>
                <td className="r">
                  <a className="link" href={explorerUrl("tx", e.signature, platform)} target="_blank" rel="noreferrer">
                    <time dateTime={e.time}>{timeAgo(e.time, renderedAt)}</time>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(next || failed) && (
        <div className={styles.more}>
          {next && (
            <button type="button" className="button button-ghost" onClick={() => void older()} disabled={loading} aria-busy={loading}>
              {loading ? "Loading" : "Older entries"}
            </button>
          )}
          {failed && <p role="alert">The older entries could not be read. Try again.</p>}
        </div>
      )}
    </>
  );
}
