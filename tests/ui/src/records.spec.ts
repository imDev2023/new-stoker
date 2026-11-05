// The records end to end (#11): the Flywheel's buy and burn reaches its page with its transaction, the Ledger pages back
// through every entry, each figure links to the record it comes from, and an applied fee change links to its transaction.
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BurnsPage, FeeAnnouncementList, LedgerPage } from "@launchpad/contract";
import { expect, fundedKeypair, listLaunches, runFeeCollector, stackEnv, test, tradeViaApi } from "./fixtures";

const api = async <T>(path: string, schema: { parse: (v: unknown) => T }) => schema.parse(await (await fetch(`${stackEnv().apiUrl}${path}`)).json());

/** Runs the Burn's Cron Trigger once, as its hourly schedule would: the Burn, then the Flywheel. */
async function runBurn() {
  const { apiUrl, operatorToken } = stackEnv();
  const res = await fetch(`${apiUrl}/v1/operator/jobs/burn`, { method: "POST", headers: { authorization: `Bearer ${operatorToken}` } });
  const body = (await res.json()) as { status: string };
  if (!res.ok || body.status !== "succeeded") throw new Error(`the burn job failed: ${res.status} ${JSON.stringify(body)}`);
}

test("the Flywheel's buy and burn, with its transaction", async ({ page }) => {
  await runBurn();
  const burns = await api("/v1/burns", BurnsPage);
  const event = burns.events.find((e) => e.kind === "flywheel");
  expect(event, "the Flywheel bought and burned the graduated coin").toBeTruthy();
  await page.goto("/burns");
  // Each figure links to the record it is summed from.
  const figures = page.getByRole("region", { name: "Figures" });
  await expect(figures.getByRole("term")).toContainText(["Revenue so far", "Spent on the Flywheel"]);
  await expect(figures.locator('[data-figure="flywheel"] a')).toHaveAttribute("href", "#events");
  await expect(figures.locator('[data-figure="revenue"] a')).toHaveAttribute("href", "/revenue#ledger");
  const rows = page.getByRole("table", { name: "Every buy and burn" }).locator("tbody tr");
  await expect(rows.first()).toContainText(`The Flywheel · ${event!.coin.symbol}`);
  await expect(rows.first().locator("td.r a")).toHaveAttribute("href", new RegExp(`/tx/${event!.signature}\\?`));
  // A pick links to its coin.
  const gown = (await listLaunches()).find((l) => l.symbol === "GOWN")!;
  await expect(page.getByRole("region", { name: "The Flywheel's next picks" }).getByRole("link", { name: "GOWN" })).toHaveAttribute("href", `/coin/${gown.mint}`);
  // The run is on the Ledger too.
  await page.goto("/revenue");
  await expect(page.getByRole("table", { name: "Ledger" }).locator('tbody tr[data-kind="flywheel"]')).not.toHaveCount(0);
});

test("the Ledger pages back through every entry", async ({ page }) => {
  // Trade and collect until the Ledger holds more than one page (20 entries).
  const trader = await fundedKeypair(5);
  // Q's curve is far from its target, so the buys never sell it out.
  const q = (await listLaunches()).find((l) => l.symbol === "Q")!;
  for (let i = 0; i < 8 && (await api("/v1/ledger?limit=20", LedgerPage)).next === null; i++) {
    await tradeViaApi(trader, q.mint, "buy", BigInt(0.05 * LAMPORTS_PER_SOL));
    await runFeeCollector();
  }
  const first = await api("/v1/ledger?limit=20", LedgerPage);
  expect(first.next, "the Ledger has a second page").not.toBeNull();
  const all = await api("/v1/ledger?limit=100", LedgerPage);

  await page.goto("/revenue");
  const figures = page.getByRole("region", { name: "Figures" });
  await expect(figures.locator('[data-figure="revenue"] a')).toHaveAttribute("href", "#ledger");
  await expect(figures.locator('[data-figure="creators"] a')).toHaveAttribute("href", "#ledger");
  const rows = page.getByRole("table", { name: "Ledger" }).locator("tbody tr");
  await expect(rows).toHaveCount(20);
  // Every entry links to its transaction.
  for (const e of first.entries) await expect(rows.locator(`a[href*="/tx/${e.signature}?"]`).first()).toBeVisible();
  const older = page.getByRole("button", { name: "Older entries" });
  while (await older.isVisible()) {
    const shown = await rows.count();
    await older.click();
    await expect(rows).not.toHaveCount(shown);
  }
  // The whole Ledger, once each, and the button gone after the last page.
  await expect(rows).toHaveCount(all.entries.length);
  await expect(older).toHaveCount(0);
});

test("an applied fee change links to its transaction", async ({ page }) => {
  const applied = (await api("/v1/announcements", FeeAnnouncementList)).announcements.find((a) => a.appliedSignature);
  expect(applied, "the seed applied a fee change").toBeTruthy();
  await page.goto("/announcements");
  await expect(page.getByRole("link", { name: "Applied" })).toHaveAttribute("href", new RegExp(`/tx/${applied!.appliedSignature}\\?`));
});
