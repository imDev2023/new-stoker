// What the seeded stack shows in the shell, at desktop and phone width, light and dark: the pulse strip with the seed's
// real figures, the welcome on a first visit and the account menu, Explore's board seeded, filtered by an asset,
// searched and watchlisted, and a coin's page in each of its states, against committed baselines.
import type { Page } from "@playwright/test";
import { coinImage, expect, listLaunches, QUOTES, test } from "./fixtures";
import { DIALOG_STYLES, dynamic, snap } from "./shots";
import { connectTestWallet, TEST_WALLET_NAME } from "./wallet";
import { REWARD_HOLDER } from "./seedData";

test("pulse", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("[data-pulse]")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  // The window, not the page: the strip under the header with the top of the page beneath it.
  await expect(page).toHaveScreenshot("pulse.png", { mask: dynamic(page) });
});

test.describe("a first visit", () => {
  test.use({ firstVisit: true });

  test("welcome", async ({ page }) => {
    await page.goto("/terms");
    const welcome = page.getByRole("dialog", { name: "Welcome to Stoker" });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("button", { name: "Continue" })).toBeFocused();
    await expect(welcome.locator("img")).toHaveJSProperty("complete", true);
    await page.evaluate(() => document.fonts.ready);
    // The dialog on its own, the page hidden under it (dialog.css).
    await expect(welcome).toHaveScreenshot("welcome.png", { stylePath: DIALOG_STYLES });
  });
});

test("account menu", async ({ page, wallet }) => {
  await page.goto("/risk");
  const header = page.getByRole("banner");
  const connect = header.getByRole("button", { name: "Connect wallet" });
  const item = page.getByRole("menuitem", { name: TEST_WALLET_NAME });
  await expect(async () => {
    if (!(await item.isVisible())) await connect.click();
    await expect(item).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("menuitem", { name: "Dark mode" }).or(page.getByRole("menuitem", { name: "Light mode" }))).toBeEnabled();
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("menu.png", { mask: dynamic(page) });

  await page.keyboard.press("Escape");
  await connectTestWallet(page, connect);
  const account = header.getByRole("button", { name: /…/ });
  await expect(account).toContainText(wallet.keypair.publicKey.toBase58().slice(0, 4));
  await account.click();
  await expect(page.getByRole("menuitem", { name: "Disconnect" })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("menu-connected.png", { mask: dynamic(page) });
});

test("home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Figures" }).getByRole("term")).toHaveText(["Assets", "Coins", "Graduated", "24h volume"]);
  await expect(page.getByRole("table", { name: "Trending" }).getByRole("row")).toHaveCount(6);
  // A coin's line is drawn from hourly candles, so where an hour fell during the seed moves it: masked, like a time.
  await snap(page, "home-seeded.png", (p) => [...dynamic(p), p.locator("[data-spark]").filter({ visible: true })]);
});

test("not found with the pulse", async ({ page }) => {
  await page.goto("/nothing-here");
  await expect(page.locator("[data-pulse]")).toBeVisible();
  await snap(page, "404-seeded.png");
});

/** The board's trend lines are drawn from hourly candles, so whether a seeded coin has one depends on the hour the seed ran. */
const boardMask = (page: Page) => [...dynamic(page), page.locator("[data-spark]")];
const paired = (page: Page) => page.getByRole("radiogroup", { name: "Paired with" });
const coinRows = (page: Page) => page.getByRole("table", { name: "Coins" }).locator("tbody tr");

test.describe("the board", () => {
  test("seeded", async ({ page }) => {
    await page.goto("/coins");
    await expect(coinRows(page).first()).toBeVisible();
    await snap(page, "coins-seeded.png", boardMask);
  });

  test("filtered by an asset", async ({ page }) => {
    await page.goto("/coins");
    await paired(page).locator("label").filter({ hasText: /^Currencies$/ }).click();
    await expect(page).toHaveURL(/category=stablecoin/);
    await expect(coinRows(page)).toHaveCount(1);
    await expect(coinRows(page).first()).toContainText("USDP/USDC");
    await snap(page, "coins-currencies.png", boardMask);
  });

  test("searched", async ({ page }) => {
    await page.goto("/coins");
    await page.getByRole("searchbox", { name: "Search" }).fill("harbor");
    await expect(page).toHaveURL(/q=harbor/);
    await expect(coinRows(page)).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search" }).blur();
    await snap(page, "coins-searched.png", boardMask);
  });

  test("watchlisted", async ({ page }) => {
    await page.goto("/coins");
    for (const symbol of ["HRBR", "GOWN"]) {
      const star = page.getByRole("button", { name: `Watch ${symbol}`, exact: true });
      await star.click();
      await expect(star).toHaveAttribute("aria-pressed", "true");
    }
    await page.getByRole("checkbox", { name: "Watchlist" }).check({ force: true });
    await expect(coinRows(page)).toHaveCount(2);
    await snap(page, "coins-watchlist.png", boardMask);
  });
});

test.describe("an asset's page", () => {
  for (const [name, quote, coin] of [["asset-stock.png", "NVDAx", "CHPX/NVDAx"], ["asset-usdc.png", "USDC", "USDP/USDC"]] as const) {
    test(`${quote}, with the coin paired with it`, async ({ page }) => {
      await page.goto(`/asset/${QUOTES[quote].toBase58()}`);
      await expect(page.getByRole("heading", { level: 1, name: quote })).toBeVisible();
      const paired = page.getByRole("table", { name: `Coins paired with ${quote}` });
      await expect(paired.locator("tbody tr")).toHaveCount(1);
      await expect(paired.locator("tbody tr").first()).toContainText(coin);
      await snap(page, name, boardMask);
    });
  }
});

/** A seeded coin's address, by its ticker. */
async function seeded(symbol: string) {
  const launch = (await listLaunches()).find((l) => l.symbol === symbol);
  if (!launch) throw new Error(`the seed has no ${symbol}`);
  return launch.mint;
}

/** What varies on a coin page besides the suite's own: the chart, whose candles fall either side of an interval by the seed's timing. */
const coinMask = (page: Page) => [...dynamic(page), page.locator("[data-chart]")];

// A coin's page in each state the seed leaves one in: fresh off the form, traded, paired with USDC (with Pay with),
// sold out and graduating, graduated into its pool, and the longest name and ticker.
for (const [name, symbol] of [
  ["coin-fresh", "FRST"], ["coin-traded", "HRBR"], ["coin-usdc", "USDP"], ["coin-graduating", "$FIRE"], ["coin-graduated", "GOWN"],
  ["coin-longest", "WWWWWWWWWW"],
] as const) {
  test(name, async ({ page }) => {
    await page.goto(`/coin/${await seeded(symbol)}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(symbol);
    // The marks read the chain's holders and the trust figures: wait for the Creator's and the snipers'.
    await expect(page.getByRole("list", { name: "Before you buy" }).getByRole("listitem")).not.toHaveCount(0);
    await snap(page, `${name}.png`, coinMask);
  });
}

test("coin not found", async ({ page }) => {
  // A valid address no coin has.
  await page.goto("/coin/11111111111111111111111111111112");
  await expect(page.getByRole("heading", { name: "This coin isn't here." })).toBeVisible();
  await snap(page, "coin-not-found.png");
});

// The records on the seeded stack (#11): the seed's Fee Collector run is on the Ledger, the Flywheel has a graduated coin
// to pick, and the fee changes are in each of their states. The Burn itself runs in the flows, so no coin's page moves here.
test.describe("the records", () => {
  /** The daily bars split at UTC midnight, and a sweep's amount wavers by a few lamports between runs (CLAUDE.md, Traps). */
  const recordsMask = (page: Page) => [...dynamic(page), page.locator("[data-bars]"), page.locator("[data-wavers]").filter({ visible: true })];

  test("stats", async ({ page }) => {
    await page.goto("/revenue");
    await expect(page.getByRole("region", { name: "Figures" }).getByRole("term")).toHaveText(["Revenue, all time", "Sent to Creators", "Of revenue to the Burn"]);
    await expect(page.getByRole("heading", { name: "Daily revenue" })).toBeVisible();
    const ledger = page.getByRole("table", { name: "Ledger" });
    await expect(ledger.locator("tbody tr").first()).toBeVisible();
    await expect(ledger.locator('tbody tr[data-kind="sweep"]').first()).toBeVisible();
    await snap(page, "revenue-seeded.png", recordsMask);
  });

  test("burns", async ({ page }) => {
    await page.goto("/burns");
    await expect(page.getByRole("region", { name: "Figures" }).getByRole("term")).toHaveText(["Revenue so far"]);
    await expect(page.getByRole("region", { name: "The Flywheel's next picks" }).getByRole("link")).toHaveText(["GOWN"]);
    await snap(page, "burns-seeded.png");
  });

  test("fee changes", async ({ page }) => {
    await page.goto("/announcements");
    const changes = page.getByRole("list", { name: "Fee changes" }).getByRole("listitem");
    await expect(changes).toHaveCount(3);
    // Newest effective date first: announced a month ahead, due and waiting for the admin, applied.
    await expect(changes.nth(0)).toContainText("Announced");
    await expect(changes.nth(1)).toContainText("Due");
    await expect(changes.nth(2).getByRole("link", { name: "Applied" })).toBeVisible();
    await snap(page, "announcements-seeded.png");
  });
});

// Holder rewards looked up for the seeded Reward Launch's one holder (#12): the round the seed's Reward Engine run paid,
// in SOL, linked to its transaction.
test("rewards of a wallet", async ({ page }) => {
  const holder = REWARD_HOLDER.publicKey.toBase58();
  await page.goto(`/rewards?wallet=${holder}`);
  await expect(page.getByRole("textbox", { name: "Wallet address" })).toHaveValue(holder);
  const rows = page.getByRole("table", { name: "Rewards" }).getByRole("row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("YLD");
  await expect(rows.first().getByRole("link", { name: /SOL$/ })).toHaveAttribute("href", /\/tx\//);
  await page.getByRole("textbox", { name: "Wallet address" }).blur();
  await snap(page, "rewards-wallet.png");
});

// The launch form filled in by a connected Creator: the picture, the name and ticker with Copy Protection's verdicts, a
// Reward Launch, a link and a First Buy, with the summary following every field.
test("launch filled", async ({ page, wallet }) => {
  await page.goto("/launch");
  const summary = page.getByRole("complementary", { name: "Launch summary" });
  await connectTestWallet(page, summary.getByRole("button", { name: "Connect wallet" }));
  const form = page.getByRole("form", { name: "Stoke a coin" });
  await form.getByLabel("Add image").setInputFiles({ name: "TRCR.png", mimeType: "image/png", buffer: coinImage("TRCR") });
  await form.getByRole("textbox", { name: "Name" }).fill("Tracer Bullet");
  await form.getByRole("textbox", { name: "Ticker" }).fill("TRCR");
  await form.getByRole("textbox", { name: "Description" }).fill("A coin for the first shot that shows where the rest will land.");
  await form.getByRole("radiogroup", { name: "Launch type" }).locator("label").filter({ hasText: "paid in the coin" }).click();
  await form.getByRole("textbox", { name: "Telegram" }).fill("https://t.me/tracerbullet");
  await form.getByLabel("First buy").fill("0.25");
  // The copy check's verdicts and the First Buy's quote arrive from the API: wait for every one before the shot.
  for (const field of ["name", "symbol", "image"]) await expect(page.locator(`[data-copy="${field}"]`)).toBeVisible();
  await expect(summary.getByText(/^[\d,]+ TRCR \([\d.]+%\)$/)).toBeVisible();
  await expect(summary.getByRole("button", { name: "Stoke TRCR" })).toBeEnabled();
  await form.getByLabel("First buy").blur();
  expect(wallet.requests).toHaveLength(0);
  await snap(page, "launch-filled.png");
});
