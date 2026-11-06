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

The look is E Furnace, the owner's pick on #26 (2026-11-06, "good for now"), which replaced the Playground's ivory page and serif because the rebuild read like Peak's site (launchonpeak.fun).
A sage page in near-black ink, hairlines instead of boxes, and one accent, gold.
The band, the dark of the mark's tile, carries the header, the pulse strip, the home page's hero and figures, the invitation, the footer and the phone bar, in both schemes, and the ring glows on it.
The heat (the amber-to-ember ramp) is the ring's alone (`Ring.tsx`, `--ring`, and the trust list's rings and the glows that echo it); everything else the heat painted ("You do.", the Creator's half on Home, a curve's progress, a coin's letter tile) takes the gold ramp `--heat-from` to `--heat-to`.
Every colour is a token set for light and for dark; dark follows the visitor's system until they choose in the account menu, and the choice is the `scheme` cookie the root layout writes onto `<html>` as `data-theme`.
The dark block is therefore written twice (under the media query, and pinned by `data-theme="dark"`), and `apps/web/scripts/contrast.mjs` fails the lint if the two copies differ.

A piece on the band takes the class `.on-band`, which re-sets the page's tokens inside it (`--paper` to `--band`, `--surface` and `--sunken` to `--band-raised`, the inks to `--on-band` and `--on-band-2`, the lines, the button, the gold and the heat ramp to the band's own), so every primitive works on it unchanged.
A token computed from others (`--heat`, `--rule`) is computed where it is declared, so `.on-band` declares it again; a new derived token must be added there too.
`.bleed` carries a band in the shell's column out to the window's edges (a `100vmax` shadow, clipped a pixel over above and below so two bands never show a seam).

The contrast floors are production's: WCAG AA (4.5:1) for every text role on every ground it sits on, and APCA Lc 75 for body text (`--ink`, `--ink-2`), Lc 60 for the smaller text people must read and for figures (`--ink-3`, `--gold`, `--up`, `--down`, the badges), 3:1 and Lc 45 for a glyph on a fill (a coin's monogram on the gold tile) and for "You do." in the band's gold at a headline's size, and Lc 15 for a light hairline.
`contrast.mjs` holds the page's roles in both schemes and the band's (`BAND_PAIRS`) in both.

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--paper` | `#eef1ea` | `#0b0d0a` | The page |
| `--surface` | `#fafbf8` | `#141712` | A panel |
| `--sunken` | `#e3e7dd` | `#080a07` | A well, a segmented control |
| `--ink`, `--ink-2`, `--ink-3` | `#11140f`, `#464c41`, `#5c6357` | `#eef1ea`, `#ced4c7`, `#b2b9aa` | Text, secondary, third |
| `--line`, `--line-strong` | 15% and 23% ink | 9% and 18% ink | Hairlines |
| `--gold` | `#825810` | `#deb164` | The one accent |
| `--up`, `--down` | `#1d7346`, `#ac3a2a` | `#60c68f`, `#ff9d88` | A rise, a fall |
| `--heat-from`, `--heat-to`, `--on-heat` | `#7a500d`, `#a8771f`, `#fffaf0` | `#c9973f`, `#e9c47c`, `#1a1206` | The gold ramp and what sits on it |
| `--band`, `--band-raised` | `#0f130e`, `#1a1f18` | `#171e15`, `#1f271c` | The band and a panel on it |
| `--on-band`, `--on-band-2` | `#eef1ea`, `#b3bcac` | `#eef1ea`, `#b8c1b0` | Text on the band |
| `--band-gold-from`, `--band-gold-to` | `#c9973f`, `#e9c47c` | the same | The gold on the band |
| `--ring-from`, `--ring-to` | `#ff5a1f`, `#ffb020` | the same | The ring's heat |

One more set is fixed in both schemes: `--tile`, `--on-tile`, `--on-tile-2` and `--tile-line`, the dark scheme's surface, ink, third ink and hairline, for what draws its own white text whatever the scheme (Jupiter's swap on `/swap`, #9).
The Playground's ivory palette, and the lifts it needed to pass the floors, are in this file's history (#2).

## Type

Archivo, drawn heavy and semi-expanded (the lockup expanded), for every headline, title, statement, figure, price and a coin's letter; Albert Sans for anything read or acted on; DM Mono for code and addresses; tabular figures throughout.
Instrument Serif, Instrument Sans and JetBrains Mono retired with the pick: the serif on every headline and figure was what made the rebuild a sibling of Peak's site.
The three faces are served by the app itself (`next/font/local`, the files and their OFL licences in `apps/web/src/fonts/`), each in Google's latin subset, preloaded, and its latin-ext subset, listed first in the family and fetched only by a page that draws one of its letters.
A heading's emphasis is its colour ("You do."), never a slant.
A module takes its type from the roles in `globals.css`, never a literal size, and names a family only as `var(--display)`, `var(--sans)` or `var(--mono)`:

| Role | Use |
| --- | --- |
| `--font-display` | The home page's headline |
| `--font-h1` | A page's one title |
| `--font-title` | A section title on the home page (`h2.title`) |
| `--font-statement` | A band's one sentence |
| `--font-figure` | A large figure (`.figures`) |
| `--font-lead` | A lead paragraph, in the sans |
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
| `--font-group` | A group's heading inside a table (the assets directory's kinds) |
| `--font-tile-xl` | An asset's letter on the asset page's 88px tile |
| `--text-micro` to `--text-lede` | The sans steps: 12, 13, 14, 15, 16, 17 and 18px |
| `--text-tiny` | 10px, an asset's monogram on its 16px badge alone |
| `--text-tile-lg` | 34px, the letter on a 64px tile |

Before shortlisting another face, try it under the site's base: a face whose figures and stops are tabular spaces running text apart under `font-variant-numeric: tabular-nums` (Schibsted Grotesk, Public Sans and Host Grotesk did, #26).

## Shape and motion

A 1120px shell with a gutter of 16 to 40px, a 64px bar, radii from `--radius-xs` (6px) to `--radius-xl` (22px) and `--radius-pill`, three durations (`--dur-fast`, `--dur`, `--dur-slow`) on one easing, one cycle for a piece that loops (`--dur-cycle`, the home page's pair roll, held still under reduced motion), and three elevations (`--shadow`, `--shadow-control`, `--shadow-overlay`).
Buttons are pills, like the home page's pair.
Reduced motion stops every transition outright.

## The shell

- The header, on the band: the caps STOKER with the ring as its O, the eight sections (Explore, Stocks, Swap, Assets, Rewards, Stats, Curated, Developers), the wallet and "Stoke a coin", the one filled button.
  A detail page marks its list's section, and Burns marks Stats.
- Under 900px the sections move to the phone bar at the window's foot, on the band too, the first five of them.
  Between 901px and 1080px the header shows the first six: the eight and the two actions need 1060px in Albert Sans with the caps lockup (1017px in the spec's faces).
- The pulse strip under the header, on the band's raised ground, on every page but home: the day's volume, the coins and the graduated count from `GET /v1/stats`, each only once it is real, and the strip only when one is.
- The footer, on the band: the lockup, four groups (Trade, Create, Records, Legal) and the risk sentence every page ends with.
- The account menu holds the wallets, Disconnect, "Your earnings" for a wallet that has launched a coin, and the light-or-dark toggle.
- The welcome on a first visit, accepted once per browser; it blocks nothing.

## What stands from production

The slogan, the heating ring, "Stoke a coin", "coin" never "token", light and dark following the visitor, the welcome, the region gate, Copy Protection, the fee model, every fee figure on `/fees` alone, and the legal, fee and risk wording, which the pages keep word for word.
