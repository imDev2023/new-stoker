import { CreatorEarningsView } from "@/components/CreatorEarnings";
import { getPlatform } from "@/lib/api";
import { pageMeta } from "@/lib/meta";

// The connected Creator's own page: nothing for a search engine to list (robots.txt keeps crawlers out as well).
export const metadata = pageMeta({ path: "/creator", title: "Your earnings", index: false });

/** `/creator`, the connected wallet's own (ADR 0009, #13): reached from the account menu once it has launched a coin. */
export default async function CreatorPage() {
  const platform = await getPlatform();
  return <CreatorEarningsView platform={platform} />;
}
