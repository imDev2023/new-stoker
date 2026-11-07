import { OperatorConsole } from "@/components/OperatorConsole";
import { getPlatform } from "@/lib/api";
import { pageMeta } from "@/lib/meta";

// Behind the operator token: nothing for a search engine to list (robots.txt keeps crawlers out as well).
export const metadata = pageMeta({ path: "/operator", title: "Operator", index: false });

/** The operator's own console (#13), behind the operator token: for support, never linked from the public pages. */
export default async function OperatorPage() {
  const platform = await getPlatform();
  return <OperatorConsole platform={platform} />;
}
