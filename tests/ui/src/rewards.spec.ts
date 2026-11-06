// Holder rewards end to end (#12): any wallet's rewards looked up from the page's form, each payout linked to its
// transaction, a wallet with none and an address that isn't one, and a rules change announced ahead of its day.
import { Keypair } from "@solana/web3.js";
import { RewardRulesPage, WalletRewards } from "@launchpad/contract";
import { expect, stackEnv, test } from "./fixtures";
import { REWARD_HOLDER } from "./seedData";

const api = async <T>(path: string, schema: { parse: (v: unknown) => T }) => schema.parse(await (await fetch(`${stackEnv().apiUrl}${path}`)).json());

test("a wallet's rewards, looked up from the form", async ({ page }) => {
  const holder = REWARD_HOLDER.publicKey.toBase58();
  const { rewards } = await api(`/v1/wallets/${holder}/rewards`, WalletRewards);
  const paid = rewards.find((r) => r.status === "paid" && r.signature);
  expect(paid, "the seed's Reward Engine run paid the holder").toBeTruthy();

  await page.goto("/rewards");
  await page.getByRole("textbox", { name: "Wallet address" }).fill(holder);
  await page.getByRole("button", { name: "Show" }).click();
  // The address goes into the page's address, so a lookup is a link.
  await expect(page).toHaveURL(new RegExp(`/rewards\\?wallet=${holder}$`));
  const rows = page.getByRole("table", { name: "Rewards" }).getByRole("row");
  await expect(rows).toHaveCount(rewards.length);
  const row = rows.filter({ hasText: paid!.symbol }).first();
  await expect(row.getByRole("link", { name: paid!.symbol })).toHaveAttribute("href", `/coin/${paid!.mint}`);
  await expect(row.getByRole("link", { name: new RegExp(`${paid!.payout.symbol}$`) })).toHaveAttribute("href", new RegExp(`/tx/${paid!.signature}\\?`));
});

test("a wallet with no rewards says so, and an address that isn't one is refused", async ({ page }) => {
  await page.goto("/rewards");
  const field = page.getByRole("textbox", { name: "Wallet address" });
  await field.fill(Keypair.generate().publicKey.toBase58());
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("No rewards for this wallet yet.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  // The field takes only an address: the browser keeps the form from sending anything else.
  const before = page.url();
  await field.fill("not a wallet");
  await page.getByRole("button", { name: "Show" }).click();
  expect(await field.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(true);
  expect(page.url()).toBe(before);

  // Typed into the page's address instead, it is refused in words, never as an error.
  await page.goto("/rewards?wallet=not-a-wallet");
  await expect(page.getByText("Enter a Solana wallet address.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Wallet address" })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("a rules change shows once announced, ahead of its day", async ({ page }) => {
  const { apiUrl, operatorToken } = stackEnv();
  // A month ahead, so it never applies while the suite runs.
  const effectiveAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const res = await fetch(`${apiUrl}/v1/operator/rewards/rules`, {
    method: "POST",
    headers: { authorization: `Bearer ${operatorToken}`, "content-type": "application/json" },
    body: JSON.stringify({ minHolding: "20000000000", roundThreshold: "200000000000", effectiveAt }),
  });
  expect(res.ok, await res.clone().text()).toBe(true);
  const announced = (await api("/v1/rewards/rules", RewardRulesPage)).upcoming.find((r) => r.effectiveAt === effectiveAt);
  expect(announced).toBeTruthy();

  await page.goto("/rewards");
  const changes = page.getByRole("region", { name: "Announced changes" });
  const change = changes.locator(`[data-version="${announced!.version}"]`);
  await expect(change.getByRole("term")).toContainText(`Version ${announced!.version} from`);
  await expect(change.getByRole("definition")).toHaveText("20,000 coins to be paid, a round from 200,000 coins");
  // The rules in force stay as they were until the day.
  await expect(page.getByRole("region", { name: "Rules in force" }).getByRole("definition").nth(1)).toHaveText("10,000 coins");
});
