// The shell and the static pages before anything has launched, at desktop and phone width, light and dark: every control
// is there, and the pulse strip waits for a real figure.
import { expect, test } from "./fixtures";
import { snap } from "./shots";

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
