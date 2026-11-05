import type { Metadata } from "next";
import { LaunchForm } from "@/components/LaunchForm";
import { getPlatform, listQuotes } from "@/lib/api";
import { cleanSymbol, NAME_MAX } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Stoke a coin",
  description: "Launch a coin on Solana priced in SOL, a stablecoin, a tokenized stock or any asset Raydium quotes.",
};

type Params = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Params> };

const one = (params: Params, key: string) => {
  const v = params[key];
  return typeof v === "string" ? v : "";
};

/**
 * Stoke a coin (#8): the spec's form (`launch.html`) with production's flow. An asset's page links here with
 * `?quote=<mint>`, so the form opens on that asset, and `?name=` and `?symbol=` fill the coin's fields within the form's
 * limits; anything else is ignored. `?summary=flow` shows the spec's "Per $1,000 traded" in the summary, the alternative
 * to production's rule (every fee figure on /fees alone) that the owner decides on (the map's open question 1).
 */
export default async function LaunchPage({ searchParams }: Props) {
  const [platform, { quotes }, params] = await Promise.all([getPlatform(), listQuotes(), searchParams]);
  const quote = one(params, "quote");
  return (
    <LaunchForm
      platform={platform}
      quotes={quotes.filter((q) => q.launchable)}
      initialQuote={/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(quote) ? quote : null}
      initialName={one(params, "name").trim().slice(0, NAME_MAX)}
      initialSymbol={cleanSymbol(one(params, "symbol"))}
      flow={one(params, "summary") === "flow"}
    />
  );
}
