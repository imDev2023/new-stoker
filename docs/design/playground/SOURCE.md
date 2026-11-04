# The Playground, vendored

This folder is the source of `imDev2023/Playground-for-stoker` at `e9a059f` (branch `claude/stoker-landing-redesign-ebs5tf`, 2026-11-03, "Add Stocks: tokenized stocks traded around the clock"), copied on 2026-11-04 as the spec for the rebuilt site (ADR 0017).
Its own `README.md` and `AGENTS.md` are kept as they were; read them first.
Its `AGENTS.md` speaks of the Playground repository itself (its `dist/`, its `check.mjs`); here it is read as the spec's rules, and this repository's code follows CLAUDE.md.

One change was made in this copy.
`build.mjs` and `check.mjs` found their folder with `new URL(".", import.meta.url).pathname`, which keeps `%20` for the space in `Work Folder`, and `build.mjs` compared its own URL with `process.argv[1]`, which never matched under that space.
Both now use `fileURLToPath`, so they run from this folder.

To look at the spec: `node build.mjs` here, then `cd dist && python3 -m http.server 8000` and open `http://localhost:8000/?api=fixture` (`dist/` is ignored).
If the owner keeps working in the Playground, its later commits are a newer spec: diff them against this copy and bring them in with a commit that names the Playground commit it copies.
