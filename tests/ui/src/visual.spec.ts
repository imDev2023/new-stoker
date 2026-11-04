// What the seeded stack shows in the shell, at desktop and phone width, light and dark: the pulse strip with the seed's
// real figures, the welcome on a first visit and the account menu, against committed baselines.
import { expect, test } from "./fixtures";
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
