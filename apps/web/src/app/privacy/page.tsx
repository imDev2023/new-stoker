import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { SITE_LINKS } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: "What the Stoker site and API keep about you, and what the chain keeps for everyone." };

/**
 * The privacy notice the footer links to, in production's wording (imDev2023/Stoker-Markets#131). DRAFT: written from
 * what the site actually does (one cookie for the scheme, browser storage for the disclaimer, Cloudflare's request
 * logs, Arweave for images); the owner approves this text before the site opens.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      sections={[["none", "No account, no tracking"], ["servers", "What the servers see"], ["chain", "What the chain keeps"], ["others", "Who else is involved"], ["contact", "Contact"]]}
    >
      <h2 id="none">No account, no tracking</h2>
      <p>Stoker has no accounts. The site sets one cookie, which holds your light-or-dark choice, and keeps your acknowledgement of the disclaimer in your browser&apos;s own storage. There are no analytics scripts and no advertising trackers.</p>

      <h2 id="servers">What the servers see</h2>
      <p>Like any website, the site and the API record each request (its address, browser and the page or endpoint asked for) in Cloudflare&apos;s logs, kept briefly to run the service and to stop abuse. The API may read the country a request comes from, as Cloudflare reports it, to decide which features are offered where.</p>

      <h2 id="chain">What the chain keeps</h2>
      <p>Launches, trades, wallet addresses and payments are read from the Solana blockchain, which is public and permanent; the site shows them but cannot change or delete them. A coin&apos;s image and metadata are stored on Arweave at launch, where they are public and permanent too.</p>

      <h2 id="others">Who else is involved</h2>
      <p>The site runs on Cloudflare; chain data comes from Helius and public Solana RPC nodes; prices and routes come from Jupiter; permanent storage goes through ArDrive Turbo to Arweave; your wallet is provided by its own maker. Each of these sees what it needs to serve the request and has its own privacy terms.</p>

      <h2 id="contact">Contact</h2>
      <p>Questions about this notice go to <a href={`mailto:${SITE_LINKS.email}`}>{SITE_LINKS.email}</a>.</p>
    </LegalPage>
  );
}
