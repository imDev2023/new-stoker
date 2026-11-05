// What the seeded stack shows in the shell, at desktop and phone width, light and dark: the pulse strip with the seed's
// real figures, the welcome on a first visit and the account menu, and Explore's board seeded, filtered by an asset,
// searched and watchlisted, against committed baselines.
import type { Page } from "@playwright/test";
import { expect, QUOTES, test } from "./fixtures";
import { DIALOG_STYLES, dynamic, snap } from "./shots";
import { connectTestWallet, TEST_WALLET_NAME } from "./wallet";

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
