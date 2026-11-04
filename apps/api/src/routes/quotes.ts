import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { QUOTE_CANDLE_INTERVALS, type CandleList, type QuoteAssetList } from "@launchpad/contract";
import { quoteAssets } from "@launchpad/db";
import type { AppEnv } from "../env";
import { byPickerOrder, toQuoteAsset } from "../quotes/assets";
import { quoteCandlesOf, quoteChanges } from "../quotes/history";

/** The Quote Registry, read side: every Quote Asset with its price, Graduation Target and whether it can be launched against. */
export const quotes = new Hono<AppEnv>();

quotes.get("/quotes", async (c) => {
  const db = c.get("db");
  const [rows, changes] = await Promise.all([db.select().from(quoteAssets), quoteChanges(db)]);
  const body: QuoteAssetList = { quotes: rows.map((r) => toQuoteAsset(c.get("cfg"), r, changes.get(r.mint))).sort(byPickerOrder) };
  return c.json(body);
});

quotes.get("/quotes/:mint", async (c) => {
  const db = c.get("db");
  const mint = c.req.param("mint");
  const [[row], changes] = await Promise.all([db.select().from(quoteAssets).where(eq(quoteAssets.mint, mint)).limit(1), quoteChanges(db, mint)]);
  if (!row) return c.json({ error: "quote asset not found" }, 404);
  return c.json(toQuoteAsset(c.get("cfg"), row, changes.get(row.mint)));
});

/** A Quote Asset's USD price in hourly candles, from what the Quote Registry recorded at each refresh (#3). */
quotes.get("/quotes/:mint/candles", async (c) => {
  const interval = c.req.query("interval") ?? "1h";
  if (!(QUOTE_CANDLE_INTERVALS as readonly string[]).includes(interval)) return c.json({ error: `interval must be one of ${QUOTE_CANDLE_INTERVALS.join(", ")}` }, 400);
  const db = c.get("db");
  const mint = c.req.param("mint");
  const [row] = await db.select({ mint: quoteAssets.mint }).from(quoteAssets).where(eq(quoteAssets.mint, mint)).limit(1);
  if (!row) return c.json({ error: "quote asset not found" }, 404);
  const body: CandleList = { interval: "1h", candles: await quoteCandlesOf(db, mint) };
  return c.json(body);
});
