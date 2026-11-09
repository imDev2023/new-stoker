# Programs research: which programs of our own make Stoker better, and in what order

Ticket #4, written 2026-11-04 by an unattended relay session for the owner's review.
ADR 0018 allows programs of our own; this note says which ones, why, how each works on Solana, and in what order, and [ADR 0019](../adr/0019-programs-and-their-order.md) proposes the decision.
The owner accepted that ADR on 2026-11-09 (section 11 has the answers), and its tickets are #40 to #45.

## Summary

- Stay on LaunchLab and Raydium's CPMM.
  Our own curve, or a move to Meteora DBC, would cost the routing, the terminals' indexing and Raydium's crank that LaunchLab gives us for free, and would put every curve's liquidity in a program we must audit (section 8).
- Build two programs first, both small:
  - **Earnings** (`stoker_earnings`): the Creator's share enforced on-chain.
    Every coin's LaunchLab `creator` becomes an address our program owns, the curve's split moves from 1.00% and 0% to 0.50% and 0.50% on-chain (the trader still pays 1.25%), the program also becomes the CPMM pool creator after Graduation, and anyone can make it claim and pay: half to the Creator, half to the platform, exactly ADR 0009's rule.
    It retires the Creator Forward job once proven.
  - **Launch** (`stoker_launch`): the launch transaction's creation through our program, so the coin is registered with its Creator and its Earnings destination in the same instruction, and, next, the mint becomes an address our program derives (vanity prefixes ground for free, no mint keys held by the API), with supply locks on LaunchLab's own vesting.
- Then, in order: **Fair Open** in the launch program (a deposit window and one price for every opening buy, so nobody can buy before the crowd, the platform included), **Rewards** (the Reward Tax and the Holders and Burn destinations held and paid by a program), and **Staking** for Curated launches once the Platform Token trades and the owner has answered #118's questions (imDev2023/Stoker-Markets#118).
- Not programs: supply locks and vesting (LaunchLab has them; only our curve rules need to allow them), the 1 trillion supply (a curve-rule change, to prove at LaunchLab's maths), and vanity mints as a key pool (the launch program makes them a seed grind instead).
- Every program follows ADR 0018's safeguards: its own ADR, tests on the real Raydium programs, a verified build, a Squads multisig upgrade authority, a devnet demo through the site, and an audit before it decides where users' money goes on mainnet.

## 1. What LaunchLab lets a program of ours do

Read from LaunchLab's IDL (`packages/chain/idl/launchlab.json`, the devnet build the local chain runs) and the spike (`spike/launchlab-devnet/README.md`).
Each fact marked "to prove" is the first build ticket's spike, not a finding.

- **`initialize_v2`'s `creator` is not a signer.**
  Only `payer` and `base_mint` sign.
  So the pool's creator can be any address, a program-derived address (PDA) of ours included, without our program being in the transaction at all.
- **The Creator Fee vault is per (creator, Quote Asset).**
  With a creator PDA per coin (seeds `["creator", mint]`) each coin gets a vault of its own, so the chain itself keeps each coin's Creator Fee apart.
  `claim_creator_fee` needs the creator to sign, which a PDA does through `invoke_signed`.
- **`creator_fee_rate` can change.**
  It is not in `PlatformConfigParam`'s single-field variants, but `AllInfo(PlatformConfigInfo)` carries it beside every other field (fee wallet, NFT wallet, migrate shares, fee rate, name, web, img, transfer-fee authority, vesting scale, vesting wallet), so the cold admin key can move the split without a new PlatformConfig.
  `AllInfo` writes every field at once, so its transaction is built from the live account and checked field by field before the admin signs.
- **After Graduation the CPMM pool's creator is `platform_cp_creator`** when it is set (StonkFun and we set it to the operations wallet; `research/onchain/README.md`).
  It can be re-pointed by the admin (`PlatformCPCreator`), for example to a PDA of ours.
  The CPMM keeps each pool's creator fee in that pool's own state, so collecting one pool yields exactly one coin's fees.
  Whether an unset `platform_cp_creator` falls back to the pool's `creator` is to prove.
- **`base_mint` must sign and is created inside `initialize_v2`.**
  A PDA can sign when our program makes the call (CPI), so a coin's mint can be an address our program derives.
  Whether LaunchLab accepts its `initialize_v2` through a CPI is to prove (its trades are routed through CPI by every aggregator, so a check against CPI is unlikely but not ruled out).
- **LaunchLab has vesting of its own.**
  `VestingParams { total_locked_amount, cliff_period, unlock_period }` reserves part of the supply at creation; the creator hands shares of it to beneficiaries with `create_vesting_account`; `claim_vested_token` releases them linearly after the cliff, counted from migration.
  Our curve rules already pin `TotalLockedAmount`, `CliffPeriod` and `UnlockPeriod` to 0 (`packages/chain/src/shape.ts`), so allowing locks is a rule change, not a program.
- **A Token-2022 coin takes a transfer fee and nothing else.**
  `initialize_with_token_2022` creates the mint itself and refuses other extensions (6017 `NoSupportExtension`), so no transfer hook can gate a LaunchLab coin's transfers or trades.
- **Anyone can trade a pool from the moment it exists.**
  Nothing in LaunchLab can hold trading back, so a program can only control what happens before the pool exists and inside the instruction that creates it.
- **Supply is a `u64`.**
  1 trillion coins at 6 decimals is 1e18 raw units, under the u64 limit of about 1.8e19; whether the curve's maths stays clear of 6008 `MathOverflow` and 6023 `CalculateOverflow` at that size is to prove.

## 2. The Creator's share, paid by a program

### What it buys

Today a Creator's whole earnings depend on our `creator-forward` job and our hot operations wallet (ADR 0009, Consequences).
StonkFun's forward stopped for about three weeks (`research/social/telegram-group-insights.md` in the private research repo), and Top-pad's ADR 0003 rejected the off-chain forward for that reason.
With a program, what a Creator is owed is held by Raydium's programs and released only by ours, by rules anyone can read and anyone can trigger: enforced rather than promised.
That is also the pitch Peak cannot make: its creator share is claimed, unstated and new (`research/competitors/README.md`).

### Mechanism

- **On the curve.**
  The PlatformConfig moves from `fee_rate` 10000 and `creator_fee_rate` 0 to 5000 and 5000 (the cold admin key, an announced fee change under #22's flow).
  The trader pays the same 1.25%: 0.25% to Raydium, 0.50% Platform Fee, 0.50% Creator Fee.
  Every launch names `creator = PDA(["creator", mint])` under the earnings program, so each coin's Creator Fee accrues in its own LaunchLab vault.
  ADR 0009's rule (half of what the platform collects) becomes the on-chain split itself, and each half is still rounded on its own trade, now by LaunchLab.
- **After Graduation.**
  The admin points `platform_cp_creator` at the earnings program's pool PDA (`["pool_creator"]`).
  `collect_pool(mint)` signs the CPMM's `collect_creator_fee` for that coin's pool (with the `creator_fee_share` account the deployed CPMM wants last, a CLAUDE.md trap) and splits what arrives: half to the Creator's destination, half to the platform's fee wallet.
  The Fee Key stays the platform's, as ADR 0009 says.
- **The coin record.**
  `CoinRecord` (seeds `["coin", mint]`): the mint, the pool, the Creator's wallet, the Earnings destination (`wallet` at first; `holders` and `burn` with the Rewards program), the Graduation Fee in the Quote Asset, what has been withheld toward it, and totals paid.
  It is written by the launch program in the launch instruction (section 3), so nobody can register someone else's coin first.
- **Paying.**
  `claim_curve(mint)` and `collect_pool(mint)` are permissionless: our cron sends them, and so can the Creator or anyone else.
  Each claims into a token account the PDA owns, then pays onward in the same instruction, so nothing rests in the program between transactions (Top-pad's fee program works this way and holds nothing).
  A SOL share is unwrapped to plain SOL, and a share under the rent minimum for an empty wallet waits, as the Creator Forward does today.
- **The Graduation Fee (ADR 0015).**
  On-chain there is no price, so the conservative design prices it at launch: the launch instruction computes the fee in the Quote Asset from the Graduation Target it is launching with (85 SOL-equivalent, fixed by the API from the live price, ADR 0005), as `total_quote_fund_raising * GRADUATION_FEE_LAMPORTS / GRADUATION_TARGET_LAMPORTS`, and stores it on the record.
  The program withholds it from the Creator's half after migration until paid, never more than the coin's own earnings, exactly as ADR 0015 does today but priced at launch instead of at Graduation.
  The alternative is the operations key posting the fee at Graduation, which puts a hot key back into the Creator's money.
- **The Ledger.**
  Every claim emits an event (`emit_cpi!`); the Indexer reads those instead of the `creator_forwards` table, and the Ledger keeps its `creator_forward` entries keyed by the claim's signature.

### Costs

- Two accounts per coin: the record (about 0.0015 SOL of rent at today's rent) and the creator PDA's token account for the claim (closed after each claim, so its rent comes back).
- One claim transaction per coin per run instead of one forward per Creator per Quote Asset: more transactions for Creators with many coins, the same for most.
- An announced fee change on mainnet's PlatformConfig.
- Curve rules cannot pin `creator`, so a launch made without our program can still name any creator and take the 0.50% itself.
  That costs the platform nothing it would not pay a Creator anyway; the Indexer already ignores launches outside our shape and will also ignore any whose creator is not its PDA.

### Risks

- **Third-party "dev" figures.**
  Terminals and Raydium's own page read `pool_state.creator` as the dev wallet; with a PDA there they will show a dev holding nothing, which some read as "dev sold".
  Peak has the same shape (its own wallet is every pool's creator) and lives with it; our coin page and metadata name the Creator.
- **The program is named forever by every pool.**
  A creator PDA is derived from the program id, so the earnings program can never move to a new id; it must stay small and rarely change, which is why it is a program of its own (Top-pad's ADR 0006 made the same split).
- **An upgrade can redirect money.**
  Hence the multisig upgrade authority with a timelock, verified builds, and, eventually, making it immutable.
- **The audit gate.**
  It holds nothing at rest, but it decides where Creators' money goes; read conservatively, ADR 0018's audit rule applies before it replaces the forward on mainnet.

## 3. The launch through our program, PDA mints, locks and the 1 trillion supply

### Mechanism

`stoker_launch::launch(params)`, signed by the Creator's wallet as `payer`:

1. Checks the shape (the same constraints as our curve rules, so a launch through the program can never fail them).
2. Calls LaunchLab's `initialize_v2` (or `initialize_with_token_2022` for a Reward Launch) through CPI, with `creator` the earnings PDA and `base_mint` either the Creator-side keypair (first version, as today) or, next, a PDA of the launch program.
3. Calls `earnings::register_coin` through CPI, signed by the launch program's registrar PDA (how Top-pad's fee program knows the call came from Fair Open), writing the coin record.
4. Optionally makes the First Buy for the Creator in the same instruction, so the First Buy stays atomic (ADR 0003's launch transaction, CONTEXT.md "First Buy").
5. Optionally hands a vesting share to the Creator (LaunchLab's `create_vesting_account`, signed by the earnings PDA as the pool's creator).

### PDA mints and vanity addresses (imDev2023/Stoker-Markets#73)

- A PDA mint is `find_program_address(["mint", seed], launch_program)`, where the seed is any bytes we choose.
  Nobody holds a key for it, so the API's `MINT_KEY_SECRET` and the planned encrypted pool of vanity keys both disappear: a retry rebuilds the same address from the same seed, and nobody but our program can ever create that mint.
- Grinding a vanity seed costs a SHA-256 per try, against an ed25519 key generation per try for a keypair, and the off-curve check runs only on candidates whose prefix already matches.
  The Mac's keypair grind measured 424,000 keys a second (CLAUDE.md); a SHA-256 grind on the same 20 threads should run in the tens of millions a second, which would make the owner's `Stoker` prefix (1 in 6.6e11, about 18 days per keypair) a matter of hours per seed.
  That rate is an estimate to measure in the spike, not a finding.
- Ground seeds are not secrets: they can be ground once, kept in a table, even published.
  The one risk is griefing: anyone who knows the next mint address could send it lamports before the launch, and whether LaunchLab's mint creation tolerates a pre-funded account is to prove.
- Earlier coins keep their derived addresses, as the owner decided on imDev2023/Stoker-Markets#73 (2026-10-06), and vanity mints still wait for mainnet's launch by that decision.

### Supply locks and vesting (imDev2023/Stoker-Markets#141)

- No program needed: LaunchLab's vesting reserves the locked supply at creation and releases it after Graduation plus the cliff.
  Our curve rules widen from `TotalLockedAmount = 0` to a band, and the launch form offers it.
- What it is not: a lock of coins the Creator bought (the First Buy).
  Locking bought coins needs an escrow; Jupiter Lock's `create_vesting_escrow_v2` composed into the launch (as Top-pad's Fair Open does) is the existing audited one, and our program can make that call so the lock is part of the launch.
- The owner's anti-sniper line (imDev2023/Stoker-Markets#120, 2026-10-26: the atomic First Buy, Creator vesting and labels-only Bundle Radar, never a tax) is met by these two.

### The 1 trillion supply (imDev2023/Stoker-Markets#166)

The owner decided it on 2026-11-02.
It is a launch-shape change through the curve rules (about 1,170 rule writes on mainnet), not a program, and it touches every coin figure on the site.
The only program question is LaunchLab's maths at 1e18 base units, proven in the spike before the shape changes.

## 4. A fair launch: no bundle in the creation block without trusting the platform

### The problem

A "bundle" is the Creator's own wallets, or a sniper's, buying in the creation block, usually through a Jito bundle the Creator builds with the creation transaction.
Peak answers it with a blind launch: Peak's deployer creates the pool from a secret mint seconds later, so the trust moves from the Creator to Peak, which knows every mint first.
A LaunchLab pool can be traded by anyone from the moment it exists (section 1), so no program can stop a buy that comes after the creation; it can only control what happens before the pool exists and inside the creating instruction.

### Fair Open on LaunchLab

1. **Announce.** The Creator calls `create_fair_open(params, opens_at)`: the coin's parameters and a PDA mint are fixed, the Creator's own buy goes in like anyone's, and the window opens (Top-pad uses 10 minutes).
2. **Deposit.** Anyone deposits the Quote Asset into the launch's vault, within a per-wallet cap, and may withdraw until the window ends.
   The pool does not exist yet and the mint is a PDA only our program can create, so nobody, the platform included, can trade the coin early.
3. **Open.** After `opens_at` anyone may call `open(launch)`, which in one instruction creates the pool through CPI, registers the coin with the earnings program, and spends the vault on one buy: everyone's opening buy at one price.
   No signature of the Creator is needed at the open, because `initialize_v2` does not need the creator to sign; Top-pad needed a pre-signed durable-nonce ladder only because Meteora DBC does.
4. **Settle.** Coins are pushed pro rata to depositors by a crank (and claimable by anyone who prefers), and what a cap or the Graduation Target leaves unspent is refunded.
   If the open never happens (the window passes without enough deposits, or the creation fails), everyone withdraws with no server involved.

What that gives: the first buy in the creation block is the crowd's, at one price for all, and anyone buying in the same block afterwards pays the post-crowd price, so a bundle earns nothing over the crowd.
What it does not give: one person with many wallets can still take a larger share of the crowd; a per-wallet cap only raises the cost, and Top-pad's answer is a server-signed admission per person, which puts the platform back in the trust path for admission only.
The conservative default is the cap alone, with admission left to the owner.

### Costs and risks

- The vault holds users' deposits: ADR 0018's audit rule applies before mainnet without any doubt.
- The open transaction must fit 1,232 bytes and the compute limit: Top-pad's DBC creation with its pot buy took 1,093 bytes and 292,000 compute units; LaunchLab's launch with a First Buy already needs the Platform Lookup Table (CLAUDE.md), and a PDA mint removes one signature (64 bytes).
  To measure in the build ticket.
- A second launch mode on the form and a new state on the coin page ("Opens in").
- **Product overlap with Top-pad.**
  Fair Open is Top-pad's (Heat's) core product, and its ADR 0001 keeps "Fair Open as a launch mode inside Stoker" as an option to re-weigh after its devnet cohort.
  Building it here is the owner's decision; this note orders it after the earnings and launch programs so that decision can wait for Heat's cohort.

### Rejected

- **A secret mint and a platform deployer (Peak):** moves the trust to us.
- **A mint derived from the slot hash at execution:** raises a bundler's cost (a buy must name the mint in advance) but a bundler watching slots can still predict it; not a guarantee.
- **A decaying anti-sniper fee (Meteora DBC's fee scheduler):** not available on LaunchLab, and the owner ruled out a tax (2026-10-26).

## 5. The Earnings destination and holder rewards as a program

### The destinations (imDev2023/Stoker-Markets#113)

The Creator picks at launch, never to change (owner, 2026-10-25): their wallet, a dividend to holders, or buyback and burn, which buys on the curve too (owner, 2026-10-25, "like Pons").
The earnings program stores the destination on the coin record (section 2) and pays `wallet` itself; `holders` and `burn` go through the Rewards program:

- **Burn.** `buyback(mint)`, permissionless, buys the coin with the Creator's share on its own market (LaunchLab's `buy_exact_in` on the curve, the CPMM's swap after Graduation) and burns the coins in the same instruction.
  A buy anyone can trigger can be sandwiched, so each buy is a small slice with a slippage bound from the market's own state (the CPMM's observation account after Graduation, the curve's reserves before), as the Reward Engine's sales are bounded today (ADR 0006: 0.5% of the reserve, 1% slippage).
  A coin paired with a Quote Asset other than the share's needs no route: the Creator's share is already in the coin's Quote Asset.
- **Holders.** The share goes into the coin's reward vault and is paid like a Reward Round (below).

### Reward Launches and Holder Rewards

- Today the operations wallet is the Reward Tax's withdraw authority from launch and its fee-config authority after migration, revoked by the `reward-tax-lock` job (ADR 0006).
- With the PlatformConfig's `transfer_fee_extension_auth` pointed at a Rewards PDA (one admin change), the program holds both: `lock_tax(mint)` revokes the fee-config authority after Graduation for anyone who calls it, and `harvest(mint)` withdraws the withheld tax into the coin's reward vault.
  The hot wallet no longer holds the holders' money between rounds.
- **Paying a round.**
  A program cannot see every holder's balance at a moment, so the snapshot stays off-chain: the Reward Engine computes it as today and posts the round's Merkle root with its total.
  The root waits a challenge period (a day, like the rules' lead time) during which anyone can recompute it from the chain; then `pay(round, leaf, proof)`, permissionless, pays each holder from the vault, so holders still receive without claiming, and the program refuses any payment the root does not hold or that would exceed the round's total.
  The alternative that needs no snapshot is staking (holders deposit coins and a per-share accumulator pays them), which is fully on-chain but asks every holder to act; imDev2023/Stoker-Markets#113 proposes "no staking ... holders are paid by balance", so the Merkle design follows it.
- **A Quote Asset Payout (#43).**
  The Reward Sales stay as ADR 0006 bounds them, made by the program from the vault instead of the operations wallet.

### Costs and risks

- The vault holds holders' money: audit before mainnet.
- A posted root can still be wrong; the challenge period, the published snapshot and the round's total cap bound the damage, but this is accountable, not trustless, and the note says so.
- More transactions than today's batched payouts: one leaf per holder per round, the same count as now.

## 6. Curated launches bought by STOKER stakers (imDev2023/Stoker-Markets#118)

The owner (2026-10-25): only people who stake STOKER can buy a Curated launch, with an allocation in proportion to their stake.
The issue's five questions are all open: what "stake" means, how the allocation is enforced, the formula, what "approved" means and where the revenue goes.

With programs allowed, the answer is a short one:

- **Staking** (`stoker_stake`): STOKER locked for a chosen period in a PDA vault; a stake account per wallet records the amount and the unlock time; nothing is paid for staking unless the owner adds it.
- **The Curated sale is a Fair Open whose deposits are capped by stake.**
  `deposit` reads the depositor's stake account (its amount at the window's opening, so stake added during the window does not count) and caps the deposit at `stake / total_stake * sale_size`; the open is the same one-price creation as section 4, so the allocation is enforced on-chain and the coin cannot be bought before the stakers' buy.
- It needs the Platform Token to exist and trade (go-live), the owner's answers to #118's questions, and Fair Open; it is last in the order for those reasons.
- An existing audited staking program (Jupiter Lock as the lock, for example) could replace `stoker_stake` if the sale only needs a provable lock; that is the build ticket's first question.

## 7. What Top-pad already built that applies

Top-pad (product name Heat since 2026-10-28) runs on Meteora DBC and DAMM v2, so its CPI targets and account offsets do not carry over; its patterns do.
It stays a separate product (its ADR 0001), and nothing below is copied in without the owner's decision.

- **Two programs, split by how often they change** (its ADR 0006): a fee program named forever by every DBC config, small and rarely upgraded, and Fair Open, which keeps changing.
  Our earnings and launch programs make the same split for the same reason (section 2, Risks).
- **The fee program** (`programs/fee`, 1,429 lines): its PDA is the DBC partner; `claim_fees` is permissionless and pays 50/50 to the Creator and the treasury in two CPIs, nothing at rest; config updates are gated on the program's own upgrade authority (read from `ProgramData`); registration is accepted only from Fair Open's registrar PDA.
  That is our earnings program's shape.
- **Fair Open** (`programs/fair_open`, about 3,400 lines): a 10-minute SOL deposit window, an Ed25519 admission co-signature per deposit, per-step deposit counts instead of a seat list, an equal-level allocation matched to a TypeScript reference to the lamport, a vault-solvency check after every change and a fuzz test of it, pushes of 7 seats per transaction, a creator lock through Jupiter Lock, and a failure path that needs no server.
  Our Fair Open would be simpler at the open (no durable-nonce ladder, section 4) and the same everywhere else.
- **Bundle Radar** (off-chain): same-slot buys, positions 1 to 4 after the creation, Jito bundle membership and funding links to the Creator within 7 days; a case opens when linked wallets bought 1% of supply.
  Our trust figures (ADR 0013) deferred the funder graph; Bundle Radar is the model for it and needs no program.
- **Vamp Shield** (off-chain): copy checks against a protected set built from Jupiter's lists, CoinGecko's top 1,000 and Heat's coins, with perceptual image hashes; our Copy Protection (ADR 0012) covers our own coins only.
  Also no program.
- **Its tests:** the Rust `litesvm` crate (0.10.0), 134 tests, stand-ins for DBC, DAMM v2 and Jupiter Lock at their real addresses, because Meteora asked that its binaries never be dumped.
  We are better placed: the Raydium devnet programs are already committed fixtures (`tools/localnet/fixtures/programs`), so our program tests run against the real LaunchLab, CPMM and lock programs.
- **Its traps worth keeping:** build through one script, never a bare `anchor build` (Anchor 1.2.1 defaults to SBPF v3, which devnet and mainnet had not activated on 2026-10-27, so it forces v2); never run `anchor keys sync` on a fresh checkout; a program that moves lamports by hand must let the next CPI carry both accounts or the runtime refuses it as `UnbalancedInstruction`; a transaction holds at most 64 accounts' worth of instructions and LiteSVM panics past 38 static accounts; never hard-code rent (a token account's fell from 2,039,280 to 1,488,440 lamports in late 2026).
- **Its deploy costs:** programs of 410 KB and 652 KB on devnet, about 5 SOL of rent per MB (409,664 bytes cost 2.08 SOL), plus a temporary buffer during each deploy and about 0.3 to 0.7 SOL for each extension.

## 8. Our own bonding curve and migration, against staying on LaunchLab

| | LaunchLab (today) | Meteora DBC | Our own curve |
| --- | --- | --- | --- |
| Pair with any asset | Any GlobalConfig Raydium created (647 on mainnet in early November 2026) | Any SPL quote; a Token-2022 quote (every xStock) needs a Meteora TokenBadge | Anything |
| Graduation | Raydium's crank migrates within seconds, our platform included (proven on devnet) | Meteora's keepers migrate SOL, USDC and stock pairs over 750 USD; anything else needs our own keeper | Our own migration and keeper |
| Routing and terminals | Jupiter routes LaunchLab curves; terminals index them | Routed and indexed | Neither until each integrates us: the curve is invisible to aggregators and terminals before Graduation |
| Fees | 0.25% to Raydium on the curve; 5% of the pool's creator fee at collection | Meteora's protocol share | Ours entirely |
| Anti-sniper | None built in | A decaying fee (ruled out by the owner: never a tax) | Whatever we build |
| Creator split | Creator Fee per (creator, Quote Asset); a PDA creator makes it per coin | Native creator share | Ours |
| Supply | u64, our rules pin the shape | Fixed or not, 6 to 9 decimals | Anything |
| Audit | Raydium's | Meteora's | Ours, over every curve's liquidity |

- The 0.25% Raydium keeps on the curve is what the routing, the terminals, the crank and Raydium's audits cost; at StonkFun's scale that trade is worth it, and the 1 trillion supply does not need a curve of our own (section 3).
- Meteora DBC's real advantages are the transfer-hook pools and the fee scheduler; the second is ruled out, and the first is not needed by any candidate here.
- Recommendation: stay on LaunchLab; ADR 0018 already says it stays the venue until an accepted ADR says otherwise, and nothing here argues for such an ADR.

## 9. The toolchain for this repository

- **Anchor 1.2.1**, pinned in `Anchor.toml`'s `[toolchain]` (Top-pad's; avm on this Mac has 0.31.1 as the default and 1.2.1 installed).
  The IDL format is the one our TypeScript already reads with `@coral-xyz/anchor`'s coder (0.32.1 in `packages/chain`), so our programs' IDLs go into `packages/chain/idl/` beside Raydium's and the API builds their instructions the same way (ADR 0003: never in the web app).
- **Rust 1.89.0** in `rust-toolchain.toml` with rustfmt and clippy; **Agave CLI 3.1.x** in CI (this Mac has 2.2.20); **SBPF v2** forced until mainnet activates v3; the release profile with `overflow-checks`, fat LTO and one codegen unit.
- **Workspace:** `programs/earnings`, `programs/launch`, later `programs/rewards` and `programs/stake`, in a Cargo workspace at the root, built by one script (`pnpm programs`) that builds, copies the IDLs into `packages/chain/idl/` and fails if they differ from the committed ones.
- **Tests, two layers:**
  - The Rust `litesvm` crate for each program, loading our built `.so` files and Raydium's committed devnet binaries (LaunchLab, CPMM, LP lock, Metaplex) with the accounts from `tools/localnet/fixtures` (the SOL GlobalConfig with the migrate wallet patched, mainnet's 1% CPMM config at its devnet address), so every CPI is tested against the real program, unlike Top-pad's stand-ins.
  - The existing black-box backend suite on the local chain: `tools/localnet` loads our programs at their ids as it loads Raydium's, and the API's flows are proven through HTTP as now.
- **CI:** a `programs` job (fmt, clippy with warnings as errors, the build, the IDL diff, `cargo test`), beside `check` and `backend`; the backend job builds the programs first or downloads the job's artifact.
- **Verified builds:** `solana-verify build` in a clean clone and `solana-verify verify-from-repo` after each deploy, recorded on-chain (installed here: 0.4.9; Top-pad used 0.5.2).
- **Keys:** each program's keypair (its address) lives outside the repo, under `~/.config/new-stoker/` on the owner's Mac (never `~/.config/stoker/`, which belongs to the original), like the platform's keys.
- **Upgrade authority:** a file key on devnet; on mainnet a Squads multisig with a timelock (Top-pad plans 7 days), held like the platform's cold keys (ADR 0004).
  Each program's config is changed by its upgrade authority (read from `ProgramData`, Top-pad's pattern), so there is one cold key per program and no hot admin.
  The earnings program, named forever by every pool, is a candidate for immutability once stable.
- **Deploys:** devnet only, by sessions, once #15 has set up the rebuild's devnet; mainnet is the owner's.
  Budget about 5 SOL of rent per MB of program, plus the deploy buffer (devnet SOL is free but rate-limited; CLAUDE.md, Traps).
- **Audits:** ADR 0018 leaves the auditor and the budget to the owner.
  No quote was requested (relay sessions make no paid calls).
  The scope would be the earnings program (small, no funds at rest) and, before each reaches mainnet, Fair Open's vault and the rewards vault.

## 10. The order and the build tickets

Filed on 2026-11-09, when the owner accepted ADR 0019, as #40 to #45, sub-issues of the map.
Lane `programs` runs them in order, each blocked by the one before, except that Rewards (#44) is blocked by #42 rather than by Fair Open (#43): it depends on the launch program, not on Fair Open, so it goes first while Fair Open waits on the owner.

1. **Programs workspace and the LaunchLab spike** (#40).
   The workspace, the build script, the LiteSVM harness on Raydium's committed binaries, the CI job, and an empty program deployed on the local chain through `tools/localnet`.
   The spike proves, with tests: `initialize_v2` through CPI from our program; a PDA as `creator` and its own Creator Fee vault, claimed through `invoke_signed`; a PDA as `base_mint` (and whether a pre-funded mint address breaks it); `platform_cp_creator` as a PDA and `collect_creator_fee` signed by it after a migration; `AllInfo` moving `creator_fee_rate` on our PlatformConfig; LaunchLab's maths at a 1e18 supply; the launch transaction's size and compute through the program; the vanity seed grind's rate on this Mac.
   Its outcome decides whether ticket 2 is built as written.
2. **The earnings program and the launch through it** (#41).
   `stoker_earnings` (coin records, `claim_curve`, `collect_pool`, the split, the wallet destination, the Graduation Fee priced at launch, events) and the first `stoker_launch` (creation through CPI with the earnings PDA as creator, registration, the First Buy), the API's launch and the Indexer moved to them, the backend suite proving a Creator paid on the curve and after Graduation with no forward job, and its own ADR amending ADR 0009 and ADR 0015.
   The Creator's share is a setting of each coin's record, 50% at launch, never a constant (owner, 2026-11-09), so imDev2023/Stoker-Markets#188's Creator ladder can come later without a new program.
   The Creator Forward keeps running for coins launched before, and the fee change on mainnet's PlatformConfig waits for the audit and the owner.
3. **PDA mints, vanity seeds and supply locks** (#42).
   The launch program derives mints from seeds, the API drops `MINT_KEY_SECRET` for new coins, a seed grinder and its table (vanity prefixes after go-live, by the owner's decision on imDev2023/Stoker-Markets#73), and LaunchLab vesting allowed by the curve rules with the form's lock option (imDev2023/Stoker-Markets#141).
4. **Fair Open** (#43).
   A launch mode with a deposit window, one-price opening buy, pro-rata settlement and the failure path, after the owner decides on the overlap with Top-pad.
5. **Rewards** (#44).
   The Reward Tax authority on a PDA, `lock_tax` and `harvest`, Merkle rounds with a challenge period and permissionless payment, the Holders and Burn destinations of imDev2023/Stoker-Markets#113, and the retirement of the `reward-tax-lock` job and the operations wallet's custody of the tax.
6. **Staking and Curated** (#45).
   After go-live and the owner's answers on imDev2023/Stoker-Markets#118.

Not proposed: a curve or migration of our own, a move to Meteora DBC, a vesting program, a transfer-hook coin.

## 11. The owner's answers (2026-11-09)

The owner accepted ADR 0019 as proposed on 2026-11-09; each question below keeps its proposed answer.

1. The two first programs and the order above: accepted.
2. The audit: the earnings program decides where Creators' money goes, so it is audited before mainnet under ADR 0018's rule; the auditor and the budget are still the owner's to choose.
3. The curve split on-chain (0.50% Platform Fee, 0.50% Creator Fee): yes, through an announced fee change on mainnet's PlatformConfig once ticket 2 is proven and audited, applied by the cold admin key on the owner's go.
   The owner added that the Creator's share is a per-coin setting, never a constant, so the Creator ladder the original proposed the same day (imDev2023/Stoker-Markets#188: 50% on the curve, 60% after Graduation, 70% for coins that last) can come later without a new program.
4. The Graduation Fee is priced at launch from the Graduation Target.
5. Fair Open given Heat (Top-pad's ADR 0001, option C): still open; #43 waits for it and the relay skips that ticket meanwhile.
6. Holder rewards by Merkle root with a challenge period.

## Sources

- LaunchLab, CPMM and lock IDLs: `packages/chain/idl/` (the devnet builds, identical to mainnet's but for `collect_excess_lamports`).
- `spike/launchlab-devnet/README.md`, `research/onchain/README.md`, `research/competitors/README.md`, ADRs 0003 to 0006, 0009, 0012, 0013, 0015 and 0018.
- imDev2023/Stoker-Markets#73, #113, #118, #120, #141, #144 and #166, read only.
- `/Volumes/Farhan/Work Folder/Dev/AI/Top-pad`: `programs/fee`, `programs/fair_open`, its ADRs 0001 to 0006, its CLAUDE.md and CI, read only.
- The owner's Jupiter and Meteora knowledge base, `meteora/03-dev-dbc-vaults-launch.md`, for Meteora DBC.
- No web search or paid service was used.
