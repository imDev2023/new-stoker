// How every visual spec takes a shot: the page settled, checked for overflow and cut text, then captured whole with what
// changes from run to run masked.
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, expectHydrated, expectNoHorizontalOverflow, expectNoTruncatedText } from "./fixtures";

/**
 * What varies between runs: times, canvases (a chart's axis follows the clock), anything in the mono face (addresses,
 * signatures) and the wallet's avatar, whose hues come from an address drawn afresh every run. Only what is visible: a
 * mask paints an element's whole box, even one hidden inside a closed <details>.
 */
export const dynamic = (page: Page) => ["time", ".mono:not(input)", "canvas", "[data-avatar]"].map((s) => page.locator(s).filter({ visible: true }));

/** The suite's screenshot styles plus the dialog's own; a call's `stylePath` replaces the config's, so both are named. */
export const DIALOG_STYLES = ["screenshot.css", "dialog.css"].map((name) => fileURLToPath(new URL(`./${name}`, import.meta.url)));

/** A full-page shot of the settled page. */
export async function snap(page: Page, name: string, mask = dynamic) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // The page scrolls under a resting pointer below, and whatever passes beneath it is hovered: park it first.
  await page.mouse.move(0, 0);
  // A full-page capture doesn't scroll, so lazy images far below the fold would load or not depending on timing: scroll
  // past every one, as a reader would, and wait for those within the page's width.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    const within = (img: HTMLImageElement) => {
      const r = img.getBoundingClientRect();
      return r.right > 0 && r.left < window.innerWidth;
    };
    await Promise.all([...document.images].filter(within).map((img) => img.decode().catch(() => undefined)));
  });
  // Hydrated before the shot, so the caret Playwright hides is on a field React already holds.
  await expectHydrated(page);
  await expectNoTruncatedText(page);
  await expectNoHorizontalOverflow(page);
  // A capture of a scrolled page stitches the sticky header into the middle: back to the top, and held there.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY), { message: "the page is not at the top" }).toBe(0);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, { fullPage: true, mask: mask(page) });
}
