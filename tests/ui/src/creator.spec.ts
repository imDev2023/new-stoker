// The connected Creator's own page end to end (#13): the seed's Creator opens it from the account menu and sees what
// their coins earned with each payment the Creator Forward made, the same payment on the public Ledger; the airdrop
// Creator sends the airdrop the seed left unsent; and an allowed Creator launches a coin with an airdrop from the form,
// lands on this page and sends it.
import type { Page } from "@playwright/test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AirdropStatus, CreatorForwardList, LedgerPage } from "@launchpad/contract";
import { allowAirdrops, coinBalance, coinImage, expect, fund, listLaunches, SEED_CREATOR, stackEnv, test } from "./fixtures";
import { AIRDROP_CREATOR, AIRDROP_SENDING, AIRDROP_WALLETS } from "./seedData";
import { connectTestWallet, installTestWallet } from "./wallet";

const api = async <T>(path: string, schema: { parse: (v: unknown) => T }) => schema.parse(await (await fetch(`${stackEnv().apiUrl}${path}`)).json());

/** Opens the Creator page with `creator`'s key in the test wallet, connected from the page's own button. */
async function openAs(page: Page, creator: Keypair) {
  const wallet = await installTestWallet(page, creator);
  await page.goto("/creator");
  await connectTestWallet(page, page.getByRole("main").getByRole("button", { name: "Connect wallet" }));
  await expect(page.getByRole("table", { name: "Your coins" })).toBeVisible();
  return wallet;
}

test("the seed's Creator reaches their page from the account menu, with every forward on the Ledger", async ({ page }) => {
  const creator = SEED_CREATOR.publicKey.toBase58();
  const { forwards } = await api(`/v1/creators/${creator}/forwards`, CreatorForwardList);
  const paid = forwards.filter((f) => f.status === "paid");
  expect(paid.length, "the seed's Creator Forward paid the seed Creator").toBeGreaterThan(0);
  // Each forward is a creator_forward entry on the public Ledger, on its own transaction.
  const ledger = await api("/v1/ledger?kind=creator_forward&limit=100", LedgerPage);
  for (const f of paid) expect(ledger.entries.some((e) => e.kind === "creator_forward" && e.signature === f.signature), f.signature).toBe(true);

  await installTestWallet(page, SEED_CREATOR);
  await page.goto("/risk");
  const header = page.getByRole("banner");
  await connectTestWallet(page, header.getByRole("button", { name: "Connect wallet" }));
  // The menu offers the page only to a wallet that has launched a coin.
  await header.getByRole("button", { name: /…/ }).click();
  await page.getByRole("menuitem", { name: "Your earnings" }).click();
  await expect(page).toHaveURL(/\/creator$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your earnings" })).toBeVisible();

  // What the coins earned, per asset: the seed's trades were in SOL and in USDC.
  await expect(page.getByRole("region", { name: "Earned" }).getByRole("term")).toHaveText(["Earned in SOL", "Earned in USDC"]);
  const coins = page.getByRole("table", { name: "Your coins" }).locator("tbody tr");
  await expect(coins).toHaveCount((await listLaunches()).filter((l) => l.creator === creator).length);
  const gown = coins.filter({ hasText: "GOWN" });
  await expect(gown.getByText(/^Graduation Fee (paid|due)$/).filter({ visible: true })).toBeVisible();
  await expect(gown.getByText("Pool", { exact: true }).filter({ visible: true })).toBeVisible();

  // Every payment, newest first, each linked to its transaction.
  const payments = page.getByRole("table", { name: "Payments" }).locator("tbody tr");
  await expect(payments).toHaveCount(forwards.length);
  for (const [i, f] of forwards.entries()) await expect(payments.nth(i).getByRole("link")).toHaveAttribute("href", new RegExp(`/tx/${f.signature}\\?`));
  await expect(page.getByRole("link", { name: "The Ledger" })).toHaveAttribute("href", "/revenue#ledger");
});

test("a wallet that has launched nothing is offered the form, and the menu leaves the page out", async ({ page }) => {
  const nobody = Keypair.generate();
  await fund(nobody.publicKey, 1);
  await installTestWallet(page, nobody);
  await page.goto("/creator");
  await connectTestWallet(page, page.getByRole("main").getByRole("button", { name: "Connect wallet" }));
  await expect(page.getByText("No coin launched from this wallet yet.")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Stoke a coin" })).toHaveAttribute("href", "/launch");
  await page.getByRole("banner").getByRole("button", { name: /…/ }).click();
  await expect(page.getByRole("menuitem", { name: "Disconnect" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Your earnings" })).toHaveCount(0);
});

test("the airdrop Creator sends the airdrop the seed left unsent, in one approval", async ({ page }) => {
  const drop = (await listLaunches()).find((l) => l.symbol === AIRDROP_SENDING.symbol)!;
  const wallet = await openAs(page, AIRDROP_CREATOR);
  const panel = page.locator(`[data-airdrop="${drop.mint}"]`);
  await expect(panel.getByText("0 of 3 paid")).toBeVisible();
  await expect(panel.getByRole("table").locator("tbody tr")).toHaveCount(3);
  // The other airdrop, sent by the seed, is paid in full and has nothing to send.
  await expect(page.getByText("3 of 3 paid")).toBeVisible();

  await panel.getByRole("button", { name: "Send airdrop" }).click();
  await expect(panel.getByText("3 of 3 paid")).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole("button")).toHaveCount(0);
  expect(wallet.requests.length).toBeGreaterThan(0);
  await expect(panel.getByRole("link", { name: "Paid" })).toHaveCount(3);
  const status = await api(`/v1/launches/${drop.mint}/airdrop`, AirdropStatus);
  for (const [i, wallet] of AIRDROP_WALLETS.entries()) {
    expect(status.recipients.find((r) => r.wallet === wallet)?.status).toBe("paid");
    expect(await coinBalance(new PublicKey(wallet), drop.mint)).toBe(BigInt((i + 1) * 1_000_000) * 1_000_000n);
  }
});

test("an allowed Creator launches with an airdrop from the form, then sends it from this page", async ({ page }) => {
  const creator = Keypair.generate();
  await fund(creator.publicKey, 5);
  await allowAirdrops(creator.publicKey);
  const recipients = [Keypair.generate().publicKey.toBase58(), Keypair.generate().publicKey.toBase58()];
  await installTestWallet(page, creator);
  await page.goto("/launch");
  const summary = page.getByRole("complementary", { name: "Launch summary" });
  await connectTestWallet(page, summary.getByRole("button", { name: "Connect wallet" }));
  const form = page.getByRole("form", { name: "Stoke a coin" });
  const symbol = `AIR${Date.now() % 10_000}`;
  await form.getByLabel("Add image").setInputFiles({ name: `${symbol}.png`, mimeType: "image/png", buffer: coinImage(symbol) });
  await form.getByRole("textbox", { name: "Name" }).fill(`Form Airdrop ${symbol}`);
  await form.getByRole("textbox", { name: "Ticker" }).fill(symbol);
  for (const field of ["name", "symbol", "image"]) await expect(page.locator(`[data-copy="${field}"]`)).toBeVisible();
  await form.getByLabel("First buy").fill("0.2");

  // The option is there for this wallet only once the operator has allowed it; a list it can't pay is refused in words.
  await form.getByRole("checkbox", { name: "Airdrop part of it to other wallets" }).check();
  const list = form.getByRole("textbox", { name: "Wallets and amounts" });
  await list.fill("not a wallet, 5");
  await expect(form.getByText("Line 1: write a wallet address, then the number of coins it gets.")).toBeVisible();
  await list.fill(`${recipients[0]}, 1,000\n${recipients[1]}, 2500.5`);
  await expect(summary.getByText(`3,500.5 ${symbol} to 2 wallets`)).toBeVisible();
  await expect(summary.getByText(/^[\d,]+ \w+ \([\d.]+%\)$/)).toBeVisible();
  await summary.getByRole("button", { name: `Stoke ${symbol}` }).click();

  // The launch lands on the Creator page, which sends the airdrop.
  await expect(page).toHaveURL(/\/creator#airdrops$/, { timeout: 60_000 });
  const mint = (await listLaunches()).find((l) => l.symbol === symbol)!.mint;
  const panel = page.locator(`[data-airdrop="${mint}"]`);
  await expect(panel.getByText("0 of 2 paid")).toBeVisible();
  await panel.getByRole("button", { name: "Send airdrop" }).click();
  await expect(panel.getByText("2 of 2 paid")).toBeVisible({ timeout: 60_000 });
  expect(await coinBalance(new PublicKey(recipients[1]!), mint)).toBe(2_500_500_000n);
});
