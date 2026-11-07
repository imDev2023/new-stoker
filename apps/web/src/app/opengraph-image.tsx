import { ImageResponse } from "next/og";
import { SITE_CARD } from "@/lib/meta";
import { DISPLAY, GLOW, GOLD, RING, SHARE_SIZE, ShareFrame, shareFonts } from "@/lib/share";

/**
 * The site's share card (#14), as a link to any page without a card of its own unfurls: the home page's hero, the ring
 * glowing over the slogan with "You do." in the gold, on the band, and the lockup with the domain along the foot. No
 * lede and no fee figure (the Fees page is the one place a figure is shown, owner 2026-10-30): the description beside
 * the card in a preview says what Stoker is.
 */
export const alt = SITE_CARD.alt;
export const size = SHARE_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <ShareFrame>
        <div style={{ position: "absolute", left: 300, top: -124, width: 600, height: 600, display: "flex", backgroundImage: GLOW }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 1056, flexGrow: 1, justifyContent: "center" }}>
          <img src={RING} width={132} height={132} alt="" />
          {/* The slogan on two lines, as the hero sets it at a desktop's width; its emphasised half in the gold. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40, fontFamily: DISPLAY, fontWeight: 800, fontSize: 84, lineHeight: 1.02, letterSpacing: -2.5 }}>
            <span>No one picks your pair.</span>
            <span style={{ backgroundImage: GOLD, backgroundClip: "text", color: "transparent", paddingRight: 6 }}>You do.</span>
          </div>
        </div>
      </ShareFrame>
    ),
    { ...size, fonts: shareFonts(), headers: { "cache-control": "public, max-age=3600" } },
  );
}
