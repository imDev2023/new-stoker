// What a trader does on Explore's board (#6) end to end against the real chain and API: sorts it, filters it by the kind
// of asset a coin is paired with, searches it, keeps a watchlist, and sees new coins and trend lines arrive.
import type { Page } from "@playwright/test";
import { LaunchList } from "@launchpad/contract";
import { expect, fundedKeypair, launchViaApi, stackEnv, test } from "./fixtures";

const board = (page: Page) => page.getByRole("table", { name: "Coins" });
const rows = (page: Page) => board(page).locator("tbody tr");
const sorts = (page: Page) => page.getByRole("radiogroup", { name: "Sort" });
const paired = (page: Page) => page.getByRole("radiogroup", { name: "Paired with" });
const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
const watchlist = (page: Page) => page.getByRole("checkbox", { name: "Watchlist" });
/** A chip or a sort: the input is hidden under its label, which is what a visitor clicks. */
const pick = (group: ReturnType<typeof sorts>, label: string) => group.locator("label").filter({ hasText: new RegExp(`^${label}$`) });

/** A colour token as the browser resolves it, to compare with a computed style. */
const token = (page: Page, name: string) =>
  page.evaluate((name) => {
    const probe = document.body.appendChild(document.createElement("i"));
    probe.style.color = `var(${name})`;
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);

/** The mints the API lists for a query, in order: what the board must show. */
async function expected(query: Record<string, string>) {
  const params = new URLSearchParams({ limit: "60", ...query });
  return LaunchList.parse(await (await fetch(`${stackEnv().apiUrl}/v1/launches?${params}`)).json()).launches.map((l) => l.mint);
}

async function expectBoard(page: Page, query: Record<string, string>) {
  const want = await expected(query);
  expect(want.length).toBeGreaterThan(0);
  await expect(page.locator("[data-board]")).toHaveAttribute("aria-busy", "false");
  await expect.poll(() => rows(page).evaluateAll((trs) => trs.map((tr) => tr.getAttribute("data-mint")))).toEqual(want);
}

test("a trader sorts the board and filters it by what coins are paired with, and the address keeps the choice", async ({ page }) => {
  await page.goto("/coins");
  await expect(sorts(page).getByRole("radio", { name: "Market cap" })).toBeChecked();
  await expect(paired(page).getByRole("radio", { name: "All" })).toBeChecked();
  await expectBoard(page, { sort: "market_cap" });

  // Each sort shows the coins in the API's order for it, and the address says which.
  for (const [label, sort] of [["Newest", "new"], ["Volume", "trending"], ["Near graduation", "graduation"]] as const) {
    await pick(sorts(page), label).click();
    await expect(page).toHaveURL(new RegExp(`/coins\\?sort=${sort}$`));
    await expect(sorts(page).getByRole("radio", { name: label })).toBeChecked();
    await expectBoard(page, { sort });
  }

  // A kind keeps the sort and shows only the coins paired with that kind of asset, the pair in each row's name.
  await pick(paired(page), "Currencies").click();
  await expect(page).toHaveURL(/\/coins\?sort=graduation&category=stablecoin$/);
  await expectBoard(page, { sort: "graduation", category: "stablecoin" });
  await expect(rows(page).filter({ hasNotText: "/USDC" })).toHaveCount(0);
  await pick(paired(page), "Stocks").click();
  await expectBoard(page, { sort: "graduation", category: "tokenized_stock" });
  await expect(rows(page).filter({ hasNotText: "/NVDAx" })).toHaveCount(0);

  // A reload, or a shared link, shows the same board.
  await page.reload();
  await expect(paired(page).getByRole("radio", { name: "Stocks" })).toBeChecked();
  await expect(sorts(page).getByRole("radio", { name: "Near graduation" })).toBeChecked();
  await expectBoard(page, { sort: "graduation", category: "tokenized_stock" });

  // A kind nothing is paired with says so in one sentence; All brings every coin back, and a mangled link falls back.
  await pick(paired(page), "Collectibles").click();
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await expect(board(page)).toHaveCount(0);
  await pick(paired(page), "All").click();
  await expect(page).toHaveURL(/\/coins\?sort=graduation$/);
  await expectBoard(page, { sort: "graduation" });
  await page.goto("/coins?sort=sideways&category=nothing");
  await expect(sorts(page).getByRole("radio", { name: "Market cap" })).toBeChecked();
  await expectBoard(page, { sort: "market_cap" });
});

test("a trader finds a coin by name, ticker or address, and the address keeps the search", async ({ page }) => {
  const [harbor] = await expected({ sort: "market_cap", q: "Harbor Lights" });
  expect(harbor).toBeDefined();
  await page.goto("/coins");
  await expectBoard(page, { sort: "market_cap" });

  // By name, in any case; the search is in the address once typed.
  await search(page).fill("harbor li");
  await expect(page).toHaveURL(/\/coins\?q=harbor\+li$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toHaveAttribute("data-mint", harbor!);
  await expect(rows(page).first().getByRole("link")).toHaveAttribute("href", `/coin/${harbor}`);

  // By ticker, and by the start of the contract address.
  await search(page).fill("hrbr");
  await expect(rows(page)).toHaveCount(1);
  await search(page).fill(harbor!.slice(0, 12));
  await expect(page).toHaveURL(new RegExp(`q=${harbor!.slice(0, 12)}$`));
  await expect(rows(page)).toHaveCount(1);

  // Nothing matching says so; clearing the search shows every coin again.
  await search(page).fill("no such coin anywhere");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await search(page).fill("");
  await expect(page).toHaveURL(/\/coins$/);
  await expectBoard(page, { sort: "market_cap" });

  // A shared link opens with the search filled in.
  await page.goto("/coins?q=HRBR");
  await expect(search(page)).toHaveValue("HRBR");
  await expect(rows(page)).toHaveCount(1);
});

test("'/' and ⌘K reach the board's search, from the board itself and from any other page", async ({ page }) => {
  await page.goto("/terms");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(page).toHaveURL(/\/coins$/, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  // The board answers the hash by focusing the field, then drops it.
  await expect(search(page)).toBeFocused();

  await page.goto("/coins?sort=new");
  await page.waitForLoadState("networkidle");
  await page.locator("h1").click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(search(page)).toBeFocused();
  // A slash typed in the field is a character, not the shortcut.
  await page.keyboard.type("a/b");
  await expect(search(page)).toHaveValue("a/b");
  await expect(page).toHaveURL(/\/coins\?sort=new&q=a%2Fb$/);
});

test("a trader stars coins into a watchlist kept in their own browser", async ({ page }) => {
  await page.goto("/coins");
  await expectBoard(page, { sort: "market_cap" });
  const [first, second] = await expected({ sort: "market_cap" });

  // With nothing starred, the watchlist says how to fill it.
  await watchlist(page).check({ force: true });
  await expect(page.getByText("Star a coin to watch it.")).toBeVisible();
  await watchlist(page).uncheck({ force: true });
  await expectBoard(page, { sort: "market_cap" });

  const star = (mint: string) => board(page).locator(`tr[data-mint="${mint}"]`).getByRole("button", { name: /^Watch / });
  await star(second!).click();
  await expect(star(second!)).toHaveAttribute("aria-pressed", "true");
  await star(first!).click();
  await expect(star(first!)).toHaveAttribute("aria-pressed", "true");
  // Kept in this browser only, under the spec's key.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("stoker.watch") ?? "[]"))).toEqual([second, first]);

  // The watchlist shows only the starred coins, in the board's order, and keeps the search and the kind.
  await watchlist(page).check({ force: true });
  await expect.poll(() => rows(page).evaluateAll((trs) => trs.map((tr) => tr.getAttribute("data-mint")))).toEqual([first, second]);
  await search(page).fill("no such coin anywhere");
  await expect(page.getByText("Nothing matches.")).toBeVisible();
  await search(page).fill("");
  await expect(rows(page)).toHaveCount(2);

  // A reload keeps the stars; unstarring a coin while the watchlist is shown takes it off at once.
  await page.reload();
  await expect(star(first!)).toHaveAttribute("aria-pressed", "true");
  await watchlist(page).check({ force: true });
  await expect(rows(page)).toHaveCount(2);
  await star(first!).click();
  await expect(rows(page)).toHaveCount(1);
  await star(second!).click();
  await expect(page.getByText("Star a coin to watch it.")).toBeVisible();
});

test("a new coin arrives on the open board without a reload", async ({ page }) => {
  await page.goto("/coins?sort=new");
  await expectBoard(page, { sort: "new" });
  const mint = await launchViaApi(await fundedKeypair(2), { name: "Late Arrival", symbol: "LATE" });
  await expect(rows(page).first()).toHaveAttribute("data-mint", mint, { timeout: 20_000 });
  await expect(rows(page).first()).toContainText("LATE/SOL");
});

test("a coin's trend line is its last day of hourly closes, coloured by where it ended", async ({ page }) => {
  const hour = 3600;
  const start = Math.floor(Date.now() / 1000 / hour) * hour - 3 * hour;
  const candles = (closes: number[]) => ({
    interval: "1h",
    candles: closes.map((close, i) => ({ time: start + i * hour, open: close, high: close, low: close, close, volume: "1" })),
  });
  const [up, down] = await expected({ sort: "market_cap" });
  await page.route("**/v1/launches/*/candles?interval=1h", (route) => {
    const mint = route.request().url().split("/v1/launches/")[1]!.split("/")[0];
    const body = mint === up ? candles([1, 3, 2, 4]) : mint === down ? candles([4, 2, 3, 1]) : candles([2]);
    return route.fulfill({ json: body });
  });
  await page.goto("/coins");
  const line = (mint: string) => board(page).locator(`tr[data-mint="${mint}"] svg`);
  await expect(line(up!)).toHaveAttribute("data-spark", "drawn");
  await expect(line(up!).locator("polyline")).toHaveAttribute("points", "0,26 33.33333333333333,10 66.66666666666666,18 100,2");
  await expect(line(up!)).toHaveCSS("stroke", await token(page, "--up"));
  await expect(line(down!)).toHaveAttribute("data-spark", "drawn");
  await expect(line(down!)).toHaveCSS("stroke", await token(page, "--down"));
  // One close is no line: the cell stays empty rather than drawing a flat placeholder.
  const others = (await expected({ sort: "market_cap" })).slice(2, 3);
  await expect(line(others[0]!)).toHaveAttribute("data-spark", "empty");
  await expect(line(others[0]!).locator("polyline")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the chips slide sideways in one line, and a link to the last kind shows its chip", async ({ page }) => {
    await page.goto("/coins?category=community");
    const chip = pick(paired(page), "Community");
    await expect(paired(page).getByRole("radio", { name: "Community" })).toBeChecked();
    await expect(chip).toBeInViewport({ ratio: 1 });
    // One line: every chip at the same height.
    const tops = await paired(page).locator("label").evaluateAll((labels) => new Set(labels.map((l) => l.getBoundingClientRect().top)).size);
    expect(tops).toBe(1);
    await expect(page.getByText("Nothing matches.")).toBeVisible();
  });
});
