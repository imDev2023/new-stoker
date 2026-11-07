import { ImageResponse } from "next/og";
import type { QuoteAsset } from "@launchpad/contract";
import { quoteTicker } from "./format";
import { CARD, DISPLAY, fitSize, GOLD, picture, SHARE_SIZE, ShareFrame, shareFonts } from "./share";

/** The tile's side, and the column the ticker and its line have beside it. */
const SIDE = 240;
const COLUMN = 1056 - SIDE - 56;

/**
 * The card an asset's page and a stock's page share (#14): the asset's logo, or its letter, on the round tile its pages
 * draw (round, so it never reads as a coin's square), its ticker in the gold and the page's own line under it (the name
 * and the kind, or the name and the issuer). No price: a crawler keeps the card it fetched, and the price moves.
 */
export async function assetCard(quote: QuoteAsset, subtitle: string) {
  const ticker = quoteTicker(quote);
  const logo = await picture(quote.logo);
  const tile = { width: SIDE, height: SIDE, borderRadius: SIDE / 2, flexShrink: 0 } as const;
  return new ImageResponse(
    (
      <ShareFrame>
        <div style={{ display: "flex", alignItems: "center", gap: 56, flexGrow: 1 }}>
          {logo ? (
            <img src={logo} width={SIDE} height={SIDE} alt="" style={{ ...tile, objectFit: "cover" }} />
          ) : (
            // The letter on the ink, as AssetTile draws it on the band.
            <div style={{ ...tile, display: "flex", alignItems: "center", justifyContent: "center", background: CARD.ink, fontFamily: DISPLAY, fontWeight: 800, fontSize: 110, color: CARD.band }}>
              {ticker.charAt(0)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", width: COLUMN }}>
            <div style={{ display: "flex", fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(ticker, COLUMN, 120), lineHeight: 1.05, letterSpacing: -2 }}>
              <span style={{ backgroundImage: GOLD, backgroundClip: "text", color: "transparent", paddingRight: 6 }}>{ticker}</span>
            </div>
            {subtitle && <div style={{ display: "flex", marginTop: 20, fontSize: 38, lineHeight: 1.2, color: CARD.ink2 }}>{subtitle}</div>}
          </div>
        </div>
      </ShareFrame>
    ),
    { ...SHARE_SIZE, fonts: shareFonts(), headers: { "cache-control": "public, max-age=86400" } },
  );
}
