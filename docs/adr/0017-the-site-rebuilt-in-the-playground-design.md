# 0017: The site rebuilt from scratch in the Playground's design

Status: accepted (owner, 2026-11-04).

## Context

On 2026-11-04 the owner found the production site too full of information and not minimal, and liked their own redesign in `imDev2023/Playground-for-stoker`.
That redesign is every public page as static HTML and vanilla JS on a fixture in the API's shapes: ivory and ink with one gold accent, Instrument Serif for statements, Instrument Sans for anything read or acted on, JetBrains Mono, hairlines instead of cards, black buttons and a 1120px shell.
The same day the owner asked for the whole website to be rebuilt from scratch in that design, in a new repository, so that the original (`imDev2023/Stoker-Markets`) stays as the fallback.

## Decision

- The Playground is the spec for the look and the structure of every public page.
  Its source at `e9a059f` is vendored in `docs/design/playground/`; its rules are that folder's `AGENTS.md` and its design notes the end of its `README.md`.
- Its two rules are the site's rules.
  No taglines, helper text or secondary labels: if a section needs one to make sense, its layout changes instead.
  Every live part starts hidden and is shown only once a real, non-zero value arrives: never a zero, a placeholder or an error.
- The original's rule of 2026-10-07 stands beside them: a control (search, sort, the asset chips, a form's fields) is never hidden behind an empty state.
  Only figures and data wait for real values.
- `apps/web` is rebuilt from scratch: new components and new styles.
  It stays Next.js on OpenNext and a pure client of the API (ADR 0003), so the wallet, the signing flow, Privy's sign-in, the share previews and the UI suite's machinery carry over.
  A non-visual module of the old app (the API client, the formats, the wallet bridge, the legal constants) comes over only after it has been read line by line; the old tree is read from the history (`git show 12dbc10:apps/web/...`), never imported.
- What the Playground keeps from production stands: the slogan, the heating ring mark, "Stoke a coin", "coin" never "token", light and dark following the visitor, and the legal, fee and risk wording.
  The production verdicts it does not address stand too until the owner retires them: the scheme toggle, the welcome disclaimer, the region gate and every content rule in CLAUDE.md's Settled section.
- What it retires: Teal and its hue fix, the Cobalt and Violet alternates, T3 Bricolage, the floating pill header, the green launch button, and the layouts the rework phases built.
- Its one departure from production, the launch summary showing where $1,000 of curve trading goes, waits on the owner.
  Until the owner decides, production's rule holds and every fee figure stays on `/fees`.

## Consequences

- The site's pixel baselines start again: each page's ticket adds its own.
- The Stocks pages read three things the API does not serve yet (`change24h` and `market.last` on a Quote Asset, and a Quote Asset's candles); until the API serves them, the parts they feed stay hidden, as the spec says.
- `docs/design/principles.md` and `docs/design/layout.md` describe the original's design and stay for their history; the foundation ticket writes the rebuilt site's principles.
