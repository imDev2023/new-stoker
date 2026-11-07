import type { Metadata } from "next";
import { AssetDirectory } from "@/components/AssetDirectory";
import { listQuotes } from "@/lib/api";
import { assetRow, assetsQueryFrom } from "@/lib/assets";
import { pageMeta } from "@/lib/meta";

export const metadata: Metadata = pageMeta({
  path: "/assets",
  title: "Assets",
  description: "Every asset a coin can be priced in, as Raydium quotes it, read from the chain every five minutes.",
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Assets (#9): every Quote Asset the registry quotes, grouped by kind and issuer, searched and filtered. */
export default async function AssetsPage({ searchParams }: Props) {
  const query = assetsQueryFrom(await searchParams);
  // The controls never wait on the API: a registry that can't be read renders as no rows.
  const assets = await listQuotes().then((l) => l.quotes.map(assetRow), () => []);
  return <AssetDirectory assets={assets} initialQuery={query} />;
}
