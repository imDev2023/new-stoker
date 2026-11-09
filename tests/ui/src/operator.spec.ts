// The operator console end to end (#13): the token opens it and a wrong one is refused; it runs a job, allows a Creator
// an airdrop at launch and takes it back, saves the region gates, issues and revokes an API key, announces a fee change
// and prepares the admin's transaction for one that is due. Every change is checked against the API behind it.
import type { Page } from "@playwright/test";
import { Keypair } from "@solana/web3.js";
import { ApiKeyList, FeeAnnouncementList, LaunchPermissions, RegionGatesView } from "@launchpad/contract";
import { expect, stackEnv, test } from "./fixtures";

const asOperator = async <T>(path: string, schema: { parse: (v: unknown) => T }) => {
  const { apiUrl, operatorToken } = stackEnv();
  return schema.parse(await (await fetch(`${apiUrl}${path}`, { headers: { authorization: `Bearer ${operatorToken}` } })).json());
};

async function openConsole(page: Page, token = stackEnv().operatorToken) {
  await page.goto("/operator");
  const signIn = page.getByRole("form", { name: "Open the console" });
  await signIn.getByLabel("Operator token").fill(token);
  await signIn.getByRole("button", { name: "Open" }).click();
}

test.describe("the operator console", () => {
  // The refused token answers 401, which the browser logs.
  test.use({ expectedHttpErrors: [/\/v1\/operator\//] });

  test("a wrong token is refused; the right one opens the console and stays for the tab", async ({ page }) => {
    await openConsole(page, "not-the-token");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("That token was refused.");
    await expect(page.getByRole("form", { name: "Open the console" })).toBeVisible();

    await openConsole(page);
    await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["At a glance", "Alerts", "Jobs", "Fee changes", "Airdrop creators", "Region gates", "API keys"]);
    await page.reload();
    await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
    await page.getByRole("button", { name: "Forget the token" }).click();
    await expect(page.getByRole("form", { name: "Open the console" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("form", { name: "Open the console" })).toBeVisible();
  });
});

test("runs a job by hand", async ({ page }) => {
  await openConsole(page);
  await page.getByRole("group", { name: "Run a job now" }).getByRole("button", { name: "Run creator-forward" }).click();
  await expect(page.getByRole("status").filter({ hasText: "creator-forward:" })).toHaveText(/^creator-forward: (succeeded|skipped)$/, { timeout: 60_000 });
  await expect(page.locator('[data-job="creator-forward"]')).toBeVisible();
});

test("allows a Creator an airdrop at launch, then takes it back", async ({ page }) => {
  const wallet = Keypair.generate().publicKey.toBase58();
  const permitted = () => asOperator(`/v1/creators/${wallet}/launch-permissions`, LaunchPermissions).then((p) => p.airdrop);
  expect(await permitted()).toBe(false);
  await openConsole(page);
  const form = page.getByRole("form", { name: "Allow a Creator an airdrop" });
  await form.getByLabel("Creator wallet").fill(wallet);
  await form.getByRole("button", { name: "Allow" }).click();
  const row = page.getByRole("table", { name: "Allowed Creators" }).locator(`[data-wallet="${wallet}"]`);
  await expect(row).toBeVisible();
  await expect.poll(permitted).toBe(true);
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
  await expect.poll(permitted).toBe(false);
});

test("saves the region gates whole, and empties them again", async ({ page }) => {
  await openConsole(page);
  const gates = page.getByRole("form", { name: "Region gates" });
  await gates.getByRole("button", { name: "Add a feature" }).click();
  await gates.getByLabel("Feature").fill("test-feature");
  await gates.getByLabel("Withheld in").fill("gb ca");
  await gates.getByRole("button", { name: "Save the table" }).click();
  await expect(gates.getByRole("status")).toHaveText("Saved");
  expect((await asOperator("/v1/operator/region-gates", RegionGatesView)).gates).toEqual({ "test-feature": ["GB", "CA"] });
  // Written back as the API keeps it, countries in capitals.
  await expect(gates.getByLabel("Withheld in")).toHaveValue("GB, CA");

  await gates.getByRole("button", { name: "Remove" }).click();
  await gates.getByRole("button", { name: "Save the table" }).click();
  await expect(gates.getByRole("status")).toHaveText("Saved");
  expect((await asOperator("/v1/operator/region-gates", RegionGatesView)).gates).toEqual({});
});

test("issues an API key shown once, then revokes it", async ({ page }) => {
  await openConsole(page);
  const name = `Bot ${Date.now()}`;
  const form = page.getByRole("form", { name: "Issue an API key" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Requests a minute").fill("30");
  await form.getByRole("button", { name: "Issue a key" }).click();
  const shown = page.getByRole("textbox", { name: "the key" });
  await expect(shown).not.toHaveValue("");
  const issued = (await asOperator("/v1/operator/api-keys", ApiKeyList)).keys.find((k) => k.name === name)!;
  expect(issued.rateLimitPerMinute).toBe(30);
  const row = page.locator(`[data-key="${issued.id}"]`);
  await expect(row).toContainText("30 a minute");
  await row.getByRole("button", { name: "Revoke" }).click();
  await expect(row.getByText("Revoked")).toBeVisible();
  expect((await asOperator("/v1/operator/api-keys", ApiKeyList)).keys.find((k) => k.id === issued.id)?.revokedAt).not.toBeNull();
});

test("announces a fee change, and prepares the admin's transaction for one that is due", async ({ page }) => {
  await openConsole(page);
  const form = page.getByRole("form", { name: "Announce a fee change" });
  await form.getByLabel("Platform Fee, bps").fill("95");
  await form.getByLabel("Creator Fee, bps").fill("5");
  // Two months ahead, in the browser's own time, as the field takes it.
  const when = new Date(Date.now() + 60 * 86_400_000);
  const local = new Date(when.getTime() - when.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await form.getByLabel("Effective at").fill(local);
  await form.getByLabel("Note").fill("Announced from the console.");
  await form.getByRole("button", { name: "Announce" }).click();
  const announced = page.getByRole("table", { name: "Announced fee changes" }).locator("tr").filter({ hasText: "Announced from the console." });
  await expect(announced).toContainText("Platform 95 bps, Creator 5 bps");
  await expect(announced.getByText("Announced", { exact: true })).toBeVisible();
  const { announcements } = await asOperator("/v1/announcements", FeeAnnouncementList);
  expect(announcements.find((a) => a.note === "Announced from the console.")).toMatchObject({ platformFeeBps: 95, creatorFeeBps: 5 });

  // The seed's change due and waiting for the admin: its unsigned transaction, to copy for the cold key.
  await page.getByRole("button", { name: "Prepare the admin's transaction" }).first().click();
  await expect(page.getByRole("textbox", { name: "the transaction" })).toHaveValue(/^[A-Za-z0-9+/=]{100,}$/);
});
