import { getQuoteAsset } from "@/lib/api";
import { assetCard } from "@/lib/assetCard";
import { stockSubtitle } from "@/lib/assets";
import { noCard, SHARE_SIZE } from "@/lib/share";
import { isStock } from "@/lib/stocks";

/** A tokenized stock's share card (#14): its tile, its ticker and its name and issuer, as its page's head sets them. */
export const alt = "A tokenized stock on Stoker";
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ mint: string }> }) {
  const quote = await getQuoteAsset((await params).mint).catch(() => null);
  return quote && isStock(quote) ? assetCard(quote, stockSubtitle(quote)) : noCard("stock");
}
