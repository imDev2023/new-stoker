# 0018: Programs of our own are allowed

Status: accepted for its scope (owner, 2026-11-04); the safeguards under Decision are proposed and stand until the owner changes them.

## Context

Stoker was built with no program of its own: a LaunchLab `PlatformConfig`, Raydium's CPMM for graduated pools, and a Cloudflare backend that does off-chain what those programs cannot (the Creator Forward, Reward Rounds, the Burn, Copy Protection).
On 2026-11-04 the owner lifted that limit for this rebuild: "There's no limit of writing a program or modifying the contracts to improve our launchpad and implement new ideas. We can write as much custom code, programs, whatever is needed to succeed."

## Decision

- Programs of our own are in scope wherever they make the launchpad more trustworthy, fairer or better for Creators and holders.
- LaunchLab stays the launch venue until an accepted ADR says otherwise.
- Which programs, and in what order, is decided by the programs research ticket's ADR, which the owner accepts before any program is built.
- Proposed safeguards:
  - Every program ships with its own ADR.
  - Its tests run it on the local chain beside the Raydium programs.
  - Its build is verified and reproducible.
  - Its upgrade authority is held like the platform's other cold keys (ADR 0004), never a hot key.
  - Its demo runs on devnet through the site.
  - No program holds users' funds on mainnet before an independent audit, whose auditor and budget the owner chooses.

## Consequences

- The repository gains a Rust and Anchor workspace (`programs/`), CI for it, and its toolchain in CLAUDE.md's Run and test section.
  The owner's Top-pad (`/Volumes/Farhan/Work Folder/Dev/AI/Top-pad`) builds two Anchor programs with LiteSVM tests and stand-ins for the programs it calls, and is the working example of that setup.
- ADR 0003's rule stands: the web app never imports the chain package, the Raydium SDK or Anchor, and transactions are built by the API.
- An off-chain mechanism a program replaces (the Creator Forward is the first candidate) keeps running until the program is live and proven, and is then retired by its own ADR's amendment.
