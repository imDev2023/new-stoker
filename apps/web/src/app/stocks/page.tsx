import type { Metadata } from "next";
import { StockDirectory } from "@/components/StockDirectory";
import { listQuotes } from "@/lib/api";
import { isStock, stockRow, stocksQueryFrom } from "@/lib/stocks";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  path: "/stocks",
  title: "Stocks",
  description: "Tokenized stocks on Solana, open around the clock: each one's price, its gap to the stock it tracks, its liquidity and issuer.",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Stocks (#10): every tokenized stock the Quote Registry quotes, sorted, searched and filtered by issuer. */
export default async function StocksPage({ searchParams }: Props) {
  const query = stocksQueryFrom(await searchParams);
  // The controls never wait on the API: a registry that can't be read renders as no rows.
  const stocks = await listQuotes().then((l) => l.quotes.filter(isStock).map(stockRow), () => []);
  return <StockDirectory stocks={stocks} initialQuery={query} />;
}
