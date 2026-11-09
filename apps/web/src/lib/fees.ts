/**
 * Fee figures are shown in one place, the Fees page (owner, 2026-10-30), every one of them from `GET /v1/platform` and
 * `GET /v1/burns` and never a constant; everywhere else the site says what a fee is for and links there. The records
 * (Stats, Burn and Flywheel, Fee changes) state the Burn's share and an announced change, as production's did.
 */

/** A rate in basis points as copy: at most three decimals, none it doesn't need (carried from production). */
export const pct = (bps: number) => `${Number((bps / 100).toFixed(3))}%`;

/** A list as a sentence says it: "1%, 3% or 5%". */
export function orList(items: readonly string[]) {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}
