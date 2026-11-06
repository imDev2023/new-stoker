// The tokens and primitives come first, so a component's module can override a primitive's defaults on a tied selector.
import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { PhoneBar } from "@/components/PhoneBar";
import { Providers } from "@/components/Providers";
import { Pulse } from "@/components/Pulse";
import { RingDefs } from "@/components/Ring";
import { SearchShortcut } from "@/components/SearchShortcut";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Welcome } from "@/components/Welcome";
import { getPlatform, getStats } from "@/lib/api";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@/lib/meta";
import { siteOrigin } from "@/lib/origin";
import { CHROME, isScheme, SCHEME_COOKIE } from "@/lib/scheme";

// The three families (E Furnace, the owner's pick on #26): Archivo with its width axis for the headlines and figures,
// Albert Sans for everything read or acted on, DM Mono for code and addresses. Served by the app from src/fonts (each
// face with its OFL licence), so no page and no run of the UI suite waits on Google's font servers. Each face comes in
// two files, Google's latin and latin-ext subsets: the latin one is preloaded, and the latin-ext one, listed first in the
// family (globals.css), is fetched only by a page that draws one of its letters. The latin face alone carries the
// metric-matched fallback, so a letter neither covers falls through to it. next/font takes literal options only, so
// each call is written out in full.
const archivoExt = localFont({
  src: "../fonts/archivo-latin-ext-wdth-normal.woff2",
  weight: "100 900",
  variable: "--font-archivo-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-stretch", value: "62% 125%" },
    { prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  ],
});
const archivo = localFont({
  src: "../fonts/archivo-latin-wdth-normal.woff2",
  weight: "100 900",
  variable: "--font-archivo",
  display: "swap",
  declarations: [
    { prop: "font-stretch", value: "62% 125%" },
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
});
const albertExt = localFont({
  src: "../fonts/albert-sans-latin-ext-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-albert-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  ],
});
const albert = localFont({
  src: "../fonts/albert-sans-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-albert",
  display: "swap",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
});
const monoExt = localFont({
  src: [
    { path: "../fonts/dm-mono-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-mono-latin-ext-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono-ext",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF" },
  ],
});
const mono = localFont({
  src: [
    { path: "../fonts/dm-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-dm-mono",
  display: "swap",
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" },
  ],
});
const fonts = [archivoExt, archivo, albertExt, albert, monoExt, mono].map((font) => font.variable).join(" ");

export async function generateMetadata(): Promise<Metadata> {
  // Only mainnet is indexable: the devnet rehearsal and a local stack carry test coins that would otherwise be indexed
  // under the brand. The platform is read again below; Next memoises the fetch.
  const [{ cluster }, origin] = await Promise.all([getPlatform(), siteOrigin()]);
  return {
    // Every relative address a page gives out resolves against the origin the request came in on, so each deployment names itself.
    metadataBase: new URL(origin),
    title: { default: SITE_TITLE, template: `%s · ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    icons: {
      // `/icon.png` is the file the PlatformConfig's `img` names on-chain, so it stays at this address.
      icon: [
        { url: "/favicon.ico", sizes: "32x32" },
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      apple: "/apple-touch-icon.png",
    },
    ...(cluster === "mainnet" ? {} : { robots: { index: false, follow: false } }),
  };
}

/** The browser's own chrome follows the header's band: the visitor's choice when there is one, the system setting otherwise. */
export async function generateViewport(): Promise<Viewport> {
  const scheme = (await cookies()).get(SCHEME_COOKIE)?.value;
  return {
    themeColor: isScheme(scheme)
      ? CHROME[scheme]
      : [
          { media: "(prefers-color-scheme: light)", color: CHROME.light },
          { media: "(prefers-color-scheme: dark)", color: CHROME.dark },
        ],
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The strip's figures are left out rather than the page failing if they can't be read.
  const [platform, stats, jar] = await Promise.all([getPlatform(), getStats().catch(() => null), cookies()]);
  const scheme = jar.get(SCHEME_COOKIE)?.value;
  return (
    <html lang="en" data-theme={isScheme(scheme) ? scheme : undefined} className={fonts}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Providers rpcUrl={platform.rpcUrl}>
          <SiteHeader />
          <Pulse stats={stats} />
          <main id="main">{children}</main>
          <SiteFooter />
          <PhoneBar />
          <Welcome />
          <SearchShortcut />
        </Providers>
        <RingDefs />
      </body>
    </html>
  );
}
