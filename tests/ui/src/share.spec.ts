// Share previews and search (#14, production's Stoker-Markets#83): every page names itself (a title, a description, one
// canonical address) and carries the Open Graph and Twitter cards with a drawn image, so a link pasted on X or Telegram
// unfurls; the site has a sitemap, a robots file and its icons; and a coin's, an asset's and a stock's links unfurl with
// cards of their own.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import { expect, fundedKeypair, launchViaApi, listLaunches, QUOTES, test } from "./fixtures";

const NVDAX = QUOTES.NVDAx.toBase58();
const USDC = QUOTES.USDC.toBase58();
const SITE_TITLE = "Stoker · Launch a coin on Solana priced in the asset you pick";

/** A head tag, whether it is named with `name` or `property`. */
const meta = (page: Page, key: string) => page.locator(`head meta[name="${key}"], head meta[property="${key}"]`);
const link = (page: Page, rel: string) => page.locator(`head link[rel="${rel}"]`);

/** The structured data a page carries, parsed. */
const jsonLd = (page: Page) =>
  page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => nodes.map((n) => JSON.parse(n.textContent ?? "null") as Record<string, unknown>));

/** A PNG's size, from its header. */
const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

/**
 * The page's share image: named on its Open Graph and Twitter cards, answered as a PNG of the Open Graph size. The path
 * is fetched on the stack's own address: `next dev` names every file-based image at `localhost` whatever the request's
 * host, where a production build resolves it against the page's `metadataBase` (CLAUDE.md, Traps).
 */
async function shareCard(page: Page, base: string) {
  const named = await meta(page, "og:image").getAttribute("content");
  expect(named, "og:image").toBeTruthy();
  const url = new URL(named!);
  await expect(meta(page, "og:image:width")).toHaveAttribute("content", "1200");
  await expect(meta(page, "og:image:height")).toHaveAttribute("content", "630");
  await expect(meta(page, "og:image:alt")).toHaveAttribute("content", /\S/);
  // X reads its own tags; the same image serves it.
  await expect(meta(page, "twitter:card")).toHaveAttribute("content", "summary_large_image");
  await expect(meta(page, "twitter:image")).toHaveAttribute("content", named!);
  const res = await page.request.get(`${base}${url.pathname}${url.search}`);
  expect(res.status(), named!).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  const png = await res.body();
  expect(pngSize(png)).toEqual({ width: 1200, height: 630 });
  return { path: url.pathname, png };
}

/** The head every page has: its tab's title on both cards, its one canonical address on the Open Graph card too. */
async function namesItself(page: Page, base: string, path: string, title: string) {
  await expect(page).toHaveTitle(title);
  await expect(link(page, "canonical")).toHaveAttribute("href", path === "/" ? base : `${base}${path}`);
  await expect(meta(page, "og:url")).toHaveAttribute("content", path === "/" ? base : `${base}${path}`);
  await expect(meta(page, "og:title")).toHaveAttribute("content", title);
  await expect(meta(page, "twitter:title")).toHaveAttribute("content", title);
  await expect(meta(page, "og:site_name")).toHaveAttribute("content", "Stoker");
  await expect(meta(page, "og:type")).toHaveAttribute("content", "website");
  const description = await meta(page, "description").getAttribute("content");
  expect(description, `${path} description`).toBeTruthy();
  await expect(meta(page, "og:description")).toHaveAttribute("content", description!);
  await expect(meta(page, "twitter:description")).toHaveAttribute("content", description!);
}

test("the home page names itself with the proposition, the site's card and its structured data", async ({ page, stack }) => {
  const base = stack.webUrl!;
  await page.goto("/");
  await namesItself(page, base, "/", SITE_TITLE);
  await expect(meta(page, "description")).toHaveAttribute("content", /^No one picks your pair\. You do\. Launch a coin on Solana/);
  await expect(meta(page, "twitter:site")).toHaveAttribute("content", "@stokermarkets");
  // The icons: the ico for the browsers that want one, the SVG and the PNG for the rest, the touch icon for a phone.
  await expect(link(page, "icon")).toHaveCount(3);
  await expect(link(page, "icon").nth(0)).toHaveAttribute("href", /\/favicon\.ico/);
  await expect(link(page, "icon").nth(1)).toHaveAttribute("href", /\/icon\.svg/);
  await expect(link(page, "icon").nth(2)).toHaveAttribute("href", /\/icon\.png/);
  await expect(link(page, "apple-touch-icon")).toHaveAttribute("href", /\/apple-touch-icon\.png/);
  const site = await shareCard(page, base);
  expect(site.path).toBe("/opengraph-image");
  expect(site.png).toMatchSnapshot("share-site.png");
  const data = await jsonLd(page);
  expect(data.find((d) => d["@type"] === "WebSite")).toMatchObject({
    name: "Stoker",
    url: `${base}/`,
    potentialAction: { "@type": "SearchAction", target: { urlTemplate: `${base}/coins?q={search_term_string}` } },
  });
  expect(data.find((d) => d["@type"] === "Organization")).toMatchObject({ name: "Stoker", url: `${base}/`, logo: `${base}/icon.png`, email: "info@stoker.markets" });
});

test("every section and record names itself, a query's views point at their page, and each shares the site's card", async ({ page, stack }) => {
  const base = stack.webUrl!;
  const pages: [path: string, title: string][] = [
    ["/coins", "Explore"], ["/stocks", "Stocks"], ["/swap", "Swap"], ["/assets", "Assets"], ["/rewards", "Holder rewards"],
    ["/revenue", "Stats"], ["/curated", "Curated"], ["/api", "Developers"], ["/launch", "Stoke a coin"], ["/burns", "Burn and Flywheel"],
    ["/announcements", "Fee changes"], ["/fees", "Fees"], ["/terms", "Terms of use"], ["/privacy", "Privacy"], ["/risk", "Risk disclosure"],
  ];
  for (const [path, title] of pages) {
    await page.goto(path);
    await namesItself(page, base, path, `${title} · Stoker`);
    await expect(meta(page, "og:image"), path).toHaveAttribute("content", `${base}/opengraph-image`);
    await expect(meta(page, "twitter:image"), path).toHaveAttribute("content", `${base}/opengraph-image`);
    // The local chain is no mainnet, so every page asks not to be indexed (the root layout's rule).
    await expect(meta(page, "robots"), path).toHaveAttribute("content", /noindex/);
  }
  // A sorted, filtered or searched view, and a wallet's rewards looked up in place, point at their page.
  for (const [view, path] of [
    ["/coins?sort=new&category=stablecoin&q=abc", "/coins"],
    ["/stocks?sort=gap&issuer=xstocks", "/stocks"],
    ["/assets?category=stablecoin", "/assets"],
    [`/rewards?wallet=${Keypair.generate().publicKey.toBase58()}`, "/rewards"],
    [`/launch?quote=${USDC}`, "/launch"],
  ] as const) {
    await page.goto(view);
    await expect(link(page, "canonical"), view).toHaveAttribute("href", `${base}${path}`);
    await expect(meta(page, "og:url"), view).toHaveAttribute("content", `${base}${path}`);
  }
});

test("a coin's link unfurls with its own picture, name and pair, and its page says where it sits", async ({ page, stack }) => {
  const base = stack.webUrl!;
  const creator = await fundedKeypair();
  const mint = await launchViaApi(creator, { name: "Share Card", symbol: "SHARE", description: "A coin whose link unfurls with its picture, its name and its pair." });
  const reward = await launchViaApi(creator, { name: "Plain Reward", symbol: "PLAIN", quote: "USDC", rewardTax: "100" });

  await page.goto(`/coin/${mint}`);
  await namesItself(page, base, `/coin/${mint}`, "SHARE / SOL · Stoker");
  await expect(meta(page, "description")).toHaveAttribute("content", "A coin whose link unfurls with its picture, its name and its pair.");
  const card = await shareCard(page, base);
  expect(card.path).toMatch(new RegExp(`^/coin/${mint}/opengraph-image`));
  expect(card.png).toMatchSnapshot("share-coin.png");
  expect((await jsonLd(page)).find((d) => d["@type"] === "BreadcrumbList")).toMatchObject({
    itemListElement: [
      { position: 1, name: "Home", item: `${base}/` },
      { position: 2, name: "Explore", item: `${base}/coins` },
      { position: 3, name: "SHARE / SOL", item: `${base}/coin/${mint}` },
    ],
  });
  // A crawler that reads the HTML alone finds the card in the head, whatever it calls itself.
  for (const agent of ["TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; a reader)"]) {
    const html = await (await page.request.get(`/coin/${mint}`, { headers: { "user-agent": agent } })).text();
    expect(html.slice(0, html.indexOf("</head>")), agent).toContain('property="og:image"');
  }

  // A coin with no description of its own is described by its pair and its creator's cut, and a Reward Launch's card
  // says it is one (without its rate, a fee figure, which is the Fees page's).
  await page.goto(`/coin/${reward}`);
  await expect(meta(page, "description")).toHaveAttribute(
    "content",
    "Plain Reward (PLAIN) trades on Stoker paired with USDC; its creator earns half of what the platform collects on its trades, every payment on the public ledger.",
  );
  expect((await shareCard(page, base)).png).toMatchSnapshot("share-coin-reward.png");

  // A picture the card can't draw (WebP) gives way to the coin's letter on the gold, and the longest ticker and name fit.
  const webp = await launchViaApi(creator, {
    name: "Wide Walrus Wonderworks Holdings",
    symbol: "WWWWWWWWWW",
    quote: "NVDAx",
    image: { bytes: readFileSync(new URL("../fixtures/coin.webp", import.meta.url)), type: "image/webp", filename: "coin.webp" },
  });
  await page.goto(`/coin/${webp}`);
  expect((await shareCard(page, base)).png).toMatchSnapshot("share-coin-letter.png");

  // A coin that doesn't exist is a 404 nobody indexes, and its card's route answers 404 too.
  const missing = Keypair.generate().publicKey.toBase58();
  const res = await page.goto(`/coin/${missing}`);
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle("Coin not found · Stoker");
  const html = await (await page.request.get(`/coin/${missing}`)).text();
  expect(html.slice(0, html.indexOf("</head>"))).toMatch(/<meta name="robots" content="noindex/);
  expect((await page.request.get(`${base}${card.path.replace(mint, missing)}`)).status()).toBe(404);
});

test("an asset's and a stock's links unfurl with their own cards, each page under its section", async ({ page, stack }) => {
  const base = stack.webUrl!;
  for (const [section, path, name, kind] of [
    ["Assets", "/asset", "/assets", "asset"],
    ["Stocks", "/stock", "/stocks", "stock"],
  ] as const) {
    await page.goto(`${path}/${NVDAX}`);
    await namesItself(page, base, `${path}/${NVDAX}`, "NVDAx · Stoker");
    const card = await shareCard(page, base);
    expect(card.path).toMatch(new RegExp(`^${path}/${NVDAX}/opengraph-image`));
    expect(card.png).toMatchSnapshot(`share-${kind}.png`);
    expect((await jsonLd(page)).find((d) => d["@type"] === "BreadcrumbList")).toMatchObject({
      itemListElement: [
        { position: 1, name: "Home", item: `${base}/` },
        { position: 2, name: section, item: `${base}${name}` },
        { position: 3, name: "NVDAx", item: `${base}${path}/${NVDAX}` },
      ],
    });
    // An address that is no such asset is a 404, its card too.
    const missing = Keypair.generate().publicKey.toBase58();
    expect((await page.request.get(`${base}${card.path.replace(NVDAX, missing)}`)).status(), kind).toBe(404);
  }
  // USDC is an asset but no stock: the stock page's card answers 404 for it, as the page does.
  await page.goto(`/asset/${USDC}`);
  const usdc = await shareCard(page, base);
  expect(usdc.png).toMatchSnapshot("share-asset-usdc.png");
  expect((await page.request.get(`${base}${usdc.path.replace("/asset/", "/stock/")}`)).status()).toBe(404);
});

test("the sitemap lists every page, coin, asset and stock, the robots file names it, and the icons answer", async ({ page, stack }) => {
  const base = stack.webUrl!;
  const coins = await listLaunches();
  expect(coins.length).toBeGreaterThan(0);
  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toMatch(/xml/);
  const xml = await sitemap.text();
  for (const path of [
    "/", "/coins", "/stocks", "/swap", "/assets", "/rewards", "/revenue", "/curated", "/api", "/launch", "/burns", "/announcements", "/fees",
    "/terms", "/privacy", "/risk",
  ]) {
    expect(xml, path).toContain(`<loc>${base}${path}</loc>`);
  }
  for (const coin of coins) expect(xml, coin.symbol).toContain(`<loc>${base}/coin/${coin.mint}</loc>`);
  expect(xml).toContain(`<loc>${base}/asset/${USDC}</loc>`);
  expect(xml).toContain(`<loc>${base}/asset/${NVDAX}</loc>`);
  expect(xml).toContain(`<loc>${base}/stock/${NVDAX}</loc>`);
  expect(xml).not.toContain(`/stock/${USDC}`);
  expect(xml).not.toContain("/operator");
  expect(xml).not.toContain("/creator");

  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe(`User-Agent: *\nAllow: /\nDisallow: /operator\nDisallow: /creator\n\nSitemap: ${base}/sitemap.xml\n`);

  for (const [path, type] of [
    ["/favicon.ico", /^image\/(x-icon|vnd\.microsoft\.icon)/],
    ["/icon.svg", /^image\/svg\+xml/],
    ["/icon.png", /^image\/png/],
    ["/apple-touch-icon.png", /^image\/png/],
  ] as const) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(200);
    expect(res.headers()["content-type"], path).toMatch(type);
  }
});
