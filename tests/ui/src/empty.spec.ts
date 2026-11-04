// The shell and the static pages before anything has launched, at desktop and phone width, light and dark: every control
// is there, and the pulse strip waits for a real figure.
import { expect, test } from "./fixtures";
import { snap } from "./shots";

const DOCUMENTS = [
  ["/terms", "terms", "Terms of use"],
  ["/privacy", "privacy", "Privacy"],
  ["/risk", "risk", "Risk disclosure"],
] as const;

for (const [path, name, title] of DOCUMENTS) {
  test(`${name} page`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Connect wallet" })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Stoke a coin" })).toBeVisible();
    // Nothing has launched or traded, so no figure is real yet and the strip stays out.
    await expect(page.locator("[data-pulse]")).toHaveCount(0);
    await snap(page, `${name}.png`);
  });
}

test("not found", async ({ page }) => {
  const res = await page.goto("/nothing-here");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Nothing here." })).toBeVisible();
  await snap(page, "404.png");
});
