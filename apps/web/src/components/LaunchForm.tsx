"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SendTransactionError, TransactionExpiredBlockheightExceededError, VersionedTransaction } from "@solana/web3.js";
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AIRDROP_MAX_RECIPIENTS, LAUNCH_IMAGE_MAX_BYTES, LAUNCH_IMAGE_TYPES, REWARD_TAX_RATES,
  type CopyVerdict, type PlatformInfo, type PreparedLaunch, type QuoteAsset, type RewardTaxBps, type TradeQuote,
} from "@launchpad/contract";
import { ApiRequestError, getLaunchPermissions, getLaunchQuote, prepareLaunch, reportTransaction, retryLaunch } from "@/lib/api";
import { parseAirdropList } from "@/lib/airdrop";
import { protectedUntil, useCopyCheck, type CopyField } from "@/lib/copyCheck";
import { COIN_DECIMALS, COIN_SUPPLY, explorerUrl, formatAmount, formatUnits, isSol, parseUnits, quoteTicker, SOL_DECIMALS } from "@/lib/format";
import {
  cleanSymbol, DESCRIPTION_MAX, FIRST_LINKS, kindLabel, LINK_INFO, LINK_KINDS, MORE_LINKS, NAME_MAX, onChainError, quoteOption,
  recommendedQuotes, simulationError, supplyShare, SYMBOL_MAX, type LaunchKind, type LinkKind,
} from "@/lib/launch";
import { hasAcceptedDisclaimer } from "@/lib/legal";
import { landedError } from "@/lib/transactions";
import { Disclaimer } from "./Disclaimer";
import { PairName } from "./Pair";
import { WalletButton } from "./WalletButton";
import styles from "./LaunchForm.module.css";

/**
 * A launch handed to the network that did not visibly land. Trying again prepares the same coin, so it can never launch
 * twice; while it is `uncertain` whether it landed, the Creator can't start over with another coin.
 */
type Failed = { kind: "failed"; mint: string; quote: QuoteAsset; uncertain: boolean };
type Step =
  | { kind: "editing" }
  | { kind: "preparing"; retrying: Failed | null }
  | { kind: "signing" }
  | { kind: "confirming"; signature: string; symbol: string }
  | Failed;

const QUOTE_DEBOUNCE_MS = 250;

/**
 * Stoke a coin (#8): the spec's form (`launch.html`: the coin, the pair, the launch type, the links and the First Buy,
 * with the summary beside them) on production's flow. The summary is the review and holds the one action: the button
 * prepares the launch on the server, simulates it, and asks the wallet to sign, whose own screen shows what it pays (as
 * the trade panel does, #7); then it sends, waits for the chain, reports the transaction for indexing and opens the
 * coin's page. Copy Protection's verdicts sit under the name, the ticker and the image as they are checked. The
 * summary shows no fee figure and links to /fees (production's rule) unless `flow` asks for the spec's alternative.
 */
export function LaunchForm({
  platform, quotes, initialQuote, initialName, initialSymbol, flow,
}: {
  platform: PlatformInfo;
  /** The launchable Quote Assets, deepest first. */
  quotes: QuoteAsset[];
  initialQuote: string | null;
  initialName: string;
  initialSymbol: string;
  flow: boolean;
}) {
  const router = useRouter();
  const formId = useId();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const creator = publicKey?.toBase58() ?? null;

  const [name, setName] = useState(initialName);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [links, setLinks] = useState<Record<LinkKind, string>>(() => Object.fromEntries(LINK_KINDS.map((k) => [k, ""])) as Record<LinkKind, string>);
  const [moreLinks, setMoreLinks] = useState(false);
  const recommended = useMemo(() => recommendedQuotes(quotes), [quotes]);
  const others = useMemo(() => quotes.filter((q) => !recommended.includes(q)), [quotes, recommended]);
  const [quoteMint, setQuoteMint] = useState(() => quotes.find((q) => q.mint === initialQuote)?.mint ?? recommended[0]?.mint ?? quotes[0]?.mint ?? null);
  const [kind, setKind] = useState<LaunchKind>("standard");
  const [tax, setTax] = useState<RewardTaxBps>(REWARD_TAX_RATES[0]);
  const [firstBuyText, setFirstBuyText] = useState("");
  const [firstBuyQuote, setFirstBuyQuote] = useState<TradeQuote | null>(null);
  const [firstBuyError, setFirstBuyError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "editing" });
  const [error, setError] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  // An airdrop at launch is only for Creator wallets the operator has allowed (production's rule): until the API has
  // answered for this wallet, nobody is offered one.
  const [airdropAllowedFor, setAirdropAllowedFor] = useState<string | null>(null);
  const [airdropChosen, setAirdropChosen] = useState(false);
  const [airdropText, setAirdropText] = useState("");

  const quote = quotes.find((q) => q.mint === quoteMint) ?? null;
  const ticker = quote ? quoteTicker(quote) : "";
  const coin = symbol.trim();
  const rewardTax = kind === "standard" ? null : tax;
  const firstBuy = quote ? parseUnits(firstBuyText, quote.decimals) : null;
  const firstBuyInvalid = firstBuyText.trim() !== "" && firstBuy === null;
  const copy = useCopyCheck({ name, symbol, image, creator });
  const busy = step.kind === "preparing" || step.kind === "signing" || step.kind === "confirming";
  const failed = step.kind === "failed" ? step : step.kind === "preparing" ? step.retrying : null;

  useEffect(() => {
    if (creator === null) return;
    const abort = new AbortController();
    getLaunchPermissions(creator, abort.signal)
      .then((p) => setAirdropAllowedFor(p.airdrop ? creator : null))
      .catch(() => undefined);
    return () => abort.abort();
  }, [creator]);
  const airdropAllowed = creator !== null && airdropAllowedFor === creator;
  const airdropOn = airdropAllowed && airdropChosen;
  const airdrop = useMemo(() => parseAirdropList(airdropText, COIN_DECIMALS, creator), [airdropText, creator]);
  const bought = firstBuyQuote ? BigInt(firstBuyQuote.amountOut) : null;
  // Something in the list to fix, shown as soon as it is true; then what is still to do, only once the Creator goes ahead.
  const airdropProblem = !airdropOn
    ? null
    : (airdrop.problem ?? (bought !== null && airdrop.total > bought ? "The airdrop gives away more coins than your first buy gets. Buy more or airdrop less." : null));
  const airdropMissing = !airdropOn
    ? null
    : firstBuy === null
      ? "An airdrop is paid from your first buy. Add a first buy."
      : airdrop.recipients.length === 0
        ? "Add the wallets to airdrop to, or turn the airdrop off."
        : null;
  const airdropping = airdropOn && airdrop.recipients.length > 0 && !airdrop.problem;

  const imageUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  // A live quote while the Creator types, so they see the coins they get before anything is prepared. On a Reward
  // Launch the Reward Tax comes off the first buy's coins too, so the quote follows the chosen rate.
  const quoteKey = firstBuy === null || !quote ? null : `${quote.mint}:${firstBuy}:${rewardTax ?? ""}`;
  useEffect(() => {
    setFirstBuyQuote(null);
    setFirstBuyError(null);
    if (quoteKey === null || firstBuy === null || !quote) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setFirstBuyQuote((await getLaunchQuote(quote.mint, firstBuy.toString(), rewardTax, abort.signal)).firstBuy);
      } catch (e) {
        if (!abort.signal.aborted) setFirstBuyError((e as Error).message);
      }
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
    // The key holds every input; the values are read through it.
  }, [quoteKey]);

  function edit(next: () => void) {
    setError(null);
    next();
  }

  function pickImage(file: File | undefined) {
    edit(() => {
      if (!file) return;
      if (file.size > LAUNCH_IMAGE_MAX_BYTES) return setError("The image is larger than 2 MB. Choose a smaller one.");
      if (!(LAUNCH_IMAGE_TYPES as readonly string[]).includes(file.type)) return setError("Choose a PNG, JPEG, WebP or GIF image.");
      setImage(file);
    });
  }

  /** Prepares (or prepares again), simulates, has the wallet sign, sends, confirms, reports, then opens the coin. */
  async function launch(prepare: () => Promise<PreparedLaunch>, launchQuote: QuoteAsset, retrying: Failed | null, withAirdrop: boolean) {
    if (!signTransaction) return setError("This wallet can't sign transactions. Try another wallet.");
    setError(null);
    setStep({ kind: "preparing", retrying });
    let prepared: PreparedLaunch;
    let tx: VersionedTransaction;
    try {
      prepared = await prepare();
      tx = VersionedTransaction.deserialize(Uint8Array.from(atob(prepared.transaction), (c) => c.charCodeAt(0)));
      // Simulated before the wallet is asked, so a launch that would fail says why without costing a signature.
      const sim = await connection.simulateTransaction(tx, { sigVerify: false });
      if (sim.value.err) {
        const text = `${JSON.stringify(sim.value.err)} ${(sim.value.logs ?? []).join(" ")}`;
        throw new Error(simulationError(text, prepared.firstBuy && !isSol(launchQuote) ? quoteTicker(launchQuote) : null));
      }
    } catch (e) {
      // A retry of a coin that landed after all goes to it.
      if (retrying && e instanceof ApiRequestError && e.status === 409 && /already launched/.test(e.message)) return router.push(`/coin/${retrying.mint}`);
      setError(prepareError(e));
      return setStep(retrying ?? { kind: "editing" });
    }

    setStep({ kind: "signing" });
    let signed: VersionedTransaction;
    try {
      signed = await signTransaction(tx);
    } catch (e) {
      const message = (e as Error).message ?? "";
      setError(/reject|declin|cancel/i.test(message) ? "You declined the transaction in your wallet. Nothing was launched." : message);
      return setStep(retrying ?? { kind: "editing" });
    }

    let signature: string;
    try {
      signature = await connection.sendRawTransaction(signed.serialize());
      setStep({ kind: "confirming", signature, symbol: coin });
      const result = await connection.confirmTransaction(
        { signature, blockhash: signed.message.recentBlockhash, lastValidBlockHeight: prepared.lastValidBlockHeight },
        "confirmed",
      );
      if (result.value.err) throw new LaunchFailed(onChainError(JSON.stringify(result.value.err)));
    } catch (e) {
      const failure = launchFailure(e);
      setError(failure.message);
      return setStep({ kind: "failed", mint: prepared.mint, quote: launchQuote, uncertain: failure.uncertain });
    }
    // Indexed at once, so the coin's page has it; the webhook would add it a moment later anyway.
    await reportTransaction(signature).catch(() => undefined);
    // A coin launched with an airdrop goes to its Creator's page, which sends it (#13).
    router.push(withAirdrop ? "/creator#airdrops" : `/coin/${prepared.mint}`);
  }

  function start() {
    if (!publicKey || !quote) return;
    const form = new FormData();
    form.set("creator", publicKey.toBase58());
    form.set("quoteMint", quote.mint);
    form.set("name", name.trim());
    form.set("symbol", coin);
    form.set("description", description.trim());
    for (const k of LINK_KINDS) if (links[k].trim()) form.set(k, links[k].trim());
    if (rewardTax !== null) {
      form.set("rewardTax", String(rewardTax));
      form.set("rewardPayout", kind);
    }
    if (firstBuy !== null) form.set("firstBuy", firstBuy.toString());
    if (airdropping) form.set("airdrop", JSON.stringify(airdrop.recipients.map((r) => ({ wallet: r.wallet, amount: r.amount.toString() }))));
    form.set("image", image!);
    void launch(() => prepareLaunch(form), quote, null, airdropping);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (failed) return void launch(() => retryLaunch(failed.mint), failed.quote, failed, airdropping);
    const missing = !image
      ? "Add an image for your coin."
      : !name.trim()
        ? "Name your coin."
        : !coin
          ? "Give your coin a ticker."
          : !quote
            ? "Choose an asset to pair your coin with."
            : firstBuyInvalid
              ? `Enter a first buy above zero with up to ${quote.decimals} decimal places.`
              : (copy.refusal ?? firstBuyError ?? airdropProblem ?? airdropMissing);
    if (missing) return setError(missing);
    if (!hasAcceptedDisclaimer()) return setDisclaimerOpen(true);
    start();
  }

  const otherChosen = quote && others.includes(quote) ? quote.mint : "";
  const target = quote?.graduationTarget ?? null;
  const graduationFee = platform.graduationFeeLamports === "0" ? null : formatUnits(platform.graduationFeeLamports, SOL_DECIMALS, 4);
  const buttonLabel =
    step.kind === "preparing"
      ? step.retrying ? "Checking…" : "Preparing…"
      : step.kind === "signing"
        ? "Confirm in your wallet…"
        : step.kind === "confirming"
          ? "Launching…"
          : failed
            ? "Try again"
            : `Stoke ${coin || "a coin"}`;

  return (
    <>
      <div className="shell page-head"><h1>Stoke a coin</h1></div>
      <div className={`shell ${styles.launch}`}>
        <form id={formId} className={styles.form} aria-label="Stoke a coin" onSubmit={onSubmit} aria-busy={busy} noValidate>
          <fieldset className={styles.set} disabled={busy || failed !== null}>
            <legend>Your coin</legend>
            <div className={styles.field}>
              <label className={styles.drop} data-filled={imageUrl ? true : undefined}>
                <input
                  type="file"
                  accept={LAUNCH_IMAGE_TYPES.join(",")}
                  className="visually-hidden"
                  onChange={(e) => pickImage(e.target.files?.[0])}
                />
                {imageUrl ? (
                  <>
                    <img className={styles.dropImage} src={imageUrl} alt="" />
                    <span>Change image</span>
                  </>
                ) : (
                  <span>Add image</span>
                )}
              </label>
              <Verdict field="image" verdict={copy.image} />
            </div>
            <div className={styles.two}>
              <div className={styles.field}>
                <label className="field">
                  <span>Name</span>
                  <input value={name} onChange={(e) => edit(() => setName(e.target.value))} maxLength={NAME_MAX} placeholder="Tracer Bullet" autoComplete="off" />
                </label>
                <Verdict field="name" verdict={copy.name} />
              </div>
              <div className={styles.field}>
                <label className="field">
                  <span>Ticker</span>
                <input
                  value={symbol}
                  onChange={(e) => edit(() => setSymbol(cleanSymbol(e.target.value)))}
                  maxLength={SYMBOL_MAX}
                  placeholder="TRCR"
                  autoComplete="off"
                  spellCheck={false}
                />
                </label>
                <Verdict field="symbol" verdict={copy.symbol} />
              </div>
            </div>
            <label className="field">
              <span>Description</span>
              <textarea value={description} onChange={(e) => edit(() => setDescription(e.target.value))} maxLength={DESCRIPTION_MAX} />
            </label>
          </fieldset>

          <fieldset className={styles.set} disabled={busy || failed !== null}>
            <legend>Paired with</legend>
            <div className={styles.options} role="radiogroup" aria-label="Paired with">
              {recommended.map((q) => (
                <label key={q.mint} className={styles.option}>
                  <input type="radio" name="quote" value={q.mint} checked={q.mint === quoteMint} onChange={() => edit(() => setQuoteMint(q.mint))} />
                  <AssetTile quote={q} />
                  <span><b>{quoteTicker(q)}</b></span>
                  <span className="badge">{kindLabel(q)}</span>
                </label>
              ))}
            </div>
            {others.length > 0 && (
              <label className="field">
                <span>Any other asset</span>
                <select value={otherChosen} onChange={(e) => edit(() => setQuoteMint(e.target.value || (recommended[0]?.mint ?? null)))}>
                  <option value="">Choose</option>
                  {others.map((q) => (
                    <option key={q.mint} value={q.mint}>{quoteOption(q)}</option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

          <fieldset className={styles.set} disabled={busy || failed !== null}>
            <legend>Launch type</legend>
            <div className={styles.options} role="radiogroup" aria-label="Launch type">
              <TypeOption value="standard" kind={kind} onPick={(k) => edit(() => setKind(k))}><b>Standard</b></TypeOption>
              <TypeOption value="coin" kind={kind} onPick={(k) => edit(() => setKind(k))}><b>Reward Launch</b>, paid in the coin</TypeOption>
              <TypeOption value="quote" kind={kind} onPick={(k) => edit(() => setKind(k))}><b>Reward Launch</b>, paid in {ticker || "its pair"}</TypeOption>
              {/* The Holders destination (ADR 0011), shown before it is built (owner, 2026-10-30): it takes no choice. */}
              <label className={styles.option} data-soon>
                <input type="radio" name="type" value="holders" disabled />
                <span><b>Holder rewards</b></span>
                <span className="badge">Coming soon</span>
              </label>
            </div>
            {kind !== "standard" && (
              <div className="field">
                <span id={`${formId}-tax`}>Reward Tax</span>
                <div className={`seg ${styles.tax}`} role="radiogroup" aria-labelledby={`${formId}-tax`}>
                  {REWARD_TAX_RATES.map((bps) => (
                    <label key={bps}>
                      <input type="radio" name="tax" value={bps} checked={tax === bps} onChange={() => edit(() => setTax(bps))} />
                      {bps / 100}%
                    </label>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          <fieldset className={styles.set} disabled={busy || failed !== null}>
            <legend>Links</legend>
            <div className={styles.two}>
              {FIRST_LINKS.slice(0, 2).map((k) => <LinkField key={k} kind={k} value={links[k]} onChange={(v) => edit(() => setLinks((l) => ({ ...l, [k]: v })))} />)}
            </div>
            {FIRST_LINKS.slice(2).map((k) => <LinkField key={k} kind={k} value={links[k]} onChange={(v) => edit(() => setLinks((l) => ({ ...l, [k]: v })))} />)}
            {moreLinks ? (
              <div className={styles.two}>
                {MORE_LINKS.map((k) => <LinkField key={k} kind={k} value={links[k]} onChange={(v) => edit(() => setLinks((l) => ({ ...l, [k]: v })))} />)}
              </div>
            ) : (
              <button type="button" className={`button button-ghost ${styles.more}`} onClick={() => setMoreLinks(true)}>More links</button>
            )}
          </fieldset>

          <fieldset className={styles.set} disabled={busy || failed !== null}>
            <legend>First buy</legend>
            <label className={`amount ${firstBuyInvalid ? styles.invalid : ""}`}>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-label="First buy"
                aria-invalid={firstBuyInvalid}
                value={firstBuyText}
                onChange={(e) => edit(() => setFirstBuyText(e.target.value.replace(",", ".")))}
              />
              <span className={styles.token}>{ticker}</span>
            </label>
            {airdropAllowed && (
              <label className={styles.toggle}>
                <input type="checkbox" checked={airdropChosen} onChange={(e) => edit(() => setAirdropChosen(e.target.checked))} />
                <span>Airdrop part of it to other wallets</span>
              </label>
            )}
            {airdropOn && (
              <div className={styles.field}>
                <label className="field">
                  <span>Wallets and amounts</span>
                  <textarea
                    className={`mono ${styles.list}`}
                    rows={4}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={`Wallet address, coins\nUp to ${AIRDROP_MAX_RECIPIENTS} wallets, one a line`}
                    value={airdropText}
                    aria-invalid={Boolean(airdropProblem)}
                    onChange={(e) => edit(() => setAirdropText(e.target.value))}
                  />
                </label>
                {airdropProblem && <span className={styles.verdict} data-status="taken">{airdropProblem}</span>}
              </div>
            )}
          </fieldset>
        </form>

        <aside className={styles.aside} aria-label="Launch summary">
          <div className={`panel pad ${styles.preview}`}>
            <div className={styles.coin}>
              {imageUrl ? <img className="tile tile-lg" src={imageUrl} alt="" /> : <span className="tile tile-lg" aria-hidden="true">{(coin || "T").slice(0, 1)}</span>}
              <span>
                <b className={styles.pair}>{quote ? <PairName symbol={coin || "TICKER"} quote={quote} /> : coin || "TICKER"}</b>
                <span className="muted">{name.trim() || "Your coin"}</span>
              </span>
            </div>
            <dl className="kv">
              <div><dt>Supply</dt><dd>{COIN_SUPPLY.toLocaleString("en-US")}, fixed</dd></div>
              {target && quote && <div><dt>Graduates at</dt><dd>{formatAmount(target.raw, quote.decimals)} {ticker} raised</dd></div>}
              <div>
                <dt>Launch type</dt>
                <dd>{kind === "standard" ? "Standard" : `Reward Launch, ${tax / 100}%`}</dd>
              </div>
              {firstBuyQuote && quote && (
                <>
                  <div><dt>First buy</dt><dd>{formatUnits(firstBuyQuote.amountIn, quote.decimals, quote.decimals)} {ticker}</dd></div>
                  <div>
                    <dt>You get</dt>
                    <dd>{formatUnits(firstBuyQuote.amountOut, COIN_DECIMALS, 0)} {coin || "coins"} ({supplyShare(BigInt(firstBuyQuote.amountOut))})</dd>
                  </div>
                </>
              )}
              {airdropping && (
                <div>
                  <dt>Airdrop</dt>
                  <dd>
                    {formatUnits(airdrop.total.toString(), COIN_DECIMALS, COIN_DECIMALS)} {coin || "coins"} to {airdrop.recipients.length}{" "}
                    {airdrop.recipients.length === 1 ? "wallet" : "wallets"}
                  </dd>
                </div>
              )}
              {!flow && <div><dt>You earn</dt><dd><Link className="link" href="/fees">Half of what we collect</Link></dd></div>}
              {graduationFee && <div><dt>Graduation Fee</dt><dd>{graduationFee} SOL from earnings</dd></div>}
              <div><dt>Launch cost</dt><dd>Network fees and rent</dd></div>
            </dl>
            {flow && <FeeFlow platform={platform} tax={rewardTax} />}
            <ul className={styles.checks}>
              <li>Liquidity locked at graduation</li>
              <li>Metadata stored on Arweave</li>
              <li>Every payment on the ledger</li>
            </ul>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {step.kind === "confirming" && (
              <p className={styles.status} role="status">
                Launching {step.symbol}.{" "}
                <a className="link" href={explorerUrl("tx", step.signature, platform)} target="_blank" rel="noreferrer">View transaction</a>
              </p>
            )}
            {publicKey ? (
              <div className={styles.actions}>
                {failed && !failed.uncertain && (
                  <button type="button" className="button button-ghost button-lg" disabled={busy} onClick={() => { setError(null); setStep({ kind: "editing" }); }}>
                    Edit
                  </button>
                )}
                <button type="submit" form={formId} className="button button-lg button-block" disabled={busy}>{buttonLabel}</button>
              </div>
            ) : (
              <WalletButton block />
            )}
            <p className={styles.note}>
              What you earn is approximate and depends on trading that may never happen. A coin can lose all of its value, and nothing here is
              investment advice.
            </p>
          </div>
        </aside>
      </div>
      <Disclaimer
        action="launch"
        open={disclaimerOpen}
        onCancel={() => setDisclaimerOpen(false)}
        onAccept={() => {
          setDisclaimerOpen(false);
          start();
        }}
      />
    </>
  );
}

/** An asset's logo on the option's tile, or its first letter. */
function AssetTile({ quote }: { quote: QuoteAsset }) {
  return quote.logo ? (
    <img className={`tile ${styles.assetTile}`} src={quote.logo} alt="" />
  ) : (
    <span className={`tile ${styles.assetTile}`} aria-hidden="true">{quoteTicker(quote).slice(0, 1)}</span>
  );
}

function TypeOption({ value, kind, onPick, children }: { value: LaunchKind; kind: LaunchKind; onPick: (k: LaunchKind) => void; children: ReactNode }) {
  return (
    <label className={styles.option}>
      <input type="radio" name="type" value={value} checked={kind === value} onChange={() => onPick(value)} />
      <span>{children}</span>
    </label>
  );
}

function LinkField({ kind, value, onChange }: { kind: LinkKind; value: string; onChange: (value: string) => void }) {
  const info = LINK_INFO[kind];
  return (
    <label className="field">
      <span>{info.label}</span>
      <input type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder={info.placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * Copy Protection's verdict under a field, once the API has answered for what the field holds: free, unreadable, or
 * which coin holds it and until when.
 */
function Verdict({ field, verdict }: { field: CopyField; verdict: CopyVerdict | null }) {
  if (!verdict) return null;
  const of = verdict.of;
  const until = of && <time dateTime={of.protectedUntil}>{protectedUntil(of.protectedUntil)}</time>;
  const text =
    verdict.status === "free" ? (
      field === "image" ? "Not a protected coin's image" : "Free"
    ) : verdict.status === "unchecked" || !of ? (
      "Can't be checked for a copy (PNG or JPEG can)"
    ) : verdict.kind === "near" ? (
      <>Too close to {of.symbol} ({of.name}), protected until {until}</>
    ) : field === "image" ? (
      <>A copy of {of.symbol}&apos;s image, protected until {until}</>
    ) : (
      <>Taken by {of.name} ({of.symbol}) until {until}</>
    );
  return (
    <span className={styles.verdict} data-copy={field} data-status={verdict.status}>
      {text}
    </span>
  );
}

/**
 * The spec's departure from production's rule, shown only with `?summary=flow` until the owner decides (the map's open
 * question 1): where $1,000 of curve trading goes, from the fees the chain has now.
 */
function FeeFlow({ platform, tax }: { platform: PlatformInfo; tax: number | null }) {
  const dollars = (bps: number) => `$${((bps / 10_000) * 1000).toFixed(2)}`;
  const rows: [string, string][] = [
    ["To you", dollars(platform.creatorForward.curveBps + platform.creatorFeeBps)],
    ...(tax ? [["To holders", dollars(tax)] as [string, string]] : []),
    ["To the platform", dollars(platform.platformFeeBps - platform.creatorForward.curveBps)],
    ["To Raydium", dollars(platform.raydiumFee.curveBps)],
  ];
  return (
    <section className={styles.flow} aria-labelledby="flow-title">
      <h3 id="flow-title">Per $1,000 traded</h3>
      <dl className="kv">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <Link className="link" href="/fees">Every fee</Link>
    </section>
  );
}

/** An API or simulation error in the Creator's words: the API's own sentences pass through, anything else is generic. */
function prepareError(e: unknown) {
  const message = (e as Error).message ?? "";
  if (/^[A-Z]/.test(message) && message.endsWith(".")) return message;
  return "Something went wrong preparing the launch. Try again in a moment.";
}

/** A launch that reached the chain and failed there, with the reason in the Creator's words. */
class LaunchFailed extends Error {}

/**
 * Sorts a failure after signing into what is known. The node refusing the transaction (its preflight failed), the chain
 * failing it, or its blockhash expiring all mean nothing was created. Anything else after it was sent, such as a dropped
 * connection, leaves it uncertain whether the coin launched.
 */
function launchFailure(e: unknown): { message: string; uncertain: boolean } {
  if (e instanceof LaunchFailed) return { message: e.message, uncertain: false };
  const landed = landedError(e);
  if (landed) return { message: onChainError(landed), uncertain: false };
  if (e instanceof TransactionExpiredBlockheightExceededError)
    return { message: "The launch transaction expired before it landed, so nothing was created. Try again.", uncertain: false };
  if (e instanceof SendTransactionError) {
    const text = `${e.message} ${(e.logs ?? []).join(" ")}`;
    return {
      message: /insufficient (lamports|funds)|InsufficientFundsForRent|0x1\b|debit an account/.test(text)
        ? "Your wallet no longer has enough SOL to pay for the launch, so it wasn't sent and nothing was created. Add SOL and try again."
        : "The network refused the launch transaction, so nothing was created. Try again.",
      uncertain: false,
    };
  }
  return { message: "We couldn't confirm whether your coin launched. Check your connection, then try again.", uncertain: true };
}
