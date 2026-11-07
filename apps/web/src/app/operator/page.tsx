import type { Metadata } from "next";
import { OperatorConsole } from "@/components/OperatorConsole";
import { getPlatform } from "@/lib/api";

export const metadata: Metadata = { title: "Operator", robots: { index: false, follow: false } };

/** The operator's own console (#13), behind the operator token: for support, never linked from the public pages. */
export default async function OperatorPage() {
  const platform = await getPlatform();
  return <OperatorConsole platform={platform} />;
}
