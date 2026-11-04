import { sql } from "drizzle-orm";
import type { Candle } from "@launchpad/contract";
import { quoteAssets, quoteCandles, quotePrices, type Db } from "@launchpad/db";

/**
 * The Quote Registry's price history (#3): every refresh records each priced Quote Asset's USD price, from which the API
 * answers `change24h` on a Quote Asset and its hourly candles. Two tables: the records themselves, kept a little over a
 * day so a price from 24 hours before the latest refresh is always there to measure against, and hourly candles, kept a
 * month, so the history mainnet's six hundred assets leave behind stays small (about 175,000 records and 430,000 candles).
 */

/** How long a record is kept: the 24 hours `change24h` reaches back, plus room for a refresh that ran late. */
export const QUOTE_PRICE_KEEP_HOURS = 26;
/** How long an hourly candle is kept: more than the 500 hours the candles endpoint answers. */
export const QUOTE_CANDLE_KEEP_DAYS = 31;
const MAX_CANDLES = 500;

/**
 * Records one refresh's USD prices, moves each asset's candle for the hour, and drops what has aged out. A new hour's
 * candle opens at the last price before it, so candles join up across the hour. Safe to run twice at once: a record is
 * keyed by its asset and time, and a candle's high, low and close only take in the newer price.
 */
export async function recordQuotePrices(db: Db, at: Date, prices: { mint: string; usd: string }[]) {
  const iso = at.toISOString();
  if (prices.length) {
    await db.insert(quotePrices).values(prices.map((p) => ({ mint: p.mint, recordedAt: at, priceUsd: p.usd }))).onConflictDoNothing();
    const values = sql.join(prices.map((p) => sql`(${p.mint}, ${p.usd}::double precision)`), sql`, `);
    // Drizzle's `sql` with a Date parameter fails under our postgres client, so the time goes in as text and is cast.
    await db.execute(sql`
      insert into ${quoteCandles} (mint, time, open, high, low, close)
      select v.mint, date_trunc('hour', ${iso}::timestamptz), coalesce(prev.close, v.price), greatest(coalesce(prev.close, v.price), v.price),
        least(coalesce(prev.close, v.price), v.price), v.price
      from (values ${values}) as v(mint, price)
      left join lateral (
        select c.close from ${quoteCandles} c where c.mint = v.mint and c.time < date_trunc('hour', ${iso}::timestamptz) order by c.time desc limit 1
      ) prev on true
      on conflict (mint, time) do update set
        high = greatest(${quoteCandles.high}, excluded.close),
        low = least(${quoteCandles.low}, excluded.close),
        close = excluded.close`);
  }
  await db.execute(sql`delete from ${quotePrices} where recorded_at < ${iso}::timestamptz - make_interval(hours => ${QUOTE_PRICE_KEEP_HOURS})`);
  await db.execute(sql`delete from ${quoteCandles} where time < ${iso}::timestamptz - make_interval(days => ${QUOTE_CANDLE_KEEP_DAYS})`);
}

/**
 * Each priced Quote Asset's `change24h`, by mint: its USD price at the latest refresh against the last record at least
 * 24 hours before that refresh, or, for an asset recorded for less than a day, against its first record. Assets without a
 * USD price now are left out, and so is one with a price but no record yet.
 */
export async function quoteChanges(db: Db, mint?: string): Promise<Map<string, number>> {
  const rows = await db.execute<{ mint: string; now: string; before: string | null }>(sql`
    select q.mint, q.price_usd as now, coalesce(
      (select p.price_usd from ${quotePrices} p where p.mint = q.mint and p.recorded_at <= q.refreshed_at - interval '24 hours' order by p.recorded_at desc limit 1),
      (select p.price_usd from ${quotePrices} p where p.mint = q.mint order by p.recorded_at asc limit 1)
    ) as before
    from ${quoteAssets} q
    where q.price_usd is not null ${mint === undefined ? sql`` : sql`and q.mint = ${mint}`}`);
  const out = new Map<string, number>();
  for (const r of rows) {
    const now = Number(r.now);
    const before = r.before === null ? NaN : Number(r.before);
    if (Number.isFinite(now) && Number.isFinite(before) && before > 0) out.set(r.mint, now / before - 1);
  }
  return out;
}

/** An asset's newest hourly candles, oldest first: its USD price as the Quote Registry recorded it. */
export async function quoteCandlesOf(db: Db, mint: string): Promise<Candle[]> {
  const rows = await db.execute<{ time: string; open: number; high: number; low: number; close: number }>(sql`
    select extract(epoch from time)::bigint as time, open, high, low, close
    from ${quoteCandles}
    where mint = ${mint}
    order by time desc
    limit ${MAX_CANDLES}`);
  return [...rows].reverse().map((r) => ({ time: Number(r.time), open: r.open, high: r.high, low: r.low, close: r.close, volume: "0" }));
}
