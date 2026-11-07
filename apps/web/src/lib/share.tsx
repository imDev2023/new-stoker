import type { ReactNode } from "react";
import { OG_FONTS } from "./ogFonts";

/**
 * What every share card is made of (#14, production's Stoker-Markets#83 drawn again in E Furnace): the size, the band's
 * ground and inks, the faces and the mark. A card is one image whatever the viewer's scheme and wherever it unfurls, so
 * it is drawn on the band, the mark's dark tile, which is the same in both schemes. `next/og` lays it out with Satori:
 * every box is a flex box, every style one Satori knows, and a text box has a set width, or its line runs off the card.
 */
export const SHARE_SIZE = { width: 1200, height: 630 };

/**
 * The band's tokens of globals.css in the light scheme (the dark band is a step lighter, for a page that is dark too;
 * a card sits on whatever page shares it, so it takes the darker), the gold on the band and the ring's heat. Satori
 * reads no custom property, so the values are written here: change them with globals.css.
 */
export const CARD = {
  band: "#0f130e",
  raised: "#1a1f18",
  line: "rgba(238, 241, 234, 0.24)",
  ink: "#eef1ea",
  ink2: "#b3bcac",
  goldFrom: "#c9973f",
  goldTo: "#e9c47c",
  onGold: "#0f130e",
  ringFrom: "#ff5a1f",
  ringTo: "#ffb020",
} as const;

/** The gold ramp (`--heat` on the band), for "You do.", an asset's ticker and a coin's letter tile. */
export const GOLD = `linear-gradient(60deg, ${CARD.goldFrom}, ${CARD.goldTo})`;

/** The faces, as `scripts/og-fonts.py` names its instances: each family lists its latin-ext half second. */
export const DISPLAY = "Archivo, Archivo Ext";
export const BRAND = "Archivo Expanded";
export const BODY = "Albert Sans, Albert Sans Ext";

type Font = { name: string; weight: 500 | 800; style: "normal"; data: ArrayBuffer };
let fonts: Font[] | undefined;

/** The fonts a card is set in, decoded once from the bundled instances. */
export function shareFonts(): Font[] {
  fonts ??= OG_FONTS.map((f) => ({ name: f.name, weight: f.weight, style: "normal", data: decode(f.data) }));
  return fonts;
}

function decode(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Ring.tsx's drawing (RingDefs), the bloom a touch wider since a card is seen small.
const RING_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs>` +
  `<linearGradient id="h" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${CARD.ringFrom}"/><stop offset="1" stop-color="${CARD.ringTo}"/></linearGradient>` +
  `<filter id="b" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2"/></filter></defs>` +
  `<g fill="none" stroke="url(#h)" stroke-width="4.2"><circle cx="16" cy="16" r="8.6" filter="url(#b)" opacity=".55"/>` +
  `<circle cx="16" cy="16" r="8.6"/></g></svg>`;

/** The heating ring as an image Satori can place. */
export const RING = `data:image/svg+xml;base64,${btoa(RING_SVG)}`;

/**
 * The hero's glow (`--glow`), a soft heat behind the ring. Satori ignores `closest-side` and draws to the farthest corner,
 * so the gradient ends at 70%, inside the box's half side, or the box's square edges show.
 */
export const GLOW = "radial-gradient(circle, rgba(255, 110, 40, 0.17) 0%, rgba(255, 110, 40, 0) 70%)";

/** The display size a line fits a column at: `max` for a short one, less for a long one, never under `min`. */
export function fitSize(text: string, room: number, max = 96, min = 44) {
  return Math.round(Math.max(min, Math.min(max, room / (text.length * 0.72))));
}

/**
 * A picture as Satori can place it: fetched, and handed over as a data address. Satori can't read WebP or AVIF, so
 * those, a picture that doesn't answer in time and one that isn't an image give null, and the card draws the letter.
 */
export async function picture(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!res.ok || !/^image\/(png|jpeg|gif)$/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** The lockup as the header draws it (Brand.tsx): the caps STOKER with the ring as its O. */
function Lockup({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", fontFamily: BRAND, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.045, color: CARD.ink }}>
      <span>ST</span>
      <img src={RING} width={size * 1.1} height={size * 1.1} alt="" style={{ marginLeft: -size * 0.11, marginRight: -size * 0.07 }} />
      <span>KER</span>
    </div>
  );
}

/**
 * The frame every card shares: the band, the content in the column the padding leaves, and along the foot the lockup
 * and the site's domain.
 */
export function ShareFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative", padding: "60px 72px 124px",
        background: CARD.band, color: CARD.ink, fontFamily: BODY, fontWeight: 500,
      }}
    >
      {children}
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Lockup size={34} />
        <span style={{ fontSize: 26, color: CARD.ink2 }}>stoker.markets</span>
      </div>
    </div>
  );
}

/** A response for a card whose page is a 404: the same status, so a crawler keeps no card for it. */
export const noCard = (what: string) => new Response(`No ${what} at this address`, { status: 404 });
