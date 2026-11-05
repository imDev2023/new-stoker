// What a Creator does on Stoke a coin, end to end against the real chain, API and Indexer: the test wallet launches a
// coin paired with SOL with a First Buy, and a Reward Launch paired with a stablecoin, from the page; meets the launch
// disclaimer when the browser has no acceptance; is refused a copy of a protected coin before anything is prepared; and
// can decline in the wallet. Each launch lands on the coin's own page.
import type { Page } from "@playwright/test";
import { LaunchSummary } from "@launchpad/contract";
import { coinBalance, coinImage, expect, forgetDisclaimer, fundedKeypair, launchViaApi, QUOTES, stackEnv, test } from "./fixtures";
import { DIALOG_STYLES } from "./shots";
import { connectTestWallet } from "./wallet";

const LAUNCHLAB = "DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6";

const form = (page: Page) => page.getByRole("form", { name: "Stoke a coin" });
const summary = (page: Page) => page.getByRole("complementary", { name: "Launch summary" });
const verdict = (page: Page, field: "name" | "symbol" | "image") => page.locator(`[data-copy="${field}"]`);

async function readLaunch(mint: string) {
  return LaunchSummary.parse(await (await fetch(`${stackEnv().apiUrl}/v1/launches/${mint}`)).json());
}

/** Opens the form and connects the test wallet from the summary's own button. */
async function openConnected(page: Page, path = "/launch") {
  await page.goto(path);
  await connectTestWallet(page, summary(page).getByRole("button", { name: "Connect wallet" }));
  await expect(summary(page).getByRole("button", { name: /^Stoke / })).toBeVisible();
}

/** Fills the coin's picture, name and ticker, and waits for Copy Protection's verdicts on all three. */
async function fillCoin(page: Page, name: string, symbol: string, image = coinImage(symbol)) {
  await form(page).getByLabel("Add image").setInputFiles({ name: `${symbol}.png`, mimeType: "image/png", buffer: image });
  await form(page).getByRole("textbox", { name: "Name" }).fill(name);
  await form(page).getByRole("textbox", { name: "Ticker" }).fill(symbol);
  for (const field of ["name", "symbol", "image"] as const) await expect(verdict(page, field)).toBeVisible();
}

test("a Creator launches a coin paired with SOL with a First Buy, and lands on its page", async ({ page, wallet }) => {
  await openConnected(page);
  // The pair starts on SOL, the first of the recommended three; Holder rewards is shown and takes no choice.
  const pairs = form(page).getByRole("radiogroup", { name: "Paired with" });
  await expect(pairs.getByRole("radio")).toHaveCount(3);
  await expect(pairs.getByRole("radio").first()).toBeChecked();
  await expect(form(page).getByRole("radio", { name: /Holder rewards/ })).toBeDisabled();

  await fillCoin(page, "Tracer Bullet", "TRCR");
  await expect(verdict(page, "name")).toHaveText("Free");
  await expect(verdict(page, "symbol")).toHaveText("Free");
  await expect(verdict(page, "image")).toHaveText("Not a protected coin's image");
  await form(page).getByRole("textbox", { name: "Description" }).fill("Launched from the form by the suite.");
  await form(page).getByRole("textbox", { name: "Telegram" }).fill("https://t.me/tracerbullet");
  await form(page).getByRole("textbox", { name: "Website" }).fill("https://example.com/tracer");

  // The summary follows the form: the pair, the name, and what the First Buy gets, with no fee figure, only the link.
  await expect(summary(page).getByText("TRCR/SOL")).toBeVisible();
  await expect(summary(page).getByText("Tracer Bullet")).toBeVisible();
  await form(page).getByLabel("First buy").fill("0.1");
  await expect(summary(page).getByText(/^0\.1 SOL for [\d,]+ TRCR, \d+(\.\d+)?%$/)).toBeVisible();
  await expect(summary(page).getByRole("link", { name: "Half of what we collect" })).toHaveAttribute("href", "/fees");
  // The only percentage is the Creator's own: the First Buy's share of the supply.
  await expect(summary(page).locator("dd").filter({ hasText: "%" })).toHaveCount(1);

  // A browser without the welcome's acceptance meets the launch disclaimer first; the wallet is asked only after it.
  await forgetDisclaimer(page);
  await summary(page).getByRole("button", { name: "Stoke TRCR" }).click();
  const disclaimer = page.getByRole("dialog", { name: "Before you launch" });
  await expect(disclaimer).toBeVisible();
  expect(wallet.requests).toHaveLength(0);
  await disclaimer.getByRole("checkbox").check();
  await disclaimer.getByRole("button", { name: "Continue" }).click();

  // One signature, the launch and its First Buy in one LaunchLab transaction, then the coin's own page.
  await expect(page).toHaveURL(/\/coin\/[1-9A-HJ-NP-Za-km-z]{32,44}$/, { timeout: 30_000 });
  expect(wallet.requests).toHaveLength(1);
  expect(wallet.requests[0]!.message.compiledInstructions.map((ix) => wallet.requests[0]!.message.staticAccountKeys[ix.programIdIndex]?.toBase58())).toContain(LAUNCHLAB);
  const mint = page.url().split("/").at(-1)!;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("TRCR");
  const launch = await readLaunch(mint);
  expect(launch).toMatchObject({ name: "Tracer Bullet", symbol: "TRCR", creator: wallet.keypair.publicKey.toBase58(), rewardTax: null });
  expect(launch.quote.mint).toBe(QUOTES.SOL.toBase58());
  expect(launch.links).toMatchObject({ telegram: "https://t.me/tracerbullet", website: "https://example.com/tracer", x: null });
  expect(await coinBalance(wallet.keypair, mint)).toBeGreaterThan(0n);
});

test("a Creator launches a Reward Launch paired with a stablecoin, paid in it, with a link behind More links", async ({ page, wallet }) => {
  await openConnected(page);
  const pairs = form(page).getByRole("radiogroup", { name: "Paired with" });
  await pairs.locator("label").filter({ hasText: "USDC" }).click();
  await expect(form(page).getByLabel("First buy").locator("..")).toContainText("USDC");
  await fillCoin(page, "Dollar Dividend", "DDIV");

  const types = form(page).getByRole("radiogroup", { name: "Launch type" });
  await types.locator("label").filter({ hasText: "paid in USDC" }).click();
  await form(page).getByRole("radiogroup", { name: "Reward Tax" }).getByText("3%", { exact: true }).click();
  await expect(summary(page).getByText("Reward Launch, 3%")).toBeVisible();

  // Four more kinds wait behind one button.
  await expect(form(page).getByRole("textbox", { name: "Discord" })).toHaveCount(0);
  await form(page).getByRole("button", { name: "More links" }).click();
  await form(page).getByRole("textbox", { name: "Discord" }).fill("https://discord.gg/ddiv");

  await summary(page).getByRole("button", { name: "Stoke DDIV" }).click();
  await expect(page).toHaveURL(/\/coin\/[1-9A-HJ-NP-Za-km-z]{32,44}$/, { timeout: 30_000 });
  expect(wallet.requests).toHaveLength(1);
  const launch = await readLaunch(page.url().split("/").at(-1)!);
  expect(launch.quote.mint).toBe(QUOTES.USDC.toBase58());
  expect(launch.rewardTax).toMatchObject({ bps: 300, payout: "quote" });
  expect(launch.links.discord).toBe("https://discord.gg/ddiv");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DDIV");
});

test("a copy of a protected coin is refused on the form before anything is prepared", async ({ page, wallet }) => {
  // Launched just now by someone else, so it is inside the test stack's window.
  const symbol = "GUARD";
  await launchViaApi(await fundedKeypair(), { name: "Guarded Coin", symbol });
  await openConnected(page);
  await fillCoin(page, "Guarded Coin", symbol, coinImage(symbol));
  await expect(verdict(page, "name")).toHaveText(/^Taken by Guarded Coin \(GUARD\) until \w+ \d+$/);
  await expect(verdict(page, "symbol")).toHaveText(/^Taken by Guarded Coin \(GUARD\) until \w+ \d+$/);
  await expect(verdict(page, "image")).toHaveText(/^A copy of GUARD's image, protected until \w+ \d+$/);
  await expect(verdict(page, "symbol")).toHaveAttribute("data-status", "taken");
  await expect(form(page).getByRole("group", { name: "Your coin" })).toHaveScreenshot("launch-copy.png", { mask: [page.locator("time")] });

  // Pressing on says what is refused, in the API's words, and the wallet is never asked.
  await summary(page).getByRole("button", { name: "Stoke GUARD" }).click();
  await expect(summary(page).getByRole("alert")).toContainText("GUARD");
  expect(wallet.requests).toHaveLength(0);

  // A near copy is caught too: one letter off.
  await form(page).getByRole("textbox", { name: "Ticker" }).fill("GUARDS");
  await expect(verdict(page, "symbol")).toHaveText(/^Too close to GUARD \(Guarded Coin\), protected until \w+ \d+$/);
});

test("declining in the wallet launches nothing and says so", async ({ page, wallet }) => {
  await openConnected(page);
  await fillCoin(page, "Never Signed", "NOSIG");
  wallet.declineNext();
  await summary(page).getByRole("button", { name: "Stoke NOSIG" }).click();
  await expect(summary(page).getByRole("alert")).toHaveText("You declined the transaction in your wallet. Nothing was launched.");
  expect(wallet.requests).toHaveLength(1);
  // The form is the Creator's again, and the button asks once more.
  await expect(summary(page).getByRole("button", { name: "Stoke NOSIG" })).toBeEnabled();
  await expect(form(page).getByRole("textbox", { name: "Ticker" })).toBeEditable();
});

test("what is missing is said before anything is prepared", async ({ page, wallet }) => {
  await openConnected(page);
  await summary(page).getByRole("button", { name: "Stoke a coin" }).click();
  await expect(summary(page).getByRole("alert")).toHaveText("Add an image for your coin.");
  await form(page).getByLabel("Add image").setInputFiles({ name: "coin.png", mimeType: "image/png", buffer: coinImage("MISS") });
  await summary(page).getByRole("button", { name: "Stoke a coin" }).click();
  await expect(summary(page).getByRole("alert")).toHaveText("Name your coin.");
  expect(wallet.requests).toHaveLength(0);
});

test("an asset's page opens the form on that asset, the rest in the picker", async ({ page }) => {
  await page.goto(`/launch?quote=${QUOTES.JTO.toBase58()}`);
  const other = form(page).getByRole("combobox", { name: "Any other asset" });
  await expect(other.locator("option:checked")).toHaveText(/^JTO/);
  await expect(form(page).getByRole("radiogroup", { name: "Paired with" }).getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(form(page).getByLabel("First buy").locator("..")).toContainText("JTO");
  // A recommended pick takes over from the picker.
  await form(page).getByRole("radiogroup", { name: "Paired with" }).locator("label").filter({ hasText: "SOL" }).click();
  await expect(other).toHaveValue("");
});

test.describe("the welcome's acceptance cleared", () => {
  test("the launch disclaimer", async ({ page, wallet }) => {
    await openConnected(page);
    await fillCoin(page, "Dialog Shot", "DLOG");
    await forgetDisclaimer(page);
    await summary(page).getByRole("button", { name: "Stoke DLOG" }).click();
    const disclaimer = page.getByRole("dialog", { name: "Before you launch" });
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toHaveScreenshot("launch-disclaimer.png", { stylePath: DIALOG_STYLES });
    await disclaimer.getByRole("button", { name: "Cancel" }).click();
    await expect(disclaimer).toBeHidden();
    // Cancelled, nothing is prepared and the wallet is never asked.
    expect(wallet.requests).toHaveLength(0);
  });
});
