// What a trader does on a coin page, end to end against the real chain, API and Indexer: the test wallet buys and sells
// on the curve and in a graduated pool, pays with SOL through the route for a coin paired with USDC, meets the trade
// disclaimer when the browser has no acceptance, and each trade appears in the page's trades within seconds.
import type { Page } from "@playwright/test";
import type { VersionedTransaction } from "@solana/web3.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { coinBalance, expect, forgetDisclaimer, fundedKeypair, graduate, launchViaApi, listLaunches, test, tradeViaApi } from "./fixtures";
import { connectTestWallet } from "./wallet";

// The devnet program ids the local chain runs: which one a trade invokes shows where it traded.
const LAUNCHLAB = "DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6";
const CPMM = "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb";
const invokes = (tx: VersionedTransaction) => tx.message.compiledInstructions.map((ix) => tx.message.staticAccountKeys[ix.programIdIndex]!.toBase58());

const panel = (page: Page) => page.getByRole("form", { name: /^Trade / }).or(page.getByRole("region", { name: /^Trade / }));
const trades = (page: Page) => page.getByRole("table", { name: "Trades" });
const estimate = (page: Page) => panel(page).locator("dl").filter({ hasText: "You get about" });

async function freshCoin(symbol: string, quote?: "USDC") {
  return launchViaApi(await fundedKeypair(), { name: `Trade ${symbol}`, symbol, quote });
}

async function openConnected(page: Page, mint: string, symbol: string) {
  await page.goto(`/coin/${mint}`);
  await connectTestWallet(page, panel(page).getByRole("button", { name: "Connect wallet" }));
  await expect(panel(page).getByRole("button", { name: `Buy ${symbol}` })).toBeVisible();
}

/** Picks a side and an amount (typed, or a preset), and waits for the live quote the button waits for too. */
async function enter(page: Page, side: "buy" | "sell", amount: { type: string } | { preset: string }) {
  await panel(page).getByRole("radiogroup", { name: "Side" }).getByText(side === "buy" ? "Buy" : "Sell", { exact: true }).click();
  if ("type" in amount) await panel(page).getByLabel("Amount").fill(amount.type);
  else await panel(page).getByRole("button", { name: amount.preset, exact: true }).click();
  await expect(estimate(page)).toBeVisible();
}

/** Presses the panel's button and waits for the receipt. */
async function trade(page: Page, label: string, receipt: RegExp) {
  await panel(page).getByRole("button", { name: label }).click();
  await expect(panel(page).getByRole("status")).toHaveText(receipt);
}

test("a trader buys, then sells half, on the curve, and sees both in the trades", async ({ page, wallet }) => {
  const mint = await freshCoin("BUYS");
  await openConnected(page, mint, "BUYS");
  await expect(trades(page)).toHaveCount(0);

  // A preset fills the amount; the quote shows what the trader gets and one Fees line in the asset paid, which leads to
  // the Fees page, the one place a rate is shown (owner, 2026-10-30).
  await enter(page, "buy", { preset: "0.1" });
  await expect(panel(page).getByLabel("Amount")).toHaveValue("0.1");
  const fees = estimate(page).getByRole("link");
  await expect(fees).toHaveText(/^0\.\d+ SOL$/);
  await expect(fees).toHaveAttribute("href", "/fees");
  await expect(estimate(page)).not.toContainText("%");

  // A browser without the welcome's acceptance meets the trade disclaimer first; the wallet is asked only after it.
  await forgetDisclaimer(page);
  await panel(page).getByRole("button", { name: "Buy BUYS" }).click();
  const disclaimer = page.getByRole("dialog", { name: "Before you trade" });
  await expect(disclaimer).toBeVisible();
  expect(wallet.requests).toHaveLength(0);
  await disclaimer.getByRole("checkbox").check();
  await disclaimer.getByRole("button", { name: "Continue" }).click();
  const bought = panel(page).getByRole("status");
  await expect(bought).toHaveText(/^Bought [\d,]+ BUYS\. View transaction$/);
  expect(wallet.requests).toHaveLength(1);
  expect(invokes(wallet.requests[0]!)).toContain(LAUNCHLAB);
  const held = await coinBalance(wallet.keypair, mint);
  expect((await bought.locator(".num").textContent())?.replace(/,/g, "")).toBe((held / 1_000_000n).toString());

  // The trades pick it up from the Indexer, and the price and the marks with them.
  await expect(trades(page).getByRole("row")).toHaveCount(2);
  await expect(trades(page).getByRole("row").nth(1)).toContainText("Buy");
  await expect(page.getByRole("list", { name: "Before you buy" })).toContainText("Top 10");

  // Sell half: the percentage presets come from what the wallet holds.
  await enter(page, "sell", { preset: "50%" });
  await expect(estimate(page).getByRole("link")).toHaveText(/ SOL$/);
  await trade(page, "Sell BUYS", /^Sold [\d,]+ BUYS\. View transaction$/);
  expect(wallet.requests).toHaveLength(2);
  expect(await coinBalance(wallet.keypair, mint)).toBe(held - held / 2n);
  await expect(trades(page).getByRole("row")).toHaveCount(3, { timeout: 10_000 });
  await expect(trades(page).getByRole("row").nth(1)).toContainText("Sell");

  // Another interval redraws the chart from the same trades.
  await page.getByRole("radiogroup", { name: "Interval" }).getByText("5m", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "5m" })).toBeChecked();
  await expect(page.locator("[data-chart] polyline")).toHaveCount(1);
});

test("a buy that takes the rest of the curve costs only what is left and pauses trading", async ({ page, wallet }) => {
  const mint = await freshCoin("SOLD");
  await openConnected(page, mint, "SOLD");
  // The local Graduation Target is 1 SOL, so 2 SOL overshoots it.
  await enter(page, "buy", { type: "2" });
  await expect(panel(page).getByText(/^This buy takes the last coins on the curve and starts graduation, so it costs 1\.\d+ SOL, not the full amount\.$/)).toBeVisible();
  await trade(page, "Buy SOLD", /^Bought [\d,]+ SOLD\. View transaction$/);
  await expect(panel(page)).toContainText("Trading pauses while Raydium moves the coin to its pool");
  await expect(panel(page).getByLabel("Amount")).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect(wallet.requests).toHaveLength(1);
});

test("a graduated coin trades in its Raydium pool from the same page", async ({ page, wallet }) => {
  const mint = await freshCoin("POOL");
  await tradeViaApi(await fundedKeypair(), mint, "buy", BigInt(2 * LAMPORTS_PER_SOL));
  await graduate(mint);
  await openConnected(page, mint, "POOL");
  await expect(page.getByRole("region", { name: "Graduation" }).getByText("Graduated", { exact: true })).toBeVisible();
  await expect(trades(page).getByRole("row")).toHaveCount(2);

  await enter(page, "buy", { preset: "0.1" });
  await trade(page, "Buy POOL", /^Bought [\d,]+ POOL\. View transaction$/);
  expect(invokes(wallet.requests.at(-1)!)).toContain(CPMM);
  expect(invokes(wallet.requests.at(-1)!)).not.toContain(LAUNCHLAB);
  await expect(trades(page).getByRole("row")).toHaveCount(3);

  // A sell in the pool pays the pool's fee in the coins sold, so the Fees line names both assets.
  await enter(page, "sell", { preset: "All" });
  await expect(estimate(page).getByRole("link")).toHaveText(/ SOL \+ [\d,]+ POOL$/);
  await trade(page, "Sell POOL", /^Sold [\d,]+ POOL\. View transaction$/);
  expect(invokes(wallet.requests.at(-1)!)).toContain(CPMM);
  expect(await coinBalance(wallet.keypair, mint)).toBe(0n);
  await expect(trades(page).getByRole("row")).toHaveCount(4, { timeout: 10_000 });
});

test("a coin paired with USDC is bought with SOL through the route when the wallet holds no USDC", async ({ page, wallet }) => {
  const mint = await freshCoin("ROUT", "USDC");
  await openConnected(page, mint, "ROUT");
  const pay = panel(page).getByRole("radiogroup", { name: "Pay with" });
  await expect(pay.getByRole("radio", { name: "SOL" })).toBeChecked();
  await enter(page, "buy", { preset: "0.1" });
  await expect(estimate(page)).toContainText("Spent on the coins");
  await expect(estimate(page)).toContainText("Stays in your wallet");
  // The trade's fees in USDC, the swap's in SOL.
  await expect(estimate(page).getByRole("link")).toHaveText(/ USDC( \+ [\d.]+ SOL)?$/);
  await trade(page, "Buy ROUT", /^Bought [\d,]+ ROUT\. View transaction$/);
  expect(await coinBalance(wallet.keypair, mint)).toBeGreaterThan(0n);
  await expect(trades(page).getByRole("row")).toHaveCount(2);
});

test("declining in the wallet trades nothing and says so", async ({ page, wallet }) => {
  const mint = await freshCoin("NOPE");
  await openConnected(page, mint, "NOPE");
  await enter(page, "buy", { type: "0.1" });
  wallet.declineNext();
  await panel(page).getByRole("button", { name: "Buy NOPE" }).click();
  await expect(panel(page).getByRole("alert")).toHaveText("You declined the transaction in your wallet. Nothing was traded.");
  expect(wallet.requests).toHaveLength(1);
  expect(await coinBalance(wallet.keypair, mint)).toBe(0n);
});

test("an amount over the wallet's balance is refused before anything is prepared", async ({ page }) => {
  const mint = await freshCoin("MUCH");
  await openConnected(page, mint, "MUCH");
  // A buy past the Graduation Target costs only what is left, so the check is a sell of coins the wallet doesn't hold.
  await panel(page).getByRole("radiogroup", { name: "Side" }).getByText("Sell", { exact: true }).click();
  await panel(page).getByLabel("Amount").fill("500");
  await expect(panel(page).getByText("Your wallet has no MUCH.")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Sell MUCH" })).toBeDisabled();
});

test("the marks read the trust figures and the holders", async ({ page }) => {
  // Harbor Lights' buys were all inside the UI stack's Snipe Window, and its Creator never bought.
  const harbor = (await listLaunches()).find((l) => l.symbol === "HRBR")!;
  await page.goto(`/coin/${harbor.mint}`);
  const marks = page.getByRole("list", { name: "Before you buy" }).getByRole("listitem");
  await expect(marks).toHaveText(["Creator 0%", "1 sniper", /^Top 10 \d+\.\d%$/]);
  // The facts link to the Fees page in words and list the Creator's own links.
  const about = page.getByRole("region", { name: "About HRBR" });
  await expect(about.getByRole("link", { name: "Half of what we collect" })).toHaveAttribute("href", "/fees");
  await expect(about.getByRole("link", { name: "example.com/harbor" })).toHaveAttribute("href", "https://example.com/harbor");
  await expect(about.getByRole("link", { name: "t.me/harborlights" })).toBeVisible();
  // The asset it is paired with leads to its page.
  await expect(page.getByRole("link", { name: /Paired with SOL/ })).toHaveAttribute("href", /^\/assets\/So1/);
});

test("a coin the API doesn't know is the coin page's not-found", async ({ page }) => {
  const res = await page.goto("/coin/11111111111111111111111111111112");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This coin isn't here." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore coins" })).toHaveAttribute("href", "/coins");
});
