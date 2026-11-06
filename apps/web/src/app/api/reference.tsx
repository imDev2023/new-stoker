import type { ReactNode } from "react";

/**
 * The public API's reference, the whole of it, as the page's content (production's, owner 2026-10-25: everything on the
 * page, nothing left in the repository to link out to). The zod contract in `packages/contract` is the source of truth
 * for every shape; this is the map. Keep it to what the API really answers: a row names an endpoint and says what it
 * answers or prepares, and the errors list only the statuses `apps/api/src` sends. Carried from
 * `12dbc10:apps/web/src/app/(terminal)/api/reference.tsx` after a line-by-line read, with #3's Quote Asset fields, the
 * region gates' operator endpoints production left out, and no rate written out: a fee figure lives on `/fees` alone.
 */

/** One row: its endpoints (`GET /platform`, or a status for an error) and what they answer. */
export type Row = { endpoints: readonly string[]; text: ReactNode };
export type Section = { id: string; title: string; badge?: string; lead?: ReactNode; rows?: readonly Row[] };

export const SIGN_SEND_REPORT = `import { Connection, VersionedTransaction } from "@solana/web3.js";

const api = "https://api.stoker.markets/v1";
const prepared = await (await fetch(\`\${api}/trades/prepare\`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mint, trader: wallet.publicKey.toBase58(), side: "buy", amount: "100000000", slippageBps: 100 }),
})).json();

const tx = VersionedTransaction.deserialize(Buffer.from(prepared.transaction, "base64"));
tx.sign([wallet]);
const connection = new Connection(rpcUrl, "confirmed"); // your own RPC, or rpcUrl from GET /platform
const signature = await connection.sendTransaction(tx);
await connection.confirmTransaction({ signature, blockhash: tx.message.recentBlockhash, lastValidBlockHeight: prepared.lastValidBlockHeight }, "confirmed");
await fetch(\`\${api}/transactions/\${signature}\`, { method: "POST" });`;

export const READING: Section = {
  id: "reading",
  title: "Reading",
  badge: "No key",
  rows: [
    {
      endpoints: ["GET /platform"],
      text: (
        <>
          The cluster, an RPC for browsers, the program and PlatformConfig addresses, the Graduation Target in lamports, and every fee as the chain has it now: the Platform Fee and Creator Fee on the curve (<code>platformFeeBps</code>, <code>creatorFeeBps</code>, the latter 0 on this platform), the pool&apos;s creator fee (<code>poolCreatorFeeBps</code>) with the share of it Raydium keeps at collection (<code>poolCreatorFeeShareBps</code>), Raydium&apos;s own fee on each venue (<code>raydiumFee</code>), the share of the pool trade fee its liquidity providers keep (<code>raydiumFee.poolLpShareBps</code>, which reaches the platform through the Fee Key), the referral share rate (<code>referralShareBps</code>), <code>creatorForward</code>: the Creator&apos;s share of what the platform collects on their coin&apos;s trades (<code>shareBps</code>), also as basis points of curve and pool volume, with its minimum; the Graduation Fee in lamports (<code>graduationFeeLamports</code>, ADR 0015), and the route&apos;s slippage limit for buys paid with SOL (<code>solRouteToleranceBps</code>). The site&apos;s Fees page is drawn from this answer.
        </>
      ),
    },
    {
      endpoints: ["GET /region"],
      text: (
        <>
          The region gate: the visitor&apos;s <code>country</code> as the edge read it (null when it could not) and the features <code>withheld</code> there, from a table the operator keeps per feature; empty until a feature is withheld somewhere. The answer is one visitor&apos;s own and never cached, so ask it from the browser, not a server.
        </>
      ),
    },
    {
      endpoints: ["GET /quotes", "GET /quotes/:mint"],
      text: (
        <>
          The Quote Registry: every Quote Asset with its <code>category</code> and, for a tokenized stock, its <code>issuer</code> (from the mint&apos;s address and authorities and the token list&apos;s tags, never a name), its price, Graduation Target, whether it can be launched against, whether a referral share fee applies on it, its <code>liquidityUsd</code> from the token list (null when the list doesn&apos;t know the mint; SOL comes first, then what can be launched against, the deepest markets first), its <code>change24h</code> (how its USD price moved over the last 24 hours as a fraction, against the Quote Registry&apos;s own records; absent without a USD price), and its Quote Risk Labels (<code>labels</code>: <code>kind</code>, <code>severity</code>, <code>title</code>, <code>detail</code>, <code>source</code>; null until the Quote Registry refresh has checked the mint, an empty list when there is nothing to flag). Labels come from the mint&apos;s authorities and Token-2022 extensions and from the token list; they inform and never block. Its <code>market</code> is the market behind it as TradingView names it (<code>symbol</code>, <code>venue</code>, <code>ticker</code>: the stock or fund a tokenized stock tracks, from its issuer and ticker, or a coin&apos;s own market, from its mint; null when none is known), which the asset&apos;s page charts, and for a stock or fund its <code>last</code> price in US dollars per share with when the price source reported it.
        </>
      ),
    },
    {
      endpoints: ["GET /quotes/:mint/candles?interval=1h"],
      text: (
        <>
          A Quote Asset&apos;s USD price in hourly candles, the newest 500, from the prices the Quote Registry records at each refresh: the shape a coin&apos;s candles take, each candle opening at the last price before its hour, with a volume of <code>&quot;0&quot;</code>, since the registry records prices, not trades.
        </>
      ),
    },
    {
      endpoints: ["GET /launches"],
      text: (
        <>
          The board. <code>sort</code> (<code>new</code>, <code>trending</code>, <code>market_cap</code>, <code>graduation</code>), <code>q</code> (a search: a name or ticker containing it in any case, or a mint address starting with it; up to 64 characters), <code>quote</code>, <code>category</code> (<code>sol</code>, <code>stablecoin</code>, <code>tokenized_stock</code>, <code>rwa</code>, <code>wrapped</code>, <code>defi</code>, <code>leveraged</code>, <code>collectible</code>, <code>meme</code>, <code>community</code>), <code>issuer</code> (<code>xstocks</code>, <code>prestocks</code>, <code>tessera</code>, <code>backpack</code>: the stock issuer of the Quote Asset, finer than <code>category=tokenized_stock</code>), <code>status</code>, <code>limit</code>, <code>offset</code>.
        </>
      ),
    },
    {
      endpoints: ["GET /launches/quotes"],
      text: <>The Quote Assets that have Launches, for filters; each with its <code>category</code>, for a tokenized stock its <code>issuer</code>, how many <code>launches</code> it has and their <code>volume24h</code>.</>,
    },
    {
      endpoints: ["GET /launches/:mint"],
      text: (
        <>
          One Launch: curve progress, Graduation (with its <code>fee</code>, the Graduation Fee and how much of it has been withheld), Reward Tax (with its <code>payout</code> asset, <code>coin</code> or <code>quote</code>), market (<code>price</code>, <code>marketCap</code>, <code>volume24h</code>, <code>change24h</code> and <code>change5m</code>, the price change over the day and over five minutes as fractions, null until the first trade, and <code>holders</code>, the wallets whose indexed buys exceed their sells, a floor on the chain&apos;s count), Copy Protection (<code>protection.until</code>, and <code>copyOf</code> when the coin took an earlier coin&apos;s name, ticker or image).
        </>
      ),
    },
    {
      endpoints: ["GET /launches/:mint/trades", "GET /launches/:mint/candles?interval=", "GET /launches/:mint/holders"],
      text: <>Indexed trades (with any referral fee paid), price candles (<code>1m</code>, <code>5m</code>, <code>15m</code>, <code>1h</code>, <code>4h</code> or <code>1d</code>), and the top holders read from the chain.</>,
    },
    {
      endpoints: ["GET /launches/:mint/trust"],
      text: (
        <>
          The coin&apos;s trust figures, computed from the indexed trades and launches on every request so anyone can recompute them (ADR 0013). <code>creator</code>: how many coins the Creator launched here and how many graduated, and their First Buy in the launch transaction. <code>snipers</code>, Bundle Radar: every wallet but the Creator that bought in the Snipe Window (<code>windowSlots</code>, the launch&apos;s slot and five after it deployed), largest buy first, each with the slot it landed in after the launch&apos;s, what it bought and what it holds by its trades since, and how many others paid exactly the same amount; the totals as shares of the supply, and how many wallets landed in the launch&apos;s own slot or matched another&apos;s amount. A label informs; none stops a trade.
        </>
      ),
    },
    {
      endpoints: ["GET /launches/:mint/quote"],
      text: (
        <>
          A trade quote. <code>side</code>, <code>amount</code>, <code>slippageBps</code>, <code>payWith</code> (<code>quote</code> or <code>sol</code>), <code>referrer</code>. A buy paid with SOL on a coin paired with another asset carries <code>route</code>: the swap takes exactly <code>solIn</code>, the trade spends <code>quoteOut</code> (the least the swap may deliver, <code>slippageBps.route</code> under the current price), and about <code>kept</code> of the Quote Asset stays in the trader&apos;s wallet.
        </>
      ),
    },
    { endpoints: ["GET /launches/:mint/airdrop"], text: <>An Airdrop&apos;s recipients and which are paid.</> },
    {
      endpoints: ["GET /launches/:mint/rewards", "GET /rewards/rules", "GET /rewards/rounds/:id", "GET /wallets/:address/rewards"],
      text: (
        <>
          Holder Rewards: the Payout Asset, tax waiting, the pot, the rules in force and announced, every round, a wallet&apos;s payouts; for a Quote Asset payout also the Reward Sales (<code>sales</code>: the bounds, totals, and the latest sales with their transactions). Amounts of a pot or payout are in the round&apos;s <code>payout</code> asset.
        </>
      ),
    },
    {
      endpoints: ["GET /creators/:address/earnings", "GET /creators/:address/forwards"],
      text: (
        <>
          Creator Earnings: per Quote Asset what the Creator&apos;s Launches earned (half of what the platform collected on their trades), what Graduation Fees kept of it (<code>withheld</code>), what was forwarded to their wallet and what is still pending; per Launch what its curve and pool earned and its <code>graduationFee</code> once it has graduated (the fee in lamports, what has been withheld toward it in the Quote Asset and its worth, and when it was settled); and every forward with its transaction. Nothing to claim.
        </>
      ),
    },
    {
      endpoints: ["GET /creators/:address/launch-permissions"],
      text: <>What the launch form offers this wallet: <code>airdrop</code> is true only for wallets the operator has allowed.</>,
    },
    {
      endpoints: ["GET /stats"],
      text: <>The platform&apos;s figures: <code>since</code> (when the first coin launched), <code>launches</code>, <code>graduated</code>, and <code>volume24h</code> across every coin in SOL and USD at the Quote Registry&apos;s latest prices.</>,
    },
    {
      endpoints: ["GET /revenue", "GET /ledger"],
      text: (
        <>
          Platform revenue per asset and per day, with what of it was forwarded to Creators and what is still owed them, and the Ledger page by page (<code>kind</code>, <code>limit</code>, <code>before</code>). A <code>creator_forward</code> entry is a payment to a Creator, an <code>arweave_top_up</code> SOL sent to ArDrive Turbo for upload credits, a <code>metadata_upload</code> what one Launch&apos;s permanent metadata cost in those credits, in lamports, against its launch transaction, a <code>reward_sale</code> a Reward Launch&apos;s tax sold for its holders: the coins out and the Quote Asset in, two entries of one transaction, and a <code>graduation_fee</code> a Graduation Fee (ADR 0015) withheld from a Creator&apos;s share in the coin&apos;s Quote Asset, keyed by the graduation transaction from event index 1000 up; nothing moves, so it is never added to a total, and each asset&apos;s <code>graduationFee</code> on <code>GET /revenue</code> is the sum of them.
        </>
      ),
    },
    { endpoints: ["GET /burns"], text: <>Burn and Flywheel: shares, rule, budgets, picks, every buy and burn.</> },
    { endpoints: ["GET /announcements"], text: <>Every announced Platform Fee or Creator Fee change, with the transaction that applied it once it has.</> },
    {
      endpoints: ["GET /metadata/:mint.json", "GET /metadata/:mint/image"],
      text: (
        <>
          Outside <code>/v1</code>. A coin&apos;s metadata JSON and image as the platform&apos;s own cache serves them. The address on the chain is the Arweave one, where both are posted once the launch is indexed; this copy answers under the platform&apos;s domain meanwhile and after.
        </>
      ),
    },
    { endpoints: ["GET /health"], text: <>Outside <code>/v1</code>. Answers only when the deployment&apos;s configuration is valid, so a misconfigured deploy never looks ready.</> },
  ],
};

export const PREPARING: Section = {
  id: "preparing",
  title: "Preparing transactions",
  badge: "Unsigned",
  lead: (
    <>
      Each returns an unsigned transaction (base64) for the user&apos;s wallet to sign and send, with its <code>lastValidBlockHeight</code>. Nothing is custodied: the API never holds a key of yours, and a transaction it prepares does only what its endpoint says.
    </>
  ),
  rows: [
    {
      endpoints: ["POST /launches/prepare", "POST /launches/:mint/prepare"],
      text: (
        <>
          A launch, as multipart form data: <code>creator</code>, <code>quoteMint</code>, <code>name</code>, <code>symbol</code>, <code>description</code>, <code>website</code>, <code>x</code>, <code>telegram</code>, <code>discord</code>, <code>tiktok</code>, <code>instagram</code>, <code>youtube</code> (each an optional https URL), <code>image</code>, and the launch modes <code>firstBuy</code>, <code>airdrop</code>, <code>rewardTax</code> and, with it, <code>rewardPayout</code> (<code>coin</code> or <code>quote</code>; <code>coin</code> unless set, refused with 400 without <code>rewardTax</code>). An <code>airdrop</code> from a wallet the operator has not allowed is refused with 403. The mint address and the coin&apos;s <code>metadataUri</code> on Arweave are fixed at first prepare; the second form rebuilds the same launch for a retry, so a retry never mints a second coin. The image and metadata JSON are uploaded to Arweave once the launch is indexed; until then the URI answers 404. A name, ticker or image that a coin launched inside its Copy Protection window already has is refused with 409 and the verdict (<code>copy</code>), as <code>POST /launches/check</code> would have said.
        </>
      ),
    },
    {
      endpoints: ["POST /launches/check"],
      text: (
        <>
          Copy Protection before the form is sent, as multipart form data: <code>name</code>, <code>symbol</code> and <code>image</code>, each optional, and <code>creator</code>, whose own coins never count. Answers a verdict per field sent (<code>free</code>, <code>taken</code> with the protected coin and the sentence prepare would refuse with, or <code>unchecked</code> for an image the API can&apos;t read) and <code>protectionSeconds</code>, the window every launch gets.
        </>
      ),
    },
    { endpoints: ["GET /launch-quote"], text: <>What a First Buy would get before anything is prepared.</> },
    { endpoints: ["POST /launches/:mint/airdrop/prepare"], text: <>The Creator&apos;s airdrop payments, however many transactions they take.</> },
    {
      endpoints: ["POST /trades/prepare"],
      text: (
        <>
          A buy or sell, on the curve or in the pool: <code>mint</code>, <code>trader</code>, <code>side</code>, <code>amount</code>, <code>slippageBps</code>, <code>payWith</code>, <code>referrer</code>. <code>amount</code> is in raw units of what is paid: the Quote Asset for a buy (lamports when <code>payWith</code> is <code>sol</code>), the coin for a sell.
        </>
      ),
    },
    { endpoints: ["POST /transactions/:signature"], text: <>Reports a confirmed transaction so it shows up at once, without waiting for the webhook.</> },
  ],
};

export const SIGNING: Section = {
  id: "signing",
  title: "Sign, send, report",
  lead: (
    <>
      The same three steps for a launch, a trade or an airdrop: deserialize the transaction, sign it with the wallet it was prepared for, send it to the chain, then report its signature so it shows up at once rather than when the webhook delivers it. A launch transaction already carries the new mint&apos;s signature; the Creator&apos;s wallet signs as fee payer. In a browser a Wallet Standard wallet signs with <code>signTransaction</code>, and the rest is the same.
    </>
  ),
};

export const REFERRALS: Section = {
  id: "referrals",
  title: "Referrals",
  lead: (
    <>
      A trade prepared with <code>referrer</code> pays that wallet LaunchLab&apos;s share fee, on-chain, in the Quote Asset, at the rate <code>GET /platform</code> reports (<code>referralShareBps</code>, the Fees page&apos;s referral share), where the Quote Asset&apos;s GlobalConfig allows a share fee (<code>referralShare</code> on <code>GET /quotes</code>; SOL&apos;s does, and most others, every tokenized stock among them, allow none). The quote says whether it applies and what it pays (<code>referral</code>), the trade records it (<code>referral</code> on each trade), and the referrer&apos;s Quote Asset account is opened by the trader if it doesn&apos;t exist. A trader can&apos;t refer themselves, and a pool trade after Graduation pays no referral fee. The web app takes the referrer from <code>?ref=&lt;wallet&gt;</code> on a coin page.
    </>
  ),
};

export const ERRORS: Section = {
  id: "errors",
  title: "Errors",
  lead: <>An error answers <code>{'{ "error": "<one sentence>" }'}</code>, with the status that says what kind it is.</>,
  rows: [
    {
      endpoints: ["400"],
      text: (
        <>
          The body or query isn&apos;t what the contract asks (<code>details</code> carries the validation issues, each with its <code>path</code> and <code>message</code>), an address that isn&apos;t a wallet address, a mint that is no Quote Asset, or a launch mode that can&apos;t be set up as given.
        </>
      ),
    },
    { endpoints: ["401"], text: <>An unknown or revoked key in <code>x-api-key</code>; the operator&apos;s endpoints without their token.</> },
    { endpoints: ["403"], text: <>A launch with an airdrop from a wallet the operator hasn&apos;t allowed one.</> },
    {
      endpoints: ["404"],
      text: <>No such coin, Quote Asset, round or key; <code>/rewards</code> of a coin that is no Reward Launch; <code>/airdrop</code> of a coin launched without one; a reported transaction not found or not confirmed yet.</>,
    },
    {
      endpoints: ["409"],
      text: (
        <>
          A launch whose name, ticker or image a coin inside its Copy Protection window already has (<code>copy</code> carries the verdict); a retry of a coin that has already launched (<code>details.mint</code>); an airdrop that can&apos;t be sent right now: every wallet paid, the coin not launched yet, or transactions handed out a moment ago that can still land (<code>details.retryAfterSeconds</code>); a pool Raydium has paused or that opens in a moment; a fee change already applied; a chosen mint key a draft has taken, or whose address is already a coin or draft here.
        </>
      ),
    },
    {
      endpoints: ["422"],
      text: <>Well-formed, but not as asked: a Quote Asset the curve rules don&apos;t admit at today&apos;s price, or a buy paid with SOL where no route exists or none fits one transaction; for the operator, a fee or rules change announced with too short a lead, a fee change prepared before its date, or a Platform Token that is no coin of this platform.</>,
    },
    { endpoints: ["429"], text: <>Past a rate limit; <code>retry-after</code> says how many seconds to wait.</> },
    {
      endpoints: ["500", "503"],
      text: <>Ours: an internal error, or a dependency down for the moment (the price source, the SOL route, reading holders from the chain). Try again in a minute.</>,
    },
  ],
};

export const OPERATOR: Section = {
  id: "operator",
  title: "The operator's endpoints",
  badge: "Operator token",
  lead: <>Behind <code>Authorization: Bearer &lt;OPERATOR_TOKEN&gt;</code>. Listed so what the operator can do is public; nothing here moves a user&apos;s funds.</>,
  rows: [
    {
      endpoints: ["GET /operator/overview"],
      text: <>Launches by status, rounds, burns, Launches with their metadata on Arweave and still waiting (<code>metadataUploads</code>), the latest run of each job, open alerts, the fees on-chain.</>,
    },
    { endpoints: ["GET /operator/alerts"], text: <>Alerts: a stuck Graduation, a Reward Tax left unlocked, a failed job, a stalled Reward Round; each resolved when its cause goes away.</> },
    { endpoints: ["GET /operator/jobs?job="], text: <>Job runs and unsettled job transactions.</> },
    {
      endpoints: ["POST /operator/jobs/:job"],
      text: (
        <>
          Runs a job now: <code>quote-registry</code>, <code>fee-collector</code>, <code>creator-forward</code>, <code>reward-rounds</code>, <code>burn</code> or <code>metadata-upload</code>; <code>?fail=simulated</code> makes it fail on purpose to see the alert path.
        </>
      ),
    },
    { endpoints: ["POST /operator/rewards/rules"], text: <>Announces a Reward Round rules change, effective no sooner than the announced lead ahead.</> },
    { endpoints: ["PUT /operator/platform-token"], text: <>Names the Platform Token the Burn buys.</> },
    {
      endpoints: ["GET /operator/region-gates", "PUT /operator/region-gates"],
      text: (
        <>
          The region gate&apos;s table (ADR 0014): each feature withheld and the countries it is withheld in (<code>gates</code>), which <code>GET /region</code> answers every visitor from. It starts empty, and a feature is withheld only where someone asks for it.
        </>
      ),
    },
    {
      endpoints: ["GET /operator/airdrop-creators", "POST /operator/airdrop-creators", "DELETE /operator/airdrop-creators/:wallet"],
      text: <>The Creator wallets allowed an airdrop at launch (<code>wallet</code>). The list starts empty, so nobody is offered one until the operator names a wallet.</>,
    },
    {
      endpoints: ["GET /operator/mint-keys", "POST /operator/mint-keys", "DELETE /operator/mint-keys/:mint"],
      text: (
        <>
          Mint keys chosen for a Creator wallet&apos;s next launch (<code>creator</code>, <code>secretKey</code>: a keypair file&apos;s 64 bytes), kept encrypted; the list says which a draft has taken, never the secret. A taken key can&apos;t be removed; a stored address that is already a coin or draft here is refused.
        </>
      ),
    },
    {
      endpoints: ["POST /operator/fees/announce", "POST /operator/fees/prepare"],
      text: (
        <>
          Announces a Platform Fee or Creator Fee change, effective no sooner than a day ahead on mainnet, and once due prepares the <code>update_platform_config</code> transaction for the cold admin key. The Indexer marks the announcement applied when the change lands.
        </>
      ),
    },
    {
      endpoints: ["POST /operator/api-keys", "GET /operator/api-keys", "DELETE /operator/api-keys/:id"],
      text: (
        <>
          Issues a key (<code>name</code>, <code>rateLimitPerMinute</code>, 60 by default) and answers with it once and never again; lists the keys without them; revokes one.
        </>
      ),
    },
  ],
};
