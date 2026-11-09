import { getQuoteAsset } from "@/lib/api";
import { assetCard } from "@/lib/assetCard";
import { assetSubtitle } from "@/lib/assets";
import { noCard, SHARE_SIZE } from "@/lib/share";

/** An asset's share card (#14): its tile, its ticker and its name and kind, as its page's head sets them. */
export const alt = "An asset a coin on Stoker can be priced in";
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ mint: string }> }) {
  const quote = await getQuoteAsset((await params).mint).catch(() => null);
  return quote ? assetCard(quote, assetSubtitle(quote)) : noCard("asset");
}
