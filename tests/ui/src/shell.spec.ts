// The shell's behaviour on the seeded stack: the header and its sections, the phone bar, the footer, the light-or-dark
// toggle, the wallet, the welcome, the pulse strip, the legal pages, and the rule that no program
// code ever reaches the browser (ADR 0003).
import { PlatformStats } from "@launchpad/contract";
import { expect, expectNoHorizontalOverflow, test } from "./fixtures";
import { connectFromSite } from "./wallet";

const SECTIONS = ["Explore", "Stocks", "Swap", "Assets", "Rewards", "Stats", "Curated", "Developers"];

test("the header names the eight sections and marks the one a page belongs to", async ({ page }) => {
  await page.goto("/terms");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Stoker home" })).toHaveAttribute("href", "/");
  const sections = header.getByRole("navigation", { name: "Sections" }).getByRole("link");
  await expect(sections).toHaveText(SECTIONS);
  await expect(header.getByRole("link", { name: "Stoke a coin" })).toHaveAttribute("href", "/launch");
  await expect(header.locator('[aria-current="page"]')).toHaveCount(0);

  // A detail page belongs to its list's section, and Burns to Stats.
  const marks = [["/coins", "Explore"], ["/coin/abc", "Explore"], ["/stock/abc", "Stocks"], ["/asset/abc", "Assets"], ["/burns", "Stats"], ["/api", "Developers"]] as const;
  for (const [path, section] of marks) {
    await page.goto(path);
    await expect(header.locator('[aria-current="page"]'), path).toHaveText(section);
  }
});

test("just above the phone bar the header keeps to the window, the last two sections waiting for the room", async ({ page }) => {
  const sections = page.getByRole("banner").getByRole("navigation", { name: "Sections" }).getByRole("link");
  // The row can run into the shell's gutter without widening the page, so the actions' edge is held to the shell's column.
  const insideColumn = () =>
    page.evaluate(() => {
      const row = document.querySelector("header .shell")!;
      const edge = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
      return row.lastElementChild!.getBoundingClientRect().right <= edge + 0.5;
    });
  for (const width of [901, 960, 1080]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/terms");
    await expect(sections, `${width}px`).toHaveText(SECTIONS.slice(0, 6));
    await expectNoHorizontalOverflow(page);
    expect(await insideColumn(), `${width}px`).toBe(true);
  }
  await page.setViewportSize({ width: 1081, height: 800 });
  await page.goto("/terms");
  await expect(sections).toHaveText(SECTIONS);
  await expectNoHorizontalOverflow(page);
  expect(await insideColumn(), "1081px").toBe(true);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the sections move to the phone bar at the window's foot, the first five of them", async ({ page }) => {
    await page.goto("/coins");
    await expect(page.getByRole("banner").getByRole("navigation")).toBeHidden();
    const bar = page.getByRole("navigation", { name: "Sections" });
    await expect(bar.getByRole("link")).toHaveText(SECTIONS.slice(0, 5));
    await expect(bar.locator('[aria-current="page"]')).toHaveText("Explore");
    const box = await bar.boundingBox();
    expect(box && Math.round(box.y + box.height)).toBe(844);
    // The account stays in the header.
    await expect(page.getByRole("banner").getByRole("button", { name: "Connect wallet" })).toBeVisible();
  });
});

test("the footer's four groups, the socials and the risk sentence", async ({ page }) => {
  await page.goto("/privacy");
  const footer = page.getByRole("contentinfo");
  const groups: Record<string, string[]> = {
    Trade: ["Explore", "Stocks", "Swap", "Assets"],
    Create: ["Stoke a coin", "Rewards", "Curated"],
    Records: ["Stats", "Burns", "Announcements", "Developers"],
    Legal: ["Fees", "Terms", "Privacy", "Risk disclosure"],
  };
  for (const [group, links] of Object.entries(groups)) await expect(footer.getByRole("navigation", { name: group }).getByRole("link")).toHaveText(links);
  await expect(footer).toContainText("Coins launched here are speculative and can lose all their value.");
  await expect(footer).toContainText("Not offered in the United States, the United Kingdom, Canada or sanctioned countries. Nothing here is financial advice.");
  await expect(footer.getByRole("link", { name: "info@stoker.markets" })).toHaveAttribute("href", "mailto:info@stoker.markets");
});

test("light or dark: the account menu's toggle holds across a reload", async ({ page, context }) => {
  await page.goto("/terms");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");
  const menu = page.getByRole("banner").getByRole("button", { name: "Connect wallet" });
  const toggle = page.getByRole("menuitem", { name: "Dark mode" });
  await expect(async () => {
    if (!(await toggle.isVisible())) await menu.click();
    await expect(toggle).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 13, 10)");
  expect((await context.cookies()).find((c) => c.name === "scheme")?.value).toBe("dark");

  // The server writes the choice, so the page never paints the other scheme first.
  const html2 = await (await page.request.get("/terms")).text();
  expect(html2).toMatch(/<html[^>]*data-theme="dark"/);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await menu.click();
  await page.getByRole("menuitem", { name: "Light mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(238, 241, 234)");
});

test("the wallet connects from the header and disconnects from its menu", async ({ page, wallet }) => {
  await page.goto("/risk");
  await connectFromSite(page);
  const header = page.getByRole("banner");
  const address = wallet.keypair.publicKey.toBase58();
  const account = header.getByRole("button", { name: `${address.slice(0, 4)}…${address.slice(-4)}` });
  await expect(account).toBeVisible();
  await account.click();
  // A wallet that has launched nothing is offered no earnings page.
  await expect(page.getByRole("menuitem", { name: "Your earnings" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Disconnect" }).click();
  await expect(header.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  expect(wallet.requests).toHaveLength(0);
});

test.describe("a first visit", () => {
  test.use({ firstVisit: true });

  test("the welcome opens once, and Continue accepts it for the browser", async ({ page }) => {
    await page.goto("/terms");
    const welcome = page.getByRole("dialog", { name: "Welcome to Stoker" });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("link", { name: "Risk disclosure" })).toHaveAttribute("target", "_blank");
    await welcome.getByRole("button", { name: "Continue" }).click();
    await expect(welcome).toHaveCount(0);
    // The close event that records it comes a task after the dialog hides.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("launchpad.disclaimer.v1"))).toBe("accepted");
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Escape accepts the welcome too, since it blocks nothing", async ({ page }) => {
    await page.goto("/risk");
    const welcome = page.getByRole("dialog", { name: "Welcome to Stoker" });
    await expect(welcome).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(welcome).toHaveCount(0);
    // The close event that records it comes a task after the dialog hides.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("launchpad.disclaimer.v1"))).toBe("accepted");
    await page.goto("/terms");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Connect wallet" })).toBeEnabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("the pulse shows the platform's real figures on every page but home", async ({ page, stack }) => {
  const stats = PlatformStats.parse(await (await fetch(`${stack.apiUrl}/v1/stats`)).json());
  expect(stats.launches).toBeGreaterThan(0);
  await page.goto("/terms");
  const pulse = page.getByLabel("Platform now");
  await expect(pulse.getByRole("term")).toHaveText(["24h volume", "Coins", ...(stats.graduated ? ["Graduated"] : [])]);
  await expect(pulse.getByRole("definition").nth(1)).toHaveText(stats.launches.toLocaleString("en-US"));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-pulse]")).toHaveCount(0);
});

test("each legal page's contents rail leads to its sections", async ({ page }) => {
  for (const [path, count] of [["/terms", 7], ["/privacy", 5], ["/risk", 6]] as const) {
    await page.goto(path);
    const rail = page.getByRole("navigation", { name: "On this page" }).getByRole("link");
    await expect(rail).toHaveCount(count);
    for (const link of await rail.all()) {
      const id = (await link.getAttribute("href"))!.slice(1);
      await expect(page.locator(`h2[id="${id}"]`), `${path}#${id}`).toHaveText((await link.textContent())!);
    }
  }
  await page.goto("/risk");
  await expect(page.getByRole("article")).toContainText("Coins launched here are speculative and can lose all their value. Most new coins do.");
});

test("no Raydium SDK or program code ships to the browser", async ({ page, wallet }) => {
  const scripts: { url: string; body: string }[] = [];
  page.on("response", async (res) => {
    if (res.request().resourceType() === "script") scripts.push({ url: res.url(), body: await res.text().catch(() => "") });
  });
  await page.goto("/terms");
  await connectFromSite(page);
  await page.goto("/risk");
  await page.goto("/nothing-here");
  await page.waitForLoadState("networkidle");
  expect(scripts.length).toBeGreaterThan(0);
  expect(wallet.requests).toHaveLength(0);

  const forbidden = [
    /@raydium-io/,
    /raydium-sdk/i,
    /@launchpad\/chain/,
    /@coral-xyz\/anchor/,
    // LaunchLab program ids (devnet, mainnet): only the API may know them.
    /DRay6fNdQ5J82H7xV6uq2aV3mNrUZ1J4PgSKsWgptcm6/,
    /LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj/,
  ];
  const hits = scripts.flatMap((s) => forbidden.filter((re) => re.test(s.body)).map((re) => `${re} in ${s.url}`));
  expect(hits).toEqual([]);
});
