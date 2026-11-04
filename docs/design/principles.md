# The rebuilt site's principles

The site is rebuilt from scratch in the Playground's design ([ADR 0017](../adr/0017-the-site-rebuilt-in-the-playground-design.md)).
The spec is `docs/design/playground/`: its pages, its stylesheet and its rules (`AGENTS.md`, and the design notes at the end of its `README.md`).
This file is what every page of `apps/web` holds to; the original's principles and layout notes are in `docs/design/history/`.

## The two rules

1. No taglines, helper text or secondary labels.
   If a section needs one to make sense, its layout changes instead.
2. Every live part starts hidden and is shown only once a real, non-zero value arrives.
   Never a zero, a placeholder or an error.

Beside them stands the original's rule of 2026-10-07: a control (search, sort, the asset chips, a form's fields) is never hidden behind an empty state.
Only figures and data wait for real values.

## One shared layer

`apps/web/src/app/globals.css` holds the tokens, the base and the primitives every page composes: `.button` (with `-ghost`, `-lg`, `-block`), `.arrow`, `.link`, `.panel`, `.pad`, `.chip`, `.chip-pick`, `.badge` (with `-gold`, `-warn`), `.tile`, `.progress`, `.seg`, `.field`, `.input`, `.amount`, `.search`, `.table`, `.kv`, `.figures`, `.page-head`, `.section`, `.section-head`, `.toolbar`, `.doc`, `.prose` and `.dialog`.
Reuse a primitive before adding a class.
A page's or a component's own pieces live in its CSS module, which sets type, radius, shadow, motion and colour only through the tokens: `apps/web/scripts/type.mjs` fails the lint on any literal font size, radius, shadow, duration or colour in a module.
`globals.css` stays the root layout's first import, so a module wins a tied selector against a primitive.

## Colour

Ivory and ink, hairlines instead of boxes, and one accent, gold.
The brand's heat (the amber-to-ember ramp) is kept for the mark and for what a Creator earns.
Every colour is a token set for light and for dark; dark follows the visitor's system until they choose in the account menu, and the choice is the `scheme` cookie the root layout writes onto `<html>` as `data-theme`.
The dark block is therefore written twice (under the media query, and pinned by `data-theme="dark"`), and `apps/web/scripts/contrast.mjs` fails the lint if the two copies differ.

The contrast floors are production's: WCAG AA (4.5:1) for every text role on every ground it sits on, and APCA Lc 75 for body text (`--ink`, `--ink-2`), Lc 60 for the smaller text people must read and for figures (`--ink-3`, `--gold`, `--up`, `--down`, the badges), 3:1 and Lc 45 for a glyph on a fill (a coin's monogram on the heat tile), and Lc 15 for a light hairline.
The spec's palette missed some of them, so these tokens were moved in lightness alone, hue and chroma kept (OKLCH), by the smallest step that passes:

| Token | Scheme | The spec | Here | Why |
| --- | --- | --- | --- | --- |
| `--ink-2` | light | `#5f5b52` | `#58544b` | Lc 72 on `--sunken` |
| `--ink-3` | light | `#8a857a` | `#746f65` | 3.3:1 on `--paper` |
| `--gold` | light | `#9a6a24` | `#8f6017` | 4.3:1 on `--paper`, 4.2:1 in its own badge |
| `--line` | light | 11% ink | 14% ink | Lc 11 to 13 |
| `--ink-2` | dark | `#a8a399` | `#d1ccc2` | Lc 52 |
| `--ink-3` | dark | `#78746b` | `#b7b2a9` | Lc 29, 4.2:1 |
| `--gold` | dark | `#d6a95c` | `#deb164` | Lc 58 in its own badge |
| `--up` | dark | `#5cc28b` | `#60c68f` | Lc 59 on `--surface` |
| `--down` | dark | `#e2725f` | `#ff9d88` | Lc 44 |

Every other colour is the spec's own.

## Type

Instrument Serif for statements, Instrument Sans for anything read or acted on, JetBrains Mono for code and addresses, all served by the app through `next/font`; tabular figures throughout.
A module takes its type from the roles in `globals.css`, never a literal size:

| Role | Use |
| --- | --- |
| `--font-display` | The home page's headline |
| `--font-h1` | A page's one title |
| `--font-title` | A section title on the home page (`h2.title`) |
| `--font-statement` | A band's one sentence |
| `--font-figure` | A large figure (`.figures`) |
| `--font-lead` | A lead paragraph in the serif |
| `--font-doc-heading` | A document's section (`.prose h2`) |
| `--font-section` | A section head (`.section-head h2`), a dialog's title |
| `--font-heading`, `--font-subheading` | A card's or a step's name |
| `--font-brand` | The lockup |
| `--font-label` | A bold label in the sans (`h3`) |
| `--font-coin`, `--font-price` | A coin page's pair, its title, and its price beside it |
| `--font-stat` | A figure in a row of small ones (a chart's market cap and volume) |
| `--font-pair` | The home page's pair, in its pill under the headline |
| `--font-control` | Buttons |
| `--font-code` | Code |
| `--text-micro` to `--text-lede` | The sans steps: 12, 13, 14, 15, 16, 17 and 18px |
| `--text-tiny` | 10px, an asset's monogram on its 16px badge alone |

## Shape and motion

A 1120px shell with a gutter of 16 to 40px, a 64px bar, radii from `--radius-xs` (6px) to `--radius-xl` (22px) and `--radius-pill`, three durations (`--dur-fast`, `--dur`, `--dur-slow`) on one easing, one cycle for a piece that loops (`--dur-cycle`, the home page's pair roll, held still under reduced motion), and three elevations (`--shadow`, `--shadow-control`, `--shadow-overlay`).
Reduced motion stops every transition outright.

## The shell

- The header: the ring and the name, the eight sections (Explore, Stocks, Swap, Assets, Rewards, Stats, Curated, Developers), the wallet and "Stoke a coin", the one filled button.
  A detail page marks its list's section, and Burns marks Stats.
- Under 900px the sections move to the phone bar at the window's foot, the first five of them, and the header turns opaque.
  Between 901px and 1040px the header shows the first six: the spec's eight and the two actions need about 1017px and overflowed the window there.
- The pulse strip under the header on every page but home: the day's volume, the coins and the graduated count from `GET /v1/stats`, each only once it is real, and the strip only when one is.
- The footer: the lockup, four groups (Trade, Create, Records, Legal) and the risk sentence every page ends with.
- The account menu holds the wallets, Disconnect, "Your earnings" for a wallet that has launched a coin, and the light-or-dark toggle.
- The welcome on a first visit, accepted once per browser; it blocks nothing.

## What stands from production

The slogan, the heating ring, "Stoke a coin", "coin" never "token", light and dark following the visitor, the welcome, the region gate, Copy Protection, the fee model, every fee figure on `/fees` alone, and the legal, fee and risk wording, which the pages keep word for word.
