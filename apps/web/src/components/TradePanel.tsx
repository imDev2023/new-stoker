"use client";

import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SendTransactionError, VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { LaunchSummary, PayWith, PlatformInfo, PreparedTrade, TradeQuote, TradeSide, TradeStep, TradeVenue } from "@launchpad/contract";
import { getQuote, listTrades, prepareTrade, reportTransaction } from "@/lib/api";
import { COIN_DECIMALS, explorerUrl, formatUnits, isSol, parseUnits, quoteTicker, SOL_DECIMALS } from "@/lib/format";
import { hasAcceptedDisclaimer } from "@/lib/legal";
import { landedError as landedErrorOf } from "@/lib/transactions";
import { Disclaimer } from "./Disclaimer";
import { WalletButton } from "./WalletButton";
import styles from "./TradePanel.module.css";

type Step = "editing" | "preparing" | "signing" | "confirming";
/** A sent trade: `coins` is the indexed fill, null until the Indexer has it; `unconfirmed` when it may or may not have landed. */
type Done = { side: TradeSide; coins: string | null; signature: string; unconfirmed?: boolean };

const SLIPPAGE_BPS = [50, 100, 200, 500] as const;
/** Buy presets in SOL (the spec's), for a SOL pair or a buy paid with SOL. */
const BUY_PRESETS_SOL = ["0.1", "0.5", "1"] as const;
const SELL_PRESETS = [25, 50, 100] as const;
const QUOTE_DEBOUNCE_MS = 250;

/**
 * The trade panel (the spec's form, production's flow): buy or sell, in the Quote Asset or, for a coin paired with
 * anything else, paid in SOL through the route; the amount, the presets and the slippage; then a live quote with what
 * the trader gets, the least they get, and one Fees line in the asset paid that leads to the Fees page (the one place a
 * rate is shown, owner 2026-10-30). The button prepares the trade on the server, simulates it, and asks the wallet to sign:
 * the wallet's own screen is the review (the spec's). The receipt is what the chain filled. After Graduation the same
 * panel trades in the coin's Raydium pool; while Raydium moves it there, trading pauses.
 */
export function TradePanel({ launch, platform, onTraded }: { launch: LaunchSummary; platform: PlatformInfo; onTraded: () => void }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [side, setSide] = useState<TradeSide>("buy");
  const [amountText, setAmountText] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [payWith, setPayWith] = useState<PayWith>("quote");
  /** Whether the trader picked what to pay with; until then a wallet without the Quote Asset pays with SOL. */
  const payWithChosen = useRef(false);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  /** Raw units held: SOL in lamports, the Quote Asset (the same as SOL for a SOL pair) and the coin. */
  const [balances, setBalances] = useState<{ sol: bigint; quote: bigint; coins: bigint } | null>(null);
  const [step, setStep] = useState<Step>("editing");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  const quoteSymbol = quoteTicker(launch.quote);
  const quoteDecimals = launch.quote.decimals;
  const solPair = isSol(launch.quote);
  const canPayWithSol = !solPair && platform.solRoute !== null;
  const paysSol = side === "buy" && canPayWithSol && payWith === "sol";
  const payDecimals = side === "buy" ? (paysSol ? SOL_DECIMALS : quoteDecimals) : COIN_DECIMALS;
  const getDecimals = side === "buy" ? COIN_DECIMALS : quoteDecimals;
  const venue: TradeVenue = launch.curve.status === "graduated" ? "pool" : "curve";
  const paySymbol = side === "buy" ? (paysSol ? "SOL" : quoteSymbol) : launch.symbol;
  const getSymbol = side === "buy" ? launch.symbol : quoteSymbol;
  const amount = parseUnits(amountText, payDecimals);
  const invalidAmount = amountText.trim() !== "" && amount === null;
  const busy = step !== "editing";
  const held = balances ? (side === "buy" ? (paysSol ? balances.sol : balances.quote) : balances.coins) : null;
  // A buy that takes the rest of the curve costs less than typed, so the quote's cost is checked; one paid with SOL its swap's limit.
  const cost = side === "buy" && quote && amount !== null ? BigInt(quote.route ? quote.route.maxSolIn : quote.amountIn) : amount;
  const overBalance = cost !== null && held !== null && cost > held;

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return setBalances(null);
    try {
      const heldOf = async (mint: string) => {
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(mint) }, "confirmed");
        return accounts.value.reduce((sum, a) => sum + BigInt(a.account.data.parsed.info.tokenAmount.amount as string), 0n);
      };
      const [sol, coins, quoteHeld] = await Promise.all([
        connection.getBalance(publicKey, "confirmed").then(BigInt),
        heldOf(launch.mint),
        solPair ? null : heldOf(launch.quote.mint),
      ]);
      setBalances({ sol, quote: quoteHeld ?? sol, coins });
    } catch {
      setBalances(null);
    }
  }, [connection, publicKey, launch.mint, launch.quote.mint, solPair]);

  useEffect(() => void refreshBalances(), [refreshBalances]);

  // A wallet that holds none of the Quote Asset but has SOL pays with SOL, unless the trader chose or already typed.
  useEffect(() => {
    if (!canPayWithSol || !balances || payWithChosen.current) return;
    const next = balances.quote === 0n && balances.sol > 0n ? "sol" : "quote";
    setPayWith((current) => (current === next || amountText !== "" ? current : next));
    // amountText is read, not followed: the pick happens when balances arrive, never while typing.
  }, [canPayWithSol, balances]);

  // A live quote while the trader types, fetched again when the coin moves to its pool (another price, other fees).
  useEffect(() => {
    setQuote(null);
    setQuoteError(null);
    if (amount === null) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setQuote(await getQuote(launch.mint, { side, amount: amount.toString(), slippageBps, payWith: paysSol ? "sol" : "quote" }, abort.signal));
      } catch (e) {
        if (!abort.signal.aborted) setQuoteError(tradeError((e as Error).message));
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [launch.mint, side, amount, slippageBps, paysSol, venue]);

  function edit(next: () => void) {
    setError(null);
    setDone(null);
    next();
  }

  async function trade() {
    if (!publicKey || amount === null) return;
    if (!signTransaction) return setError("This wallet can't sign transactions. Try another wallet.");
    setStep("preparing");
    let prepared: PreparedTrade;
    let tx: VersionedTransaction;
    try {
      prepared = await prepareTrade({
        mint: launch.mint, trader: publicKey.toBase58(), side, amount: amount.toString(), slippageBps, payWith: paysSol ? "sol" : "quote",
      });
      tx = VersionedTransaction.deserialize(Uint8Array.from(atob(prepared.transaction), (c) => c.charCodeAt(0)));
      // Simulated before the wallet is asked, so a trade that would fail says why without costing a signature.
      const sim = await connection.simulateTransaction(tx, { sigVerify: false });
      if (sim.value.err) {
        const text = `${JSON.stringify(sim.value.err)} ${(sim.value.logs ?? []).join(" ")}`;
        throw new Error(simulationError(text, prepared, solPair || prepared.quote.route ? null : quoteSymbol, quoteSymbol));
      }
      setQuote(prepared.quote);
    } catch (e) {
      setError(tradeError((e as Error).message));
      return setStep("editing");
    }

    setStep("signing");
    let signed: VersionedTransaction;
    try {
      signed = await signTransaction(tx);
    } catch (e) {
      const message = (e as Error).message ?? "";
      setError(/reject|declin|cancel/i.test(message) ? "You declined the transaction in your wallet. Nothing was traded." : message);
      return setStep("editing");
    }
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(signed.serialize());
    } catch (e) {
      // The RPC simulates before sending, so a price that moved while the trader signed fails here, before any fee.
      setError(
        e instanceof SendTransactionError
          ? unsentError(`${e.message} ${(e.logs ?? []).join(" ")}`, prepared, quoteSymbol)
          : "We couldn't tell whether the trade was sent. Check your wallet's recent activity before trying again.",
      );
      void refreshBalances();
      return setStep("editing");
    }
    setStep("confirming");
    try {
      const result = await connection.confirmTransaction(
        { signature, blockhash: signed.message.recentBlockhash, lastValidBlockHeight: prepared.lastValidBlockHeight },
        "confirmed",
      );
      if (result.value.err) {
        setError(landedError(JSON.stringify(result.value.err), prepared, quoteSymbol));
      } else {
        await reportTransaction(signature).catch(() => undefined);
        // The fill can differ from the quote when others trade first, so the receipt says what the chain did.
        const filled = (await listTrades(launch.mint).catch(() => null))?.trades.find((t) => t.signature === signature);
        setDone({ side: prepared.quote.side, coins: filled?.baseAmount ?? null, signature });
        setAmountText("");
        onTraded();
      }
    } catch (e) {
      const landed = landedErrorOf(e);
      if (landed) {
        setError(landedError(landed, prepared, quoteSymbol));
      } else {
        // Sent, but its confirmation could not be followed: it may well have landed, so it is never called untraded.
        setDone({ side: prepared.quote.side, coins: null, signature, unconfirmed: true });
        setError(
          e instanceof Error && e.name === "TransactionExpiredBlockheightExceededError"
            ? "The trade wasn't seen to land before it expired. Check the transaction before trading again."
            : "The trade was sent, but we lost track of it before it confirmed. Check the transaction before trading again.",
        );
        onTraded();
      }
    }
    void refreshBalances();
    setStep("editing");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || amount === null || overBalance || !quote) return;
    setError(null);
    setDone(null);
    if (!hasAcceptedDisclaimer()) return setDisclaimerOpen(true);
    void trade();
  }

  const receipt = done && (
    <p className={styles.done} role="status">
      {done.unconfirmed ? (
        <>Sent a {done.side} of {launch.symbol}, not yet confirmed. </>
      ) : (
        <>
          {done.side === "buy" ? "Bought" : "Sold"} {done.coins && <><span className="num">{formatUnits(done.coins, COIN_DECIMALS, 0)}</span> </>}
          {launch.symbol}.{" "}
        </>
      )}
      <a className="link" href={explorerUrl("tx", done.signature, platform)} target="_blank" rel="noreferrer">View transaction</a>
    </p>
  );

  // A buy that sells out the curve lands here too, so its receipt stays on screen until the pool opens.
  if (launch.curve.status === "graduating") {
    return (
      <section className={`panel pad ${styles.trade}`} aria-label={`Trade ${launch.symbol}`}>
        {receipt}
        <p className={styles.closed}>Trading pauses while Raydium moves the coin to its pool, and opens here again in a few seconds.</p>
      </section>
    );
  }

  const route = quote?.route ?? null;
  // One Fees line in the asset paid (owner, 2026-10-30): the platform's and Raydium's fees in the Quote Asset, plus its
  // own transfer fee where its issuer takes one; in the pool a sell pays the pool's fee in the coins going in, a Reward
  // Launch withholds its Reward Tax in the coin, and a buy paid with SOL pays its swap's fee in SOL.
  const poolFeeInCoins = quote?.venue === "pool" && quote.side === "sell";
  const quoteFees = quote
    ? BigInt(quote.fees.platform) + BigInt(quote.fees.creator) + (poolFeeInCoins ? 0n : BigInt(quote.fees.raydium)) + BigInt(quote.referral?.fee ?? "0") + BigInt(quote.transferFees.quote)
    : 0n;
  const coinFees = quote ? (poolFeeInCoins ? BigInt(quote.fees.raydium) : 0n) + BigInt(quote.transferFees.base) : 0n;
  const fees = [
    `${formatUnits(quoteFees.toString(), quoteDecimals, 6)} ${quoteSymbol}`,
    ...(coinFees > 0n ? [`${formatUnits(coinFees.toString(), COIN_DECIMALS, 0)} ${launch.symbol}`] : []),
    ...(route?.fee ? [`${sol(BigInt(route.fee))} SOL`] : []),
  ].join(" + ");
  const presets =
    side === "sell" ? SELL_PRESETS.map((p) => (p === 100 ? "All" : `${p}%`)) : solPair || paysSol ? [...BUY_PRESETS_SOL] : [];
  const problem = invalidAmount
    ? `Enter an amount above zero with up to ${payDecimals} decimal places.`
    : overBalance
      ? held === 0n
        ? `Your wallet has no ${paySymbol}.`
        : `You have ${formatUnits(held!.toString(), payDecimals)} ${paySymbol}.`
      : quoteError;

  return (
    <form className={`panel pad ${styles.trade}`} aria-label={`Trade ${launch.symbol}`} onSubmit={onSubmit} aria-busy={busy}>
      <fieldset className={styles.fields} disabled={busy}>
        <div className="seg" role="radiogroup" aria-label="Side">
          {(["buy", "sell"] as const).map((s) => (
            <label key={s}>
              <input type="radio" name="side" value={s} checked={side === s} onChange={() => edit(() => { setSide(s); setAmountText(""); })} />
              {s === "buy" ? "Buy" : "Sell"}
            </label>
          ))}
        </div>

        {side === "buy" && canPayWithSol && (
          <div className={styles.option}>
            <span id="pay-label">Pay with</span>
            <div className="seg" role="radiogroup" aria-labelledby="pay-label">
              {(["quote", "sol"] as const).map((p) => (
                <label key={p}>
                  <input
                    type="radio"
                    name="pay"
                    value={p}
                    checked={payWith === p}
                    onChange={() =>
                      edit(() => {
                        payWithChosen.current = true;
                        setAmountText("");
                        setPayWith(p);
                      })
                    }
                  />
                  {p === "sol" ? "SOL" : quoteSymbol}
                </label>
              ))}
            </div>
          </div>
        )}

        <label className={`amount ${problem && !quoteError ? styles.invalid : ""}`}>
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-label="Amount"
            aria-invalid={invalidAmount || overBalance}
            value={amountText}
            onChange={(e) => edit(() => setAmountText(e.target.value.replace(",", ".")))}
          />
          <span className={styles.token}>{paySymbol}</span>
        </label>

        {presets.length > 0 && (
          <div className={styles.presets}>
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                disabled={side === "sell" && (!balances || balances.coins === 0n)}
                onClick={() =>
                  edit(() =>
                    setAmountText(
                      side === "buy"
                        ? p
                        : formatUnits(((balances!.coins * BigInt(p === "All" ? 100 : parseInt(p, 10))) / 100n).toString(), COIN_DECIMALS, COIN_DECIMALS).replace(/,/g, ""),
                    ),
                  )
                }
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className={styles.option}>
          <span id="slip-label">Slippage</span>
          <div className={`seg ${styles.slip}`} role="radiogroup" aria-labelledby="slip-label">
            {SLIPPAGE_BPS.map((bps) => (
              <label key={bps}>
                <input type="radio" name="slip" value={bps} checked={slippageBps === bps} onChange={() => edit(() => setSlippageBps(bps))} />
                {bps / 100}%
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {quote && !problem && (
        <dl className="kv" aria-live="polite">
          <div>
            <dt>You get about</dt>
            <dd>{formatUnits(quote.amountOut, getDecimals, side === "buy" ? 0 : 6)} {getSymbol}</dd>
          </div>
          <div>
            <dt>At least</dt>
            <dd>{formatUnits(quote.minAmountOut, getDecimals, side === "buy" ? 0 : 6)} {getSymbol}</dd>
          </div>
          {route && (
            <>
              <div>
                <dt>Spent on the coins</dt>
                <dd>{formatUnits(route.quoteOut, quoteDecimals, quoteDecimals)} {quoteSymbol}</dd>
              </div>
              <div>
                <dt>Stays in your wallet</dt>
                <dd>{formatUnits(route.kept, quoteDecimals, quoteDecimals)} {quoteSymbol}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Fees</dt>
            <dd><Link className="link" href="/fees">{fees}</Link></dd>
          </div>
        </dl>
      )}
      {quote?.completesCurve && !problem && (
        <p className={styles.note}>
          This buy takes the last coins on the curve and starts graduation, so it costs{" "}
          {route ? `${sol(BigInt(route.solIn))} SOL` : `${formatUnits(quote.amountIn, quoteDecimals, 6)} ${quoteSymbol}`}, not the full amount.
        </p>
      )}
      {problem && <p className={styles.problem}>{problem}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {receipt}

      {publicKey ? (
        <button type="submit" className="button button-lg button-block" disabled={busy || amount === null || overBalance || !quote}>
          {step === "preparing"
            ? "Preparing…"
            : step === "signing"
              ? "Confirm in your wallet…"
              : step === "confirming"
                ? "Confirming…"
                : `${side === "buy" ? "Buy" : "Sell"} ${launch.symbol}`}
        </button>
      ) : (
        <WalletButton block />
      )}

      <Disclaimer
        action="trade"
        open={disclaimerOpen}
        onCancel={() => setDisclaimerOpen(false)}
        onAccept={() => {
          setDisclaimerOpen(false);
          void trade();
        }}
      />
    </form>
  );
}

/** A SOL amount from lamports, to six decimal places. */
const sol = (lamports: bigint) => formatUnits(lamports.toString(), SOL_DECIMALS, 6);

/** Turns an API or wallet error into what happened and what to do next. */
function tradeError(message: string) {
  if (/too small/.test(message)) return "That amount is too small to trade. Enter a larger amount.";
  if (/more than the curve has sold/.test(message)) return "That's more coins than the curve has sold. Enter a smaller amount.";
  if (/^[A-Z]/.test(message) && message.endsWith(".")) return message;
  return "Something went wrong preparing the trade. Try again in a moment.";
}

// ExceededSlippage of LaunchLab (the curve), of Raydium's CPMM (the pool after Graduation, and the local SOL route) and
// Jupiter's SlippageToleranceExceeded, as a transaction error and as the RPC's preflight log writes them.
const SLIPPAGE_CODES: Record<TradeVenue | "raydium-cpmm" | "jupiter", number> = { curve: 6004, pool: 6005, "raydium-cpmm": 6005, jupiter: 6001 };
const hasCode = (text: string, code: number) => text.includes(`"Custom":${code}`) || text.includes(`0x${code.toString(16)}`);

/** Which step of the trade failed, from a transaction error or the RPC's preflight message, and whether on its slippage. */
function failure(text: string, prepared: PreparedTrade): { step: TradeStep | null; slippage: boolean } {
  const match = /"InstructionError":\[(\d+)|Instruction (\d+)/.exec(text);
  const index = match ? Number(match[1] ?? match[2]) : null;
  const step = index === null ? null : (prepared.steps[index] ?? null);
  const { venue, route } = prepared.quote;
  const slippage =
    step === "route" && route
      ? hasCode(text, SLIPPAGE_CODES[route.source]) || /SlippageToleranceExceeded/.test(text)
      : (step === null || step === "trade") && hasCode(text, SLIPPAGE_CODES[venue]);
  return { step, slippage };
}

/** A trade that landed but failed: nothing moved except the network fee. */
function landedError(text: string, prepared: PreparedTrade, quoteSymbol: string) {
  const f = failure(text, prepared);
  if (f.step === "route")
    return f.slippage
      ? `SOL bought less ${quoteSymbol} than the swap allows before the trade landed, so nothing was swapped or traded and only the network fee was charged. Try again.`
      : `The swap from SOL to ${quoteSymbol} failed on-chain, so nothing was traded and only the network fee was charged. Try again, or pay in ${quoteSymbol}.`;
  return f.slippage
    ? "The price moved past your slippage before the trade landed, so nothing was traded and only the network fee was charged. Try again, or allow more slippage."
    : "The trade failed on-chain, so nothing was traded and only the network fee was charged. Try again.";
}

/** A trade the RPC refused to send after its own simulation: nothing moved and nothing was charged. */
function unsentError(text: string, prepared: PreparedTrade, quoteSymbol: string) {
  const f = failure(text, prepared);
  if (f.step === "route")
    return f.slippage
      ? `SOL buys less ${quoteSymbol} now than the swap allows, so nothing was sent, swapped or charged. Check the new quote and try again.`
      : `The swap from SOL to ${quoteSymbol} would fail, so nothing was sent or charged. Try again in a moment, or pay in ${quoteSymbol}.`;
  return f.slippage
    ? "The price moved past your slippage before the trade was sent, so nothing was traded or charged. Check the new quote and try again, or allow more slippage."
    : "The trade couldn't be sent. Nothing was traded; try again in a moment.";
}

/** A failed simulation as something the trader can act on; `payingQuote` is the Quote Asset's ticker when the trade spends it. */
function simulationError(text: string, prepared: PreparedTrade, payingQuote: string | null, quoteSymbol: string) {
  if (payingQuote && /insufficient funds|"Custom":1\b/.test(text) && !/insufficient lamports|InsufficientFundsForRent/.test(text))
    return `Your wallet doesn't have enough ${payingQuote} for this trade. Lower the amount or add ${payingQuote}.`;
  if (/insufficient (lamports|funds)|InsufficientFundsForRent|"Custom":1\b/.test(text))
    return payingQuote
      ? "Your wallet doesn't have enough SOL for this trade's network fees. Add SOL and try again."
      : "Your wallet doesn't have enough to cover this trade and its network fees. Lower the amount or add SOL.";
  if (/AccountNotFound/.test(text)) return "Your wallet has no SOL yet. Add SOL and try again.";
  const f = failure(text, prepared);
  if (f.step === "route")
    return f.slippage
      ? `SOL buys less ${quoteSymbol} now than the swap allows. Check the new quote and try again.`
      : `The swap from SOL to ${quoteSymbol} would fail, so nothing was sent. Try again in a moment, or pay in ${quoteSymbol}.`;
  if (f.slippage) return "The price has moved past your slippage. Check the new quote and try again.";
  return "The trade would fail on-chain, so nothing was sent. Try again in a moment.";
}
