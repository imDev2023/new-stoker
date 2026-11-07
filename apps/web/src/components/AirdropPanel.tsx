"use client";

import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { AirdropStatus, PlatformInfo, QuoteRef } from "@launchpad/contract";
import { getAirdrop, prepareAirdrop, reportTransaction } from "@/lib/api";
import { COIN_DECIMALS, explorerUrl, formatUnits, shortAddress } from "@/lib/format";
import { landedError } from "@/lib/transactions";
import { PairName } from "./Pair";
import styles from "./AirdropPanel.module.css";

type Step = { kind: "idle" } | { kind: "preparing" } | { kind: "signing" } | { kind: "sending"; count: number };

/** Payments in flight settle within about a minute, landed or expired: followed this often until they do. */
const REFRESH_MS = 4_000;

/**
 * One coin's airdrop on its Creator's page (production's `AirdropCard`, `12dbc10:apps/web/src/components/AirdropCard.tsx`,
 * moved from the coin page to the Creator's own, #13): how many of its wallets are paid, the Send button while any is
 * not, and every wallet with what it gets and the transaction that paid it. The Creator signs every payment in one
 * approval however many transactions it takes, and sends the rest if some didn't go through.
 */
export function AirdropPanel({ initial, symbol, quote, platform }: { initial: AirdropStatus; symbol: string; quote: QuoteRef; platform: PlatformInfo }) {
  const { connection } = useConnection();
  const { publicKey, signAllTransactions } = useWallet();
  const [status, setStatus] = useState(initial);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const count = (s: AirdropStatus["recipients"][number]["status"]) => status.recipients.filter((r) => r.status === s).length;
  const paid = count("paid");
  const sending = count("sending");
  const unpaid = count("unpaid");
  const total = status.recipients.length;
  const done = paid === total;
  const busy = step.kind !== "idle";
  const isCreator = publicKey?.toBase58() === status.creator;

  const refresh = useCallback(async () => {
    const next = await getAirdrop(status.mint).catch(() => null);
    if (next) setStatus(next);
  }, [status.mint]);

  useEffect(() => {
    if (sending === 0 || busy) return;
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [sending, busy, refresh]);

  async function send() {
    if (!signAllTransactions) return setError("This wallet can't sign transactions. Try another wallet.");
    setError(null);
    setStep({ kind: "preparing" });
    try {
      const prepared = await prepareAirdrop(status.mint);
      const txs = prepared.transactions.map((t) => VersionedTransaction.deserialize(Uint8Array.from(atob(t), (c) => c.charCodeAt(0))));
      setStep({ kind: "signing" });
      let signed: VersionedTransaction[];
      try {
        signed = await signAllTransactions(txs);
      } catch (e) {
        const message = (e as Error).message ?? "";
        throw new Error(
          /reject|declin|cancel/i.test(message)
            ? "You declined in your wallet, so nothing was sent. You can send it in about a minute, once the transactions you declined have expired."
            : message,
          { cause: e },
        );
      }
      setStep({ kind: "sending", count: signed.length });
      const results = await Promise.allSettled(
        signed.map(async (tx) => {
          const signature = await connection.sendRawTransaction(tx.serialize());
          const result = await connection
            .confirmTransaction({ signature, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: prepared.lastValidBlockHeight }, "confirmed")
            .catch((e: unknown) => {
              if (landedError(e)) return { value: { err: e } };
              throw e;
            });
          if (result.value.err) throw new Error("failed on-chain");
          await reportTransaction(signature);
        }),
      );
      if (results.some((r) => r.status === "rejected"))
        setError("Some payments didn't go through. You can send them again once their transactions have expired, in about a minute.");
    } catch (e) {
      setError((e as Error).message);
    }
    await refresh();
    setStep({ kind: "idle" });
  }

  const label =
    step.kind === "preparing"
      ? "Preparing…"
      : step.kind === "signing"
        ? "Confirm in your wallet…"
        : step.kind === "sending"
          ? `Sending ${step.count === 1 ? "1 transaction" : `${step.count} transactions`}…`
          : unpaid === 0
            ? "Waiting for payments to land"
            : paid === 0
              ? "Send airdrop"
              : "Send the rest";

  return (
    <article className={`panel ${styles.airdrop}`} aria-labelledby={`airdrop-${status.mint}`} data-airdrop={status.mint}>
      <div className={`pad ${styles.head}`}>
        <h3 id={`airdrop-${status.mint}`}>
          <Link href={`/coin/${status.mint}`}>
            <PairName symbol={symbol} quote={quote} />
          </Link>
        </h3>
        <span className={styles.count}>
          {paid} of {total} paid
        </span>
        <div
          className={`progress ${styles.progress}`}
          role="progressbar"
          aria-label={`${symbol} airdrop`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={paid}
          aria-valuetext={`${paid} of ${total} wallets paid`}
        >
          <span style={{ "--value": `${total === 0 ? 0 : (paid / total) * 100}%` } as CSSProperties} />
        </div>
        {isCreator && !done && (
          <button type="button" className={`button ${styles.send}`} onClick={() => void send()} disabled={busy || unpaid === 0}>
            {label}
          </button>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="table-wrap">
        <table className="table" aria-label={`${symbol} airdrop wallets`}>
          <thead>
            <tr>
              <th scope="col">Wallet</th>
              <th scope="col" className="r">{symbol}</th>
              <th scope="col" className="r">Paid</th>
            </tr>
          </thead>
          <tbody>
            {status.recipients.map((r) => (
              <tr key={r.wallet} data-status={r.status}>
                <td>
                  <a className="link mono" href={explorerUrl("address", r.wallet, platform)} target="_blank" rel="noreferrer">
                    {shortAddress(r.wallet)}
                  </a>
                </td>
                <td className="r num">{formatUnits(r.amount, COIN_DECIMALS, COIN_DECIMALS)}</td>
                <td className="r">
                  {r.status === "paid" && r.signature ? (
                    <a className="link" href={explorerUrl("tx", r.signature, platform)} target="_blank" rel="noreferrer">
                      Paid
                    </a>
                  ) : (
                    <span className="badge">{r.status === "sending" ? "On its way" : "Not yet"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
