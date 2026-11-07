"use client";

import Link from "next/link";
import { useState } from "react";
import { SOL_MINT, SwapWidget, USDC_MINT } from "./SwapWidget";
import styles from "./StockTrade.module.css";

type Side = "buy" | "sell";
const WITH = [{ value: USDC_MINT, label: "USDC" }, { value: SOL_MINT, label: "SOL" }] as const;

/**
 * A stock's trade (the spec's stock trade panel): buy or sell it through Jupiter, paid in or paid out as USDC or SOL, at
 * the Swap page's fee. The spec drew its own amount, slippage and estimate over a swap it left unwired; here Jupiter's
 * own swap (the Swap page's Plugin) is the form, quoting, routing and showing what the wallet signs, opened on the pair
 * the two choices above it name with the stock's side locked. The fee's figure is the Fees page's alone.
 */
export function StockTrade({ mint, ticker, fee }: { mint: string; ticker: string; fee: boolean }) {
  const [side, setSide] = useState<Side>("buy");
  const [other, setOther] = useState<string>(USDC_MINT);
  const buy = side === "buy";
  return (
    <section className={styles.trade} aria-label={`Trade ${ticker}`}>
      <div className={`seg ${styles.side}`} role="radiogroup" aria-label="Side">
        {(["buy", "sell"] as const).map((s) => (
          <label key={s}>
            <input type="radio" name="side" value={s} checked={side === s} onChange={() => setSide(s)} />
            {s === "buy" ? "Buy" : "Sell"}
          </label>
        ))}
      </div>
      <div className={styles.with}>
        <span id="with-label">{buy ? "Pay with" : "Receive"}</span>
        <div className="seg" role="radiogroup" aria-labelledby="with-label">
          {WITH.map((w) => (
            <label key={w.label}>
              <input type="radio" name="with" value={w.label} checked={other === w.value} onChange={() => setOther(w.value)} />
              {w.label}
            </label>
          ))}
        </div>
      </div>
      <SwapWidget input={buy ? other : mint} output={buy ? mint : other} fixed={mint} />
      <p className={styles.note}>
        Routed by Jupiter.
        {fee && (
          <>
            {" "}Stoker takes a fee on each swap: <Link className="link" href="/fees#swap">every fee, explained</Link>.
          </>
        )}{" "}
        A token can trade at a gap to its stock. Nothing here is investment advice.
      </p>
    </section>
  );
}
