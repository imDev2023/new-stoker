// What a visitor does on Assets and an asset's page (#9) end to end against the real chain and API: filters the
// directory by kind, searches it, follows a row to the asset, finds production's old address forwarded, and reaches the
// page's search with "/".
import type { Page } from "@playwright/test";
import { QuoteAssetList } from "@launchpad/contract";
import { expect, expectHydrated, QUOTES, stackEnv, test } from "./fixtures";

const table = (page: Page) => page.getByRole("table", { name: "Assets" });
const rows = (page: Page) => table(page).locator("tbody tr[data-mint]");
const kinds = (page: Page) => page.getByRole("radiogroup", { name: "Kind" });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
/** A chip: the input is hidden under its label, which is what a visitor clicks. */
const chip = (page: Page, label: string) => kinds(page).locator("label").filter({ hasText: new RegExp(`^${label}$`) });

async function quotes() {
  return QuoteAssetList.parse(await (await fetch(`${stackEnv().apiUrl}/v1/quotes`)).json()).quotes;
}

test("a visitor filters the assets by kind and searches them, and the address keeps the choice", async ({ page }) => {
  const all = await quotes();
  await page.goto("/assets");
  await expect(kinds(page).getByRole("radio", { name: "All" })).toBeChecked();
  await expect(rows(page)).toHaveCount(all.length);

  // A kind narrows the table to its assets, under its own heading, and the address says which.
  await chip(page, "Currencies").click();
  await expect(page).toHaveURL(/\/assets\?category=stablecoin$/);
  const stables = all.filter((q) => q.category === "stablecoin").map((q) => q.mint);
  expect(stables.length).toBeGreaterThan(0);
  await expect.poll(() => rows(page).evaluateAll((trs) => trs.map((tr) => tr.getAttribute("data-mint")))).toEqual(stables);
  await expect(table(page).locator("th[scope=colgroup]")).toHaveText(["Currencies"]);

  // A reload keeps it.
  await page.reload();
  await expect(kinds(page).getByRole("radio", { name: "Currencies" })).toBeChecked();
  await expect(rows(page)).toHaveCount(stables.length);

  // A search within every kind finds by ticker, closest first, and says when nothing matches.
  await chip(page, "All").click();
  await search(page).fill("nvda");
  await expect(page).toHaveURL(/\/assets\?q=nvda$/);
  await expect(rows(page).first()).toHaveAttribute("data-mint", QUOTES.NVDAx.toBase58());
  await search(page).fill("no such asset");
  await expect(table(page)).toHaveCount(0);
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  // By mint address too.
  await search(page).fill(QUOTES.USDC.toBase58());
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("USDC");
});

test("a row opens the asset's page, with its facts, labels and coins", async ({ page }) => {
  await page.goto("/assets?q=TAXQ");
  await rows(page).first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/asset/${QUOTES.TAXQ.toBase58()}$`));
  await expect(page.getByRole("heading", { level: 1, name: "TAXQ" })).toBeVisible();
  // The taxed quote's transfer fee is a label the registry read from its mint.
  const labels = page.getByRole("region", { name: "Risk labels" });
  await expect(labels).toContainText("transfer fee");
  const facts = page.getByRole("definition");
  await expect(page.getByRole("term")).toContainText(["Price", "Token program", "Mint"]);
  await expect(facts.filter({ hasText: "Token-2022" })).toHaveCount(1);
  // The asset breaks no other page's link: the explorer link names its mint.
  await expect(page.getByRole("main").getByRole("link", { name: /…/ })).toHaveAttribute("href", new RegExp(QUOTES.TAXQ.toBase58()));
  await expect(page.getByRole("link", { name: "Stoke a coin paired with TAXQ" })).toHaveAttribute("href", `/launch?quote=${QUOTES.TAXQ.toBase58()}`);
});

test("an asset no one can launch against says so by leaving the launch out", async ({ page }) => {
  const closed = (await quotes()).find((q) => !q.launchable);
  expect(closed, "the stack quotes one asset with no price").toBeTruthy();
  await page.goto(`/assets?q=${closed!.mint}`);
  await expect(rows(page).first()).toContainText("Not launchable");
  await page.goto(`/asset/${closed!.mint}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Stoke a coin paired with/ })).toHaveCount(0);
});

test("production's address for an asset forwards to the page", async ({ page }) => {
  await page.goto(`/assets/${QUOTES.USDC.toBase58()}`);
  await expect(page).toHaveURL(new RegExp(`/asset/${QUOTES.USDC.toBase58()}$`));
  await expect(page.getByRole("heading", { level: 1, name: "USDC" })).toBeVisible();
});

test('"/" focuses the page\'s own search', async ({ page }) => {
  await page.goto("/assets");
  await expectHydrated(page);
  await search(page).blur();
  // The layout's shortcut listens once it has hydrated, which on a cold page can come after the field's: press until it answers.
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(search(page)).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/assets$/);
});
