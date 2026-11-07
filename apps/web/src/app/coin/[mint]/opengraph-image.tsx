import { ImageResponse } from "next/og";
import { getLaunch } from "@/lib/api";
import { quoteTicker } from "@/lib/format";
import { clip } from "@/lib/meta";
import { CARD, DISPLAY, fitSize, GOLD, noCard, picture, SHARE_SIZE, ShareFrame, shareFonts } from "@/lib/share";

/**
 * A coin's share card (#14), as its link unfurls on X or Telegram: its picture, the pair it trades as with the asset in
 * the gold, its name, its description and, for a Reward Launch, that it is one. Only what was fixed at launch, since a
 * crawler keeps the card it fetched; the live figures are on the page, and the Reward Tax's rate, a fee figure, is the
 * Fees page's (owner, 2026-10-30).
 */
export const alt = "A coin on Stoker and the asset it is paired with";
export const size = SHARE_SIZE;
export const contentType = "image/png";

/** The picture's side, and the column the pair and the words have beside it. */
const SIDE = 300;
const COLUMN = 1056 - SIDE - 56;

export default async function Image({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const launch = await getLaunch(mint).catch(() => null);
  if (!launch) return noCard("coin");
  const quote = quoteTicker(launch.quote);
  const image = await picture(launch.image);
  const box = { width: SIDE, height: SIDE, borderRadius: 28, flexShrink: 0 } as const;
  return new ImageResponse(
    (
      <ShareFrame>
        <div style={{ display: "flex", alignItems: "center", gap: 56, flexGrow: 1 }}>
          {image ? (
            <img src={image} width={SIDE} height={SIDE} alt="" style={{ ...box, objectFit: "cover", border: `1px solid ${CARD.line}` }} />
          ) : (
            // The coin's letter on the gold, as its tile is drawn everywhere on the site (`.tile`).
            <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: GOLD, fontFamily: DISPLAY, fontWeight: 800, fontSize: 150, color: CARD.onGold }}>
              {launch.symbol.charAt(0)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", width: COLUMN }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", fontFamily: DISPLAY, fontWeight: 800, fontSize: fitSize(`${launch.symbol} / ${quote}`, COLUMN), lineHeight: 1.05, letterSpacing: -1.5 }}>
              <span style={{ marginRight: "0.22em" }}>{launch.symbol}</span>
              {/* The slash travels with the asset, so a long pair breaks before it, as the site's pairs do. */}
              <span style={{ display: "flex" }}>
                <span style={{ color: CARD.ink2, marginRight: "0.22em" }}>/</span>
                <span style={{ backgroundImage: GOLD, backgroundClip: "text", color: "transparent", paddingRight: 4 }}>{quote}</span>
              </span>
            </div>
            <div style={{ display: "flex", marginTop: 18, fontSize: 40, lineHeight: 1.15, color: CARD.ink }}>{clip(launch.name, 60)}</div>
            {launch.description?.trim() && (
              <div style={{ display: "flex", marginTop: 14, fontSize: 26, lineHeight: 1.4, color: CARD.ink2 }}>{clip(launch.description, 130)}</div>
            )}
            {launch.rewardTax && (
              <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 24, padding: "8px 18px", borderRadius: 999, border: `1px solid ${CARD.line}`, background: CARD.raised, fontSize: 22, color: CARD.ink }}>
                Reward Launch
              </div>
            )}
          </div>
        </div>
      </ShareFrame>
    ),
    { ...size, fonts: shareFonts(), headers: { "cache-control": "public, max-age=86400" } },
  );
}
