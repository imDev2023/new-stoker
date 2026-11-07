import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ wallet: string }> };

/** Production's address for a wallet's rewards (`/rewards/<wallet>`), kept for links made before the rebuild: the lookup is in place on `/rewards` now (#12, #13). */
export default async function OldWalletRewardsPage({ params }: Props) {
  permanentRedirect(`/rewards?wallet=${encodeURIComponent((await params).wallet)}`);
}
