// What a visitor does on Stocks and a stock's page (#10) end to end against the real chain and API: reads the US
// market's hours at the moments that matter (a session, an early close, a holiday, a weekend, a change of clocks),
// sorts, filters and searches the list with the address keeping the choice, follows a row and the asset page's "Trade"
// link to the stock, sees its line once the registry has two hours of prices, and trades it through Jupiter on the pair
// its two choices name.
import type { Page } from "@playwright/test";
import { QuoteAsset } from "@launchpad/contract";
import { expect, expectHydrated, QUOTES, stackEnv, test } from "./fixtures";

const NVDAX = QUOTES.NVDAx.toBase58();
const USDC = QUOTES.USDC.toBase58();
const SOL = QUOTES.SOL.toBase58();

const table = (page: Page) => page.getByRole("table", { name: "Stocks" });
const rows = (page: Page) => table(page).locator("tbody tr[data-mint]");
const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
const hours = (page: Page) => page.locator("[data-hours]");
/** A chip or a choice: the input is hidden under its label, which is what a visitor clicks. */
const pick = (page: Page, group: string, label: string) =>
  page.getByRole("radiogroup", { name: group }).locator("label").filter({ hasText: new RegExp(`^${label}$`) });

async function nvdax() {
  return QuoteAsset.parse(await (await fetch(`${stackEnv().apiUrl}/v1/quotes/${NVDAX}`)).json());
}

/** Hourly candles at one price each, ending in the current hour. */
function candles(closes: number[]) {
  const hour = 3600;
  const start = Math.floor(Date.now() / 1000 / hour) * hour - (closes.length - 1) * hour;
  return { interval: "1h", candles: closes.map((close, i) => ({ time: start + i * hour, open: close, high: close, low: close, close, volume: "0" })) };
}

test("the US market's hours follow New York's session, its early closes, holidays and clocks", async ({ page }) => {
  const cases: [string, string][] = [
    // A Monday at 10:00 New York time, in winter (EST) and just after the clocks went forward (EDT).
    ["2026-11-09T15:00:00Z", "US market open · closes 16:00 ET"],
    ["2026-03-09T14:00:00Z", "US market open · closes 16:00 ET"],
    // 09:00 EDT the same day: before the bell, so it opens today.
    ["2026-03-09T13:00:00Z", "US market closed · opens 09:30 ET"],
    // The day after Thanksgiving closes at 13:00; after it, the next session is Monday's.
    ["2026-11-27T17:30:00Z", "US market open · closes 13:00 ET"],
    ["2026-11-27T18:30:00Z", "US market closed · opens Mon 09:30 ET"],
    // Thanksgiving itself is shut, and so is a Saturday.
    ["2026-11-26T15:00:00Z", "US market closed · opens Fri 09:30 ET"],
    ["2026-11-07T15:00:00Z", "US market closed · opens Mon 09:30 ET"],
    // Christmas Eve closes early and Christmas is shut, so the afternoon of the 24th waits for Monday the 28th.
    ["2026-12-24T19:00:00Z", "US market closed · opens Mon 09:30 ET"],
  ];
  for (const [at, text] of cases) {
    await page.clock.setFixedTime(new Date(at));
    await page.goto("/stocks");
    await expect(hours(page), at).toContainText(text);
    await expect(hours(page)).toContainText("Solana open");
  }
});

test("the hours line turns on the minute the bell rings", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-09T20:59:30Z") });
  await page.goto("/stocks");
  await expect(hours(page)).toContainText("US market open · closes 16:00 ET");
  await page.clock.runFor(60_000);
  await expect(hours(page)).toContainText("US market closed · opens Tue 09:30 ET");
});

test("a visitor sorts, filters and searches the stocks, and the address keeps the choice", async ({ page }) => {
  const stock = await nvdax();
  expect(stock.issuer, "the local NVDAx is xStocks'").toBe("xstocks");
  await page.goto("/stocks");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toHaveAttribute("data-mint", NVDAX);
  await expect(page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio", { name: "Liquidity" })).toBeChecked();

  // The issuer narrows the list, and the address says which; a reload keeps it.
  await pick(page, "Issuer", "xStocks").click();
  await expect(page).toHaveURL(/\/stocks\?issuer=xstocks$/);
  await expect(rows(page)).toHaveCount(1);
  await pick(page, "Sort", "A–Z").click();
  await expect(page).toHaveURL(/\/stocks\?sort=name&issuer=xstocks$/);
  await page.reload();
  await expect(page.getByRole("radiogroup", { name: "Issuer" }).getByRole("radio", { name: "xStocks" })).toBeChecked();
  await expect(page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio", { name: "A–Z" })).toBeChecked();
  await pick(page, "Sort", "24h change").click();
  await expect(page).toHaveURL(/\/stocks\?sort=change&issuer=xstocks$/);

  // The search finds a stock by its ticker, its company, the ticker of the stock it tracks or its mint.
  await pick(page, "Issuer", "All").click();
  for (const q of ["nvdax", stock.name!.slice(0, 5), "NVDA", NVDAX.slice(0, 8)]) {
    await search(page).fill(q);
    await expect(rows(page), q).toHaveCount(1);
  }
  await expect(page).toHaveURL(new RegExp(`/stocks\\?sort=change&q=${NVDAX.slice(0, 8)}$`));
  await search(page).fill("no such stock");
  await expect(table(page)).toHaveCount(0);
  await expect(page.getByText("Nothing matches.")).toBeVisible();

  // An address the page doesn't know falls back to the plain list.
  await page.goto("/stocks?sort=volume&issuer=nyse");
  await expect(page.getByRole("radiogroup", { name: "Sort" }).getByRole("radio", { name: "Liquidity" })).toBeChecked();
  await expect(page.getByRole("radiogroup", { name: "Issuer" }).getByRole("radio", { name: "All" })).toBeChecked();
});

test('"/" focuses the page\'s own search', async ({ page }) => {
  await page.goto("/stocks");
  await expectHydrated(page);
  await search(page).blur();
  // The layout's shortcut listens once it has hydrated, which on a cold page can come after the field's: press until it answers.
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(search(page)).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/stocks$/);
});

test("a row and the asset page's Trade link open the stock, its section marked", async ({ page }) => {
  await page.goto("/stocks");
  await rows(page).first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`/stock/${NVDAX}$`));
  await expect(page.getByRole("heading", { level: 1, name: "NVDAx" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sections" }).filter({ visible: true }).getByRole("link", { name: "Stocks" })).toHaveAttribute("aria-current", "page");
  await page.goto(`/asset/${NVDAX}`);
  await page.getByRole("link", { name: "Trade NVDAx" }).click();
  await expect(page).toHaveURL(new RegExp(`/stock/${NVDAX}$`));
  await expect(page.getByRole("heading", { level: 1, name: "NVDAx" })).toBeVisible();
});

test("the price beside the stock it tracks, with the gap from the registry's two prices", async ({ page }) => {
  const stock = await nvdax();
  const usd = Number(stock.price!.usd);
  const last = stock.market!.last!.price;
  const gap = `${((usd / last - 1) * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero" })}%`;
  // A Monday morning in New York: the stock trades, so its price is its last.
  await page.clock.setFixedTime(new Date("2026-11-09T15:00:00Z"));
  await page.goto(`/stock/${NVDAX}`);
  const under = page.locator("[data-stock-under]");
  await expect(under).toHaveText(`NVDA $${last.toFixed(2)} · ${gap} vs stock`);
  // Under 1% either way the gap is plain; the list says the same.
  expect(Math.abs(usd / last - 1)).toBeLessThan(0.01);
  await expect(under).not.toHaveAttribute("data-wide");
  // On a Saturday the stock's price is where it closed.
  await page.clock.setFixedTime(new Date("2026-11-07T15:00:00Z"));
  await page.goto(`/stock/${NVDAX}`);
  await expect(under).toHaveText(`NVDA closed at $${last.toFixed(2)} · ${gap} vs stock`);
  await page.goto("/stocks");
  await expect(rows(page).first().locator("td").nth(4)).toHaveText(gap);
  await expect(rows(page).first().locator("td").nth(4)).not.toHaveAttribute("data-wide");
});

test("a stock's line is drawn once the registry has two hours of prices, a day or five of them", async ({ page }) => {
  await page.route(`**/v1/quotes/${NVDAX}/candles?interval=1h`, (route) =>
    route.fulfill({ json: candles(Array.from({ length: 150 }, (_, i) => 170 + (i % 7))) }),
  );
  await page.goto(`/stock/${NVDAX}`);
  const chart = page.getByRole("region", { name: "Price" });
  await expect(chart).toBeVisible();
  const points = () => chart.locator("[data-chart] polyline").evaluate((el) => el.getAttribute("points")!.split(" ").length);
  await expect.poll(points).toBe(24);
  await pick(page, "Range", "5D").click();
  await expect.poll(points).toBe(120);

  // The list's trend line reads the same candles.
  await page.goto("/stocks");
  await expect(rows(page).first().locator("svg")).toHaveAttribute("data-spark", "drawn");
});

test("a stock trades through Jupiter on the pair its choices name, the stock's side locked", async ({ page }) => {
  // Jupiter's script stood in by one that records what the page asks of it.
  await page.route(/^https:\/\/plugin\.jup\.ag\//, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "window.__inits = []; window.Jupiter = { init: (p) => window.__inits.push(p.formProps), syncProps: () => {}, close: () => {} };",
    }),
  );
  await page.goto(`/stock/${NVDAX}`);
  const trade = page.getByRole("region", { name: "Trade NVDAx" });
  const last = () => page.evaluate(() => (window as unknown as { __inits?: Record<string, unknown>[] }).__inits?.at(-1) ?? null);
  // A buy paid with USDC first; no referral account on the stack, so no fee of ours.
  await expect.poll(last).toEqual({ initialInputMint: USDC, initialOutputMint: NVDAX, fixedMint: NVDAX });
  await expect(trade.getByText("Pay with", { exact: true })).toBeVisible();
  await pick(page, "Pay with", "SOL").click();
  await expect.poll(last).toEqual({ initialInputMint: SOL, initialOutputMint: NVDAX, fixedMint: NVDAX });
  // A sale pays out in the asset chosen.
  await pick(page, "Side", "Sell").click();
  await expect(trade.getByText("Receive", { exact: true })).toBeVisible();
  await expect.poll(last).toEqual({ initialInputMint: NVDAX, initialOutputMint: SOL, fixedMint: NVDAX });
  await pick(page, "Receive", "USDC").click();
  await expect.poll(last).toEqual({ initialInputMint: NVDAX, initialOutputMint: USDC, fixedMint: NVDAX });
  await expect(trade).toContainText("Routed by Jupiter. A token can trade at a gap to its stock. Nothing here is investment advice.");
});

test("without Jupiter's script the trade says where the same pair is", async ({ page }) => {
  await page.goto(`/stock/${NVDAX}`);
  const trade = page.getByRole("region", { name: "Trade NVDAx" });
  await expect(trade.getByRole("link", { name: "Open jup.ag" })).toHaveAttribute("href", `https://jup.ag/swap/USDC-${NVDAX}`);
  await pick(page, "Side", "Sell").click();
  await pick(page, "Receive", "SOL").click();
  await expect(trade.getByRole("link", { name: "Open jup.ag" })).toHaveAttribute("href", `https://jup.ag/swap/${NVDAX}-SOL`);
});
