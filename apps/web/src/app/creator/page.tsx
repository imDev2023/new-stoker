import type { Metadata } from "next";
import { CreatorEarningsView } from "@/components/CreatorEarnings";
import { getPlatform } from "@/lib/api";

// The connected Creator's own page: nothing for a search engine to list.
export const metadata: Metadata = { title: "Your earnings", robots: { index: false } };

/** `/creator`, the connected wallet's own (ADR 0009, #13): reached from the account menu once it has launched a coin. */
export default async function CreatorPage() {
  const platform = await getPlatform();
  return <CreatorEarningsView platform={platform} />;
}
