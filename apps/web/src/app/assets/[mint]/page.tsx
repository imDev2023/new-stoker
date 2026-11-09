import { permanentRedirect } from "next/navigation";

type Props = { params: Promise<{ mint: string }> };

/** Production's address for an asset's page (`/assets/<mint>`), kept for links made before the rebuild: the page is `/asset/<mint>`. */
export default async function OldAssetPage({ params }: Props) {
  permanentRedirect(`/asset/${encodeURIComponent((await params).mint)}`);
}
