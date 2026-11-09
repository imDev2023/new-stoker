# 0019: Which programs of our own, and in what order

Status: accepted (owner, 2026-11-09; proposed 2026-11-04, ticket #4).
Its six tickets are #40 to #45, and the owner's answers to the research's questions are in `docs/research/programs.md` section 11.
The research behind it is `docs/research/programs.md`.

## Context

ADR 0018 allows programs of our own and leaves which ones, and in what order, to this ADR.
LaunchLab leaves a program room in four places: a pool's `creator` need not sign its creation, so it can be an address our program owns; the Creator Fee vault is kept per creator and Quote Asset, so a creator address per coin keeps each coin's fees apart; `creator_fee_rate` and `platform_cp_creator` can be changed by the cold admin key; and a coin's mint can be an address our program derives, when our program makes the creation call.
Nothing in LaunchLab can hold trading back once a pool exists, and its coins take no transfer hook.

## Decision

- **The venue stays LaunchLab and Raydium's CPMM.**
  Neither a curve of our own nor Meteora DBC is built: both would cost the routing, the terminals' indexing and Raydium's crank, and a curve of our own would hold every curve's liquidity in a program we would have to audit.
- **The programs, in this order, each a build ticket of lane `programs` with its own ADR (ADR 0018):**
  1. A workspace (`programs/`, Anchor 1.2.1, Rust 1.89, SBPF v2, LiteSVM tests on Raydium's committed devnet binaries, a CI job, verified builds) and a spike that proves on the real programs what the next tickets rely on.
  2. `stoker_earnings` and the first `stoker_launch`.
     Every coin's LaunchLab creator is a PDA of the earnings program, the curve's split becomes 0.50% Platform Fee and 0.50% Creator Fee on-chain (the trader still pays 1.25%), the earnings program is the CPMM pool creator after Graduation, and permissionless claims pay half of what the platform collects to the Creator, as ADR 0009 rules, with the Graduation Fee priced at launch from the Graduation Target.
     The launch program creates the pool through CPI and registers the coin with its Creator in the same instruction.
     The Creator's share is a setting of each coin's record that every claim reads, 50% at launch, never a constant in the program (owner, 2026-11-09), so a ladder such as the original's proposed one (imDev2023/Stoker-Markets#188) can change it later without a new program; who may change it, and when, is that ticket's ADR to propose.
     The Creator Forward is retired for coins launched through it once it is proven on devnet and audited.
  3. PDA mints in the launch program (vanity prefixes by seed grinding, no mint keys held by the API) and supply locks on LaunchLab's own vesting.
  4. Fair Open in the launch program: a deposit window, one price for every opening buy, pro-rata settlement, refunds with no server; built only after the owner decides on the overlap with Top-pad's product.
  5. `stoker_rewards`: the Reward Tax authority held by a PDA, Holder Rewards by Merkle root with a challenge period and permissionless payment, and the Holders and Burn Earnings destinations.
  6. `stoker_stake` and Curated sales capped by stake, after go-live and the owner's answers on Curated.
- **Not programs:** vesting (LaunchLab's), the 1 trillion supply (a curve-rule change), Bundle Radar and copy checks (off-chain, as Top-pad's are).
- **Keys:** each program's upgrade authority is a file key on devnet and a Squads multisig with a timelock on mainnet, held like the platform's cold keys (ADR 0004); a program's config is changed by its upgrade authority and by nothing hot.
- **The earnings program stays small and rarely changes**, because every pool names its PDAs forever; it may become immutable once stable.

## Considered Options

- **Keep everything off-chain** (ADR 0009's Creator Forward): a Creator's earnings depend on our job and hot wallet, as StonkFun's did when its forward stopped for three weeks.
- **One program for everything:** simpler to deploy, but every change to the launch flow would upgrade the program every pool's fees depend on (Top-pad's ADR 0006 split its programs for the same reason).
- **The Creator's wallet as LaunchLab creator with an on-chain Creator Fee** (ADR 0007's direction): enforced, but leaves no room for the Earnings destination, the Graduation Fee or the pool's split, and puts each Creator's coins in one vault per Quote Asset.
- **A blind launch by a platform deployer** (Peak's): moves the trust from the Creator to us.
- **A curve of our own or Meteora DBC:** see Decision.

## Consequences

- The repository gains a Rust workspace, a CI job and the toolchain in CLAUDE.md's Run and test section (ADR 0018).
- ADR 0009 and ADR 0015 are amended by ticket 2's ADR; ADR 0006's custody of the Reward Tax by ticket 5's.
- Third-party terminals will show a PDA as each new coin's creator; the coin page and the metadata name the Creator.
- The "no custom program" line proposed for the trust page (imDev2023/Stoker-Markets#144) becomes "Raydium's audited programs plus ours, verified and audited", once that is true.
- Any program that holds or routes users' money waits for its audit before mainnet (ADR 0018); the owner chooses the auditor and the budget.
