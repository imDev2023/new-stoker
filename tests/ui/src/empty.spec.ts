// The shell and the static pages before anything has launched, at desktop and phone width, light and dark: every control
// is there, and the pulse strip waits for a real figure.
import { BurnsPage, FeeAnnouncementList, QuoteAssetList, Revenue } from "@launchpad/contract";
import { expect, platformInfo, stackEnv, test } from "./fixtures";
import { dynamic, snap } from "./shots";

test("home", async ({ page, stack }) => {
  const quotes = QuoteAssetList.parse(await (await fetch(`${stack.apiUrl}/v1/quotes`)).json());
  const launchable = quotes.quotes.filter((q) => q.launchable).length;
  expect(launchable).toBeGreaterThan(0);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No one picks your pair. You do.");
  // Every control is there before anything has launched: both ways to launch and the way to the board.
  await expect(page.getByRole("main").getByRole("link", { name: "Stoke a coin" })).toHaveCount(2);
  await expect(page.getByRole("main").getByRole("link", { name: "Explore coins" })).toBeVisible();
  for (const name of ["All assets", "Every fee", "The public ledger"]) await expect(page.getByRole("link", { name })).toBeVisible();
  // The roll is held on its first asset under reduced motion, which every screenshot project asks for.
  await expect(page.locator("[data-roll] span span").first()).toHaveText("SOL");
  await expect(page.locator("[data-roll] > span")).toHaveCSS("animation-name", "none");
  // The assets are real before the first coin; the rest of the figures, Trending and the strip wait for real values.
  const figures = page.getByRole("region", { name: "Figures" });
  await expect(figures.getByRole("term")).toHaveText(["Assets"]);
  await expect(figures.getByRole("definition")).toHaveText(launchable.toLocaleString("en-US"));
  await expect(page.getByRole("heading", { name: "Trending" })).toHaveCount(0);
  await expect(page.locator("[data-pulse]")).toHaveCount(0);
  await snap(page, "home.png");
});

const DOCUMENTS = [
  ["/terms", "terms", "Terms of use"],
  ["/privacy", "privacy", "Privacy"],
  ["/risk", "risk", "Risk disclosure"],
] as const;

for (const [path, name, title] of DOCUMENTS) {
  test(`${name} page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Stoke a coin" })).toBeVisible();
    // Nothing has launched or traded, so no figure is real yet and the strip stays out.
    await expect(page.locator("[data-pulse]")).toHaveCount(0);
    await snap(page, `${name}.png`);
  });
}

test("not found", async ({ page }) => {
  const res = await page.goto("/nothing-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Nothing here." })).toBeVisible();
  await snap(page, "404.png");
});

test("the board before the first coin", async ({ page }) => {
  await page.goto("/coins");
  await expect(page.getByRole("heading", { level: 1, name: "Coins" })).toBeVisible();
  // Every control is there before the first coin (the owner's rule of 2026-10-07); only the rows wait.
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Watchlist" })).not.toBeChecked();
  await expect(page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio")).toHaveCount(4);
  await expect(page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio", { name: "Market cap" })).toBeChecked();
  await expect(page.getByRole("radiogroup", { name: "Paired with" }).locator("label")).toHaveText([
    "All", "Solana", "Currencies", "Stocks", "Wrapped", "DeFi", "Real-world assets", "Leverage", "Collectibles", "Memes", "Community",
  ]);
  // With nothing launched the page ends at the controls: no table, and no placeholder sentence.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("Nothing matches.")).toHaveCount(0);
  await snap(page, "coins.png");

  // A search on an empty board finds nothing, and says so.
  await page.getByRole("searchbox", { name: "Search" }).fill("anything");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
});

const KIND_CHIPS = ["All", "Solana", "Currencies", "Stocks", "Wrapped", "DeFi", "Real-world assets", "Leverage", "Collectibles", "Memes", "Community"];

test("assets before the first coin", async ({ page, stack }) => {
  const quotes = QuoteAssetList.parse(await (await fetch(`${stack.apiUrl}/v1/quotes`)).json()).quotes;
  expect(quotes.length).toBeGreaterThan(0);
  await page.goto("/assets");
  await expect(page.getByRole("heading", { level: 1, name: "Assets" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  // Every kind is a chip, whatever the registry quotes today, as on Explore.
  await expect(page.getByRole("radiogroup", { name: "Kind" }).locator("label")).toHaveText(KIND_CHIPS);
  // The registry quotes assets before any coin launches: every one of them is a row, under its kind.
  const table = page.getByRole("table", { name: "Assets" });
  await expect(table.locator("tbody tr[data-mint]")).toHaveCount(quotes.length);
  await expect(table.locator("th[scope=colgroup]").first()).toHaveText("Solana");
  await snap(page, "assets.png");
});

test("an asset before the first coin", async ({ page }) => {
  await page.goto("/asset/So11111111111111111111111111111111111111112");
  await expect(page.getByRole("heading", { level: 1, name: "SOL" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stoke a coin paired with SOL" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Risk labels" })).toBeVisible();
  // Nothing is paired with it yet, so the section waits.
  await expect(page.getByRole("heading", { name: "Coins paired with it" })).toHaveCount(0);
  await snap(page, "asset-sol.png");
});

test("an asset that isn't quoted", async ({ page }) => {
  const res = await page.goto("/asset/11111111111111111111111111111111");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This asset isn't quoted." })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "All assets" })).toHaveAttribute("href", "/assets");
  await snap(page, "asset-404.png");
});

test("swap", async ({ page }) => {
  await page.goto("/swap");
  await expect(page.getByRole("heading", { level: 1, name: "Swap" })).toBeVisible();
  // The suite serves Jupiter's script empty, so the frame says where the swap is instead; no shot carries a live one.
  await expect(page.getByRole("status")).toHaveText("Jupiter's swap did not load here. Open jup.ag instead.");
  // No referral account on the stack: no fee of ours, so no fee line.
  await expect(page.getByText("Routed by Jupiter.", { exact: true })).toBeVisible();
  await snap(page, "swap.png");
});

/** A rate as the Fees page writes it (apps/web/src/lib/fees.ts). */
const pct = (bps: number) => `${Number((bps / 100).toFixed(3))}%`;
const api = async <T>(path: string, schema: { parse: (v: unknown) => T }) => schema.parse(await (await fetch(`${stackEnv().apiUrl}${path}`)).json());

test("fees", async ({ page }) => {
  const platform = await platformInfo();
  const burns = await api("/v1/burns", BurnsPage);
  await page.goto("/fees");
  await expect(page.getByRole("heading", { level: 1, name: "Fees" })).toBeVisible();
  const fees = page.getByRole("list", { name: "Every fee" });
  // Every fee in the spec's order; the stack has a SOL route and a Graduation Fee, and no referral account, so no swap fee.
  await expect(fees.getByRole("heading", { level: 3 })).toHaveText([
    "Creating a coin", "Graduation Fee", "Platform Fee on the curve", "Creator Fee on the curve", "Raydium's curve fee", "Referral share",
    "Pool creator fee", "Pool trade fee", "Reward Tax", "Buying with SOL a coin paired with another asset", "Network fees and rent",
  ]);
  // Every rate is the chain's, as the API reads it now, never a constant.
  const figure = (id: string) => page.locator(`[data-fee="${id}"] > span`);
  await expect(figure("graduation")).toHaveText(`${Number(platform.graduationFeeLamports) / 1e9} SOL's worth, once`);
  await expect(figure("platform")).toHaveText(`${pct(platform.platformFeeBps)} of every trade`);
  await expect(figure("creator")).toHaveText(platform.creatorFeeBps === 0 ? "None" : `${pct(platform.creatorFeeBps)} of every trade`);
  await expect(figure("raydiumCurve")).toHaveText(`${pct(platform.raydiumFee.curveBps)} of every trade`);
  await expect(figure("referral")).toHaveText(`${pct(platform.referralShareBps)} of a referred trade`);
  await expect(figure("poolCreator")).toHaveText(`${pct(platform.poolCreatorFeeBps)} of every trade`);
  await expect(figure("pool")).toHaveText(`${pct(platform.raydiumFee.poolBps)} of every trade`);
  await expect(figure("rewardTax")).toHaveText("1%, 3% or 5% of every transfer");
  await expect(page.locator('[data-fee="route"] p')).toContainText(`up to ${pct(platform.solRouteToleranceBps)} under the current price`);
  // What the platform does with its share, the Burn's two shares from GET /v1/burns.
  const share = page.getByRole("region", { name: "What the platform does with its share" });
  await expect(share.getByRole("definition")).toHaveText([
    "Half, within an hour", `${pct(burns.shares.burnBps)} buys and burns STOKER`,
    `${pct(burns.shares.flywheelBps)} buys and burns the top ${burns.shares.flywheelTopN}`, "The rest, hourly",
  ]);
  // The rail beside the entries, which a phone leaves out (the spec's .doc nav under 860px).
  const rail = page.getByRole("navigation", { name: "On this page", includeHidden: true }).getByRole("link", { includeHidden: true });
  await expect(rail).toHaveText(["Every fee", "What the platform does with its share"]);
  await snap(page, "fees.png");
});

test("stats before the first coin", async ({ page }) => {
  const revenue = await api("/v1/revenue", Revenue);
  expect(revenue.totals).toEqual([]);
  await page.goto("/revenue");
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Burn and Flywheel" })).toHaveAttribute("href", "/burns");
  // Nothing collected yet: the Burn's share is the one real figure, and it links to where the share is set out.
  const figures = page.getByRole("region", { name: "Figures" });
  await expect(figures.getByRole("term")).toHaveText(["Of revenue to the Burn"]);
  await expect(figures.getByRole("link")).toHaveAttribute("href", "/fees#share");
  for (const name of ["Daily revenue", "By asset", "Ledger"]) await expect(page.getByRole("heading", { name })).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  // The wallets the revenue moves between are real from the start.
  const where = page.getByRole("region", { name: "Where it goes" });
  await expect(where.getByRole("term")).toHaveText(["To Creators", "Operations wallet", "Treasury", "Swept above"]);
  await snap(page, "revenue.png");
});

test("burns before the first coin", async ({ page }) => {
  const burns = await api("/v1/burns", BurnsPage);
  await page.goto("/burns");
  await expect(page.getByRole("heading", { level: 1, name: "Burn and Flywheel" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Stats" })).toHaveAttribute("href", "/revenue");
  // No revenue, no run and no graduated coin: only the published rule.
  await expect(page.getByRole("region", { name: "Figures" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "The rule" }).locator("p")).toHaveText(burns.rule);
  for (const name of ["The Flywheel's next picks", "Every buy and burn"]) await expect(page.getByRole("heading", { name })).toHaveCount(0);
  await snap(page, "burns.png");
});

test("fee changes before any", async ({ page }) => {
  expect((await api("/v1/announcements", FeeAnnouncementList)).announcements).toEqual([]);
  await page.goto("/announcements");
  await expect(page.getByRole("heading", { level: 1, name: "Fee changes" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Fees now" })).toHaveAttribute("href", "/fees");
  await expect(page.getByText("No fee change has ever been announced.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Fee changes" })).toHaveCount(0);
  await snap(page, "announcements.png");
});

test("the launch form before the first coin", async ({ page }) => {
  await page.goto("/launch");
  await expect(page.getByRole("heading", { level: 1, name: "Stoke a coin" })).toBeVisible();
  // Every control is there before anything has launched: the coin, the recommended three and the picker, the four
  // launch types (Holder rewards not yet), the links, the First Buy, and the summary's own Connect wallet.
  const form = page.getByRole("form", { name: "Stoke a coin" });
  for (const group of ["Your coin", "Paired with", "Launch type", "Links", "First buy"]) await expect(form.getByRole("group", { name: group })).toBeVisible();
  await expect(form.getByRole("radiogroup", { name: "Paired with" }).getByRole("radio")).toHaveCount(3);
  await expect(form.getByRole("radiogroup", { name: "Launch type" }).getByRole("radio")).toHaveCount(4);
  await expect(form.getByRole("combobox", { name: "Any other asset" })).toBeVisible();
  const summary = page.getByRole("complementary", { name: "Launch summary" });
  await expect(summary.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  // No fee figure: what a Creator earns is a link to the Fees page (production's rule, the map's open question 1).
  await expect(summary.getByRole("link", { name: "Half of what we collect" })).toHaveAttribute("href", "/fees");
  await expect(summary.getByText("Per $1,000 traded")).toHaveCount(0);
  await snap(page, "launch.png");
});

test("holder rewards before the first coin", async ({ page }) => {
  await page.goto("/rewards");
  await expect(page.getByRole("heading", { level: 1, name: "Holder rewards" })).toBeVisible();
  const steps = page.getByRole("region", { name: "How holders are paid" });
  await expect(steps.getByRole("heading", { level: 3 })).toHaveText(["A tax on every transfer", "Collected into rounds", "Paid by holding"]);
  // The Reward Tax's rates are fee figures, which only the Fees page shows (owner, 2026-10-30): the step links there.
  await expect(steps.getByRole("link", { name: "Fees" })).toHaveAttribute("href", "/fees#rewardTax");
  await expect(steps).not.toContainText("%");
  // The lookup is a control, there before any reward; nothing is looked up yet, so no table and no note.
  const lookup = page.getByRole("form", { name: "Look up a wallet's rewards" });
  await expect(lookup.getByRole("textbox", { name: "Wallet address" })).toBeVisible();
  await expect(lookup.getByRole("button", { name: "Show" })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  // The first rules version is in force from the start (migration 0009), and the treasury counts as a holder.
  const rules = page.getByRole("region", { name: "Rules in force" });
  await expect(rules.getByRole("term")).toHaveText(["Version", "Minimum holding", "A round runs once", "Holders", "In force since"]);
  await expect(rules.getByRole("definition").first()).toHaveText("1");
  await expect(rules.getByRole("definition").nth(1)).toHaveText("10,000 coins");
  await expect(rules.getByRole("definition").nth(2)).toHaveText("100,000 coins of tax have collected");
  await expect(rules.getByRole("link", { name: "the treasury" })).toHaveAttribute("href", "/revenue#where");
  await expect(page.getByRole("heading", { name: "Announced changes" })).toHaveCount(0);
  await snap(page, "rewards.png");
});

test("curated", async ({ page }) => {
  await page.goto("/curated");
  await expect(page.getByRole("heading", { level: 1, name: "Curated" })).toBeVisible();
  await expect(page.getByText("Soon", { exact: true })).toBeVisible();
  const steps = page.getByRole("region", { name: "How an allocation is earned" });
  await expect(steps.getByRole("heading", { level: 3 })).toHaveText(["Stake STOKER", "Your allocation follows your stake", "Every launch is approved first"]);
  await expect(page.getByRole("heading", { level: 2, name: "The first Curated launch is announced here." })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Explore coins" })).toHaveAttribute("href", "/coins");
  await snap(page, "curated.png");
});

test("developers", async ({ page, stack }) => {
  const platform = await (await fetch(`${stack.apiUrl}/v1/platform`)).json();
  await page.goto("/api");
  await expect(page.getByRole("heading", { level: 1, name: "The API" })).toBeVisible();
  const rail = page.getByRole("navigation", { name: "On this page", includeHidden: true }).getByRole("link", { includeHidden: true });
  await expect(rail).toHaveText([
    "Quickstart", "Reading", "Preparing transactions", "Sign, send, report", "Referrals", "Keys and limits", "Errors", "The operator's endpoints",
  ]);
  // The quickstart asks the API this page reads, and its answer is that API's own, for this page view.
  const start = page.getByRole("region", { name: "Quickstart" });
  await expect(start.locator("pre").first()).toHaveText(`curl ${stack.apiUrl}/v1/platform`);
  expect(JSON.parse(await start.locator("[data-answer]").innerText())).toEqual(platform);
  // No rate outside the Fees page: the referral share is named by its field, never written out.
  await expect(page.getByRole("region", { name: "Referrals" })).not.toContainText("%");
  // The stack's address and the chain's own addresses are in the quickstart: masked.
  await snap(page, "api.png", (p) => [...dynamic(p), p.locator("[data-live]")]);
});
