// The tokens and primitives come first, so a component's module can override a primitive's defaults on a tied selector.
import "./globals.css";
import type { Metadata, Viewport } from "next";
import {
  Albert_Sans, Archivo, Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, DM_Mono, IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Sans, Instrument_Serif,
  JetBrains_Mono,
} from "next/font/google";
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
import { LookSwitch } from "@/components/LookSwitch";
import { FORM_COOKIE, isForm, isPaper, isTypePair, PAPER_COOKIE, TYPE_COOKIE } from "@/lib/looks";
import { isScheme, PAPER, SCHEME_COOKIE } from "@/lib/scheme";

// The spec's three families (docs/design/playground/src/layout.html), served by the app itself.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument-serif", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });
// Review-only (#26; lib/looks.ts): the candidates' type pairs, never preloaded, so a page in the current look fetches none of them.
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex-sans", display: "swap", preload: false });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap", preload: false });
const albertSans = Albert_Sans({ subsets: ["latin"], variable: "--font-albert-sans", display: "swap", preload: false });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap", preload: false });
const atkinsonNext = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson-next", display: "swap", preload: false });
const atkinsonMono = Atkinson_Hyperlegible_Mono({ subsets: ["latin"], variable: "--font-atkinson-mono", display: "swap", preload: false });
// The second round's display face for E: Archivo with its width axis, drawn semi-expanded and expanded.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap", preload: false });
const candidateFonts = [plexSans, plexMono, albertSans, dmMono, atkinsonNext, atkinsonMono, archivo].map((font) => font.variable).join(" ");

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

/** The browser's own chrome follows the page: the visitor's choice when there is one, the system setting otherwise. */
export async function generateViewport(): Promise<Viewport> {
  const scheme = (await cookies()).get(SCHEME_COOKIE)?.value;
  return {
    themeColor: isScheme(scheme)
      ? PAPER[scheme]
      : [
          { media: "(prefers-color-scheme: light)", color: PAPER.light },
          { media: "(prefers-color-scheme: dark)", color: PAPER.dark },
        ],
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The strip's figures are left out rather than the page failing if they can't be read.
  const [platform, stats, jar] = await Promise.all([getPlatform(), getStats().catch(() => null), cookies()]);
  const scheme = jar.get(SCHEME_COOKIE)?.value;
  const paper = jar.get(PAPER_COOKIE)?.value;
  const type = jar.get(TYPE_COOKIE)?.value;
  const form = jar.get(FORM_COOKIE)?.value;
  return (
    <html
      lang="en"
      data-theme={isScheme(scheme) ? scheme : undefined}
      data-paper={isPaper(paper) ? paper : undefined}
      data-type={isTypePair(type) ? type : undefined}
      data-form={isForm(form) ? form : undefined}
      className={`${serif.variable} ${sans.variable} ${mono.variable} ${candidateFonts}`}
    >
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
          <LookSwitch />
        </Providers>
        <RingDefs />
      </body>
    </html>
  );
}
