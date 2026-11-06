// The API page end to end (#12): every read the reference names answers on the stack, and every link of its rail lands
// on its section.
import { CoinRewards } from "@launchpad/contract";
import { expect, listLaunches, SEED_CREATOR, stackEnv, test } from "./fixtures";
import { AIRDROP_SENDING, REWARD_QUOTE } from "./seedData";

const SOL = "So11111111111111111111111111111111111111112";

test("every read the reference names answers on the stack", async ({ page }) => {
  const { apiUrl } = stackEnv();
  const launches = await listLaunches();
  const mintOf = (symbol: string) => launches.find((l) => l.symbol === symbol)!.mint;
  const rewardCoin = mintOf(REWARD_QUOTE.symbol);
  const airdropCoin = mintOf(AIRDROP_SENDING.symbol);
  const rewards = CoinRewards.parse(await (await fetch(`${apiUrl}/v1/launches/${rewardCoin}/rewards`)).json());
  expect(rewards.rounds.length, "the seed paid a round").toBeGreaterThan(0);

  /** The path with a seeded coin, asset, wallet or round in each of its parameters. */
  const filled = (path: string) =>
    path
      .replace(/^\/quotes\/:mint/, `/quotes/${SOL}`)
      .replace(/^\/launches\/:mint\/airdrop/, `/launches/${airdropCoin}/airdrop`)
      .replace(/:mint/g, rewardCoin)
      .replace(/:address/g, SEED_CREATOR.publicKey.toBase58())
      .replace(/:id/g, rewards.rounds[0]!.id)
      .replace(/\?interval=$/, "?interval=1h")
      // A quote is asked for a trade: a buy of 0.1 SOL of the Reward Launch, paired with SOL.
      .replace(/\/quote$/, "/quote?side=buy&amount=100000000");

  await page.goto("/api");
  const lines = page.locator("#reading dt > span");
  const reads = await lines.evaluateAll((spans) =>
    spans.map((s) => [s.children[0]?.textContent ?? "", s.querySelector("code")?.textContent ?? ""] as [string, string]),
  );
  expect(reads.length).toBeGreaterThan(20);
  for (const [method, path] of reads) {
    expect(method, path).toBe("GET");
    const url = path === "/health" ? `${apiUrl}/health` : `${apiUrl}/v1${filled(path)}`;
    const res = await fetch(url);
    expect(res.status, `${path}: ${url}`).toBe(200);
  }
});

test("each link of the rail lands on its section", async ({ page }) => {
  await page.goto("/api");
  const rail = page.getByRole("navigation", { name: "On this page" }).getByRole("link");
  for (const href of await rail.evaluateAll((links) => links.map((a) => a.getAttribute("href")!))) {
    await expect(page.locator(`section${href}`), href).toHaveCount(1);
  }
  await rail.filter({ hasText: "Errors" }).click();
  await expect(page).toHaveURL(/#errors$/);
  await expect(page.getByRole("heading", { level: 2, name: "Errors" })).toBeInViewport();
});
