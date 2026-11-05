import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { WSOL_MINT } from "@launchpad/chain";
import { CandleList, QuoteAsset, QuoteAssetList } from "@launchpad/contract";
import { LOCAL_QUOTE_PRICES_USD, LOCAL_QUOTE_STOCK_PRICES_USD, LOCAL_QUOTES } from "@launchpad/localnet";
import { QUOTE_REGISTRY_CRON, freePort, startApi } from "@launchpad/stack";
import { env, listQuotes, refreshQuoteRegistry } from "./client";

// The Quote Asset's market (#3): the day's change and hourly candles from the prices the Quote Registry records at each
// refresh, and the last price of the stock a tokenized stock tracks.

const NVDAX = LOCAL_QUOTES.NVDAx.toBase58();
const JTO = LOCAL_QUOTES.JTO.toBase58();
const USDC = LOCAL_QUOTES.USDC.toBase58();
const BULLWHALE = LOCAL_QUOTES.BULLWHALE.toBase58();
const SOL = WSOL_MINT.toBase58();

const api = (path: string) => fetch(`${env().apiUrl}${path}`);
const byMint = async () => new Map((await listQuotes()).map((q) => [q.mint, q]));
async function candles(mint: string) {
  const res = await api(`/v1/quotes/${mint}/candles?interval=1h`);
  expect(res.status).toBe(200);
  return CandleList.parse(await res.json());
}

/**
 * One Quote Registry refresh at other prices, as the market would move them: a second API on the same database with its
 * own static prices. Each move stays under the 5% drift that re-centres a curve rule's band (ADR 0005), so no rule is
 * rewritten, and the stack's own refresh afterwards puts the prices back for the files that run later.
 */
async function refreshAt(prices: Record<string, string>, stockPrices: Record<string, string>) {
  const h = env();
  const vars = { ...h.apiVars, QUOTE_PRICES_USD: JSON.stringify(prices), QUOTE_STOCK_PRICES_USD: JSON.stringify(stockPrices) };
  const other = await startApi({ port: await freePort(), databaseUrl: h.databaseUrl, vars });
  try {
    const res = await fetch(`${other.url}/__scheduled?cron=${encodeURIComponent(QUOTE_REGISTRY_CRON)}`);
    expect(res.ok).toBe(true);
  } finally {
    await other.stop();
  }
}

describe("the spec's fixture", () => {
  // The Playground's fixture is what the rebuilt pages are drawn against (ADR 0017): the API's contract must read it.
  const fixture = JSON.parse(readFileSync(fileURLToPath(new URL("../../../docs/design/playground/src/fixture.json", import.meta.url)), "utf8")) as Record<string, unknown>;

  it("parses as the contract's Quote Asset list, the proposed market fields included", () => {
    const quotes = QuoteAssetList.parse(fixture["/v1/quotes"]).quotes;
    const nvdax = quotes.find((q) => q.symbol === "NVDAx")!;
    expect(nvdax.change24h).toBeTypeOf("number");
    expect(nvdax.market?.last).toEqual({ price: expect.any(Number), at: expect.any(String) });
    // An asset whose parts are unknown leaves them out, as the API does.
    const sol = quotes.find((q) => q.symbol === "SOL")!;
    expect("change24h" in sol).toBe(false);
  });

  it("parses every Quote Asset's candles as the contract's candle list", () => {
    const keys = Object.keys(fixture).filter((k) => /^\/v1\/quotes\/[^/]+\/candles$/.test(k));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(CandleList.parse(fixture[key]).interval).toBe("1h");
  });
});

describe("the Quote Asset's market", () => {
  it("measures the day's change, candles and the tracked stock's price from what each refresh records", async () => {
    await refreshQuoteRegistry();
    let quotes = await byMint();
    // The tracked stock's price as the source reported it at the refresh; a coin's market never has one.
    expect(quotes.get(NVDAX)!.market).toEqual({
      symbol: "NASDAQ:NVDA", venue: "NASDAQ", ticker: "NVDA", last: { price: Number(LOCAL_QUOTE_STOCK_PRICES_USD[NVDAX]), at: expect.any(String) },
    });
    expect(Date.parse(quotes.get(NVDAX)!.market!.last!.at)).toBeGreaterThan(Date.now() - 5 * 60_000);
    expect(quotes.get(JTO)!.market).toEqual({ symbol: "CRYPTO:JTOUSD", venue: "CRYPTO", ticker: "JTOUSD" });
    // Nothing has moved since the stack's first refresh.
    for (const mint of [SOL, USDC, NVDAX, JTO]) expect(quotes.get(mint)!.change24h).toBe(0);
    // An asset without a price has no change to show.
    expect("change24h" in quotes.get(BULLWHALE)!).toBe(false);

    const moved = { ...LOCAL_QUOTE_PRICES_USD, [NVDAX]: "183.6", [JTO]: "2.45" };
    try {
      await refreshAt(moved, { [NVDAX]: "184.1" });
      quotes = await byMint();
      expect(quotes.get(NVDAX)!.price!.usd).toBe("183.6");
      // Against the first record, since the stack has been recording for less than a day: NVDAx up 2%, JTO down 2%.
      expect(quotes.get(NVDAX)!.change24h).toBeCloseTo(0.02, 12);
      expect(quotes.get(JTO)!.change24h).toBeCloseTo(-0.02, 12);
      expect(quotes.get(USDC)!.change24h).toBe(0);
      expect(quotes.get(NVDAX)!.market!.last!.price).toBe(184.1);
      // One asset answers the same as the list.
      const one = QuoteAsset.parse(await (await api(`/v1/quotes/${NVDAX}`)).json());
      expect(one.change24h).toBe(quotes.get(NVDAX)!.change24h);
      expect(one.market).toEqual(quotes.get(NVDAX)!.market);

      // Hourly candles that join up, the newest closing at the latest price and reaching it at its high.
      const list = await candles(NVDAX);
      expect(list.interval).toBe("1h");
      const last = list.candles.at(-1)!;
      expect(last).toMatchObject({ close: 183.6, high: 183.6, volume: "0" });
      expect(Math.min(...list.candles.map((c) => c.low))).toBe(180);
      list.candles.forEach((c, i) => {
        expect(c.time % 3600).toBe(0);
        expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
        expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
        if (i > 0) {
          expect(c.time).toBeGreaterThan(list.candles[i - 1]!.time);
          expect(c.open).toBe(list.candles[i - 1]!.close);
        }
      });
      expect((await candles(JTO)).candles.at(-1)).toMatchObject({ close: 2.45, low: 2.45, high: 2.5 });
      // An asset never priced has nothing recorded.
      expect((await candles(BULLWHALE)).candles).toEqual([]);
    } finally {
      await refreshQuoteRegistry();
    }
    quotes = await byMint();
    // Back where it started, and the stock's price with it.
    expect(quotes.get(NVDAX)!.change24h).toBe(0);
    expect(quotes.get(NVDAX)!.market!.last!.price).toBe(Number(LOCAL_QUOTE_STOCK_PRICES_USD[NVDAX]));
    expect((await candles(NVDAX)).candles.at(-1)).toMatchObject({ close: 180, high: 183.6 });
  });

  it("answers hourly candles only, and only for a Quote Asset", async () => {
    const wrong = await api(`/v1/quotes/${NVDAX}/candles?interval=5m`);
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toEqual({ error: "interval must be one of 1h" });
    // The interval defaults to the hour.
    expect(CandleList.parse(await (await api(`/v1/quotes/${NVDAX}/candles`)).json()).interval).toBe("1h");
    const unknown = await api(`/v1/quotes/${Keypair.generate().publicKey.toBase58()}/candles`);
    expect(unknown.status).toBe(404);
  });
});
