// The landing against the seeded stack's API: its figures are the API's, Trending is the API's trending coins that have
// traded, each row leads to its coin, and the pair rolls when motion is allowed.
import { LaunchList, PlatformStats, QuoteAssetList } from "@launchpad/contract";
import { expect, test } from "./fixtures";

test("the figures are the platform's own", async ({ page, stack }) => {
  const [stats, quotes] = await Promise.all([
    fetch(`${stack.apiUrl}/v1/stats`).then(async (r) => PlatformStats.parse(await r.json())),
    fetch(`${stack.apiUrl}/v1/quotes`).then(async (r) => QuoteAssetList.parse(await r.json())),
  ]);
  await page.goto("/");
  const figures = page.getByRole("region", { name: "Figures" });
  await expect(figures.getByRole("definition")).toHaveText([
    quotes.quotes.filter((q) => q.launchable).length.toLocaleString("en-US"),
    stats.launches.toLocaleString("en-US"),
    stats.graduated.toLocaleString("en-US"),
    /^[\d.,KM]+SOL$/,
  ]);
});

test("Trending lists the most traded coins, each leading to its page", async ({ page, stack }) => {
  const trending = LaunchList.parse(await (await fetch(`${stack.apiUrl}/v1/launches?sort=trending&limit=5`)).json());
  const traded = trending.launches.filter((l) => l.market.change24h !== null);
  expect(traded.length).toBeGreaterThan(0);
  await page.goto("/");
  const rows = page.getByRole("table", { name: "Trending" }).getByRole("row");
  await expect(rows).toHaveCount(traded.length + 1);
  // The compact table: the board's star, curve and age stay on Explore.
  await expect(page.getByRole("table", { name: "Trending" }).getByRole("columnheader")).toHaveText(["Coin", "Price", "24h", "Trend", "Volume", "Market cap"]);
  for (const [i, launch] of traded.entries()) {
    const link = rows.nth(i + 1).getByRole("link");
    await expect(link).toContainText(`${launch.symbol}/${launch.quote.symbol}`);
    await expect(link).toHaveAttribute("href", `/coin/${launch.mint}`);
  }
  // The board is Explore's (#6): the link is checked by its address, not followed.
  await expect(page.getByRole("link", { name: "All coins" })).toHaveAttribute("href", "/coins");
});

test("the pair rolls through the assets when motion is allowed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-roll] > span")).not.toHaveCSS("animation-name", "none");
  // Read aloud as one sentence, not as the rolling words.
  await expect(page.getByText("Your coin, priced in SOL, USDC, NVDAx, SPYx or TSLAx")).toHaveCount(1);
});
