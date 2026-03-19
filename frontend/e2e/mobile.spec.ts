/**
 * Mobile-specific E2E tests
 *
 * All tests in this file run at iPhone 12 dimensions (390×844, touch enabled).
 * They execute across all configured projects (chromium, webkit, mobile-chrome,
 * mobile-safari) so we catch browser-specific regressions too.
 *
 * Tests marked [MOBILE BUG] are expected to FAIL until the bug is fixed.
 */

import { test, expect } from "@playwright/test";
import { mockBackend, fakeJpeg, fakeHeic } from "./helpers";

// Set mobile viewport for every test in this file
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.beforeEach(async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");
});

// ── MOBILE BUGS (intentionally failing until fixed) ───────────────────────────

test("[MOBILE BUG #1] file input must have an `accept` attribute", async ({ page }) => {
  /**
   * On iOS Safari, tapping a file input without `accept` shows a generic action
   * sheet with no context. With `accept="image/*,application/pdf,..."` the OS
   * pre-filters the picker to the right sources.
   */
  const input = page.locator('input[type="file"]').first();
  const accept = await input.getAttribute("accept");
  // FAILS: attribute is not present
  expect(accept).not.toBeNull();
});

test("[MOBILE BUG #2] drop zone text must be mobile-friendly (not desktop-oriented)", async ({ page }) => {
  /**
   * "Drop files here or click to browse" makes no sense on a touchscreen.
   * After fix: show "Tap to select files" or equivalent on mobile viewports.
   */
  const mobileCta = page.getByText(/tap to select|tap to upload/i);
  // FAILS: text is desktop-oriented
  await expect(mobileCta).toBeVisible();
});

test("[MOBILE BUG #3] must have a camera capture input", async ({ page }) => {
  /**
   * Without <input capture="environment">, iOS users must navigate through
   * Files → Recents to find camera photos. A camera button is expected UX.
   */
  const captureInput = page.locator('input[type="file"][capture]');
  // FAILS: no capture input
  await expect(captureInput).toBeVisible();
});

test("[MOBILE BUG #4] must have a gallery / photo library button", async ({ page }) => {
  const galleryBtn = page.getByRole("button", { name: /gallery|library|photos|choose/i });
  // FAILS: no gallery button
  await expect(galleryBtn).toBeVisible();
});

test("[MOBILE BUG #34] layout must not overflow horizontally at 390 px", async ({ page }) => {
  /**
   * Roadmap issue #34: "Mobile layout breaks at ≤ 480px". This catches any
   * fixed-width element that causes horizontal scroll on small screens.
   */
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  // FAILS: some element overflows the 390 px viewport
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("[MOBILE BUG] paste hint (Ctrl+V / ⌘V) should be hidden on touch devices", async ({ page }) => {
  /**
   * The drop zone always shows "or paste with Ctrl+V / ⌘V". On mobile this
   * wasted space — keyboard shortcuts don't work on touchscreens.
   */
  const pasteHint = page.getByText(/ctrl\+v|⌘v/i);
  // FAILS: hint is visible even on mobile
  await expect(pasteHint).not.toBeVisible();
});

// ── WORKING BEHAVIOUR ─────────────────────────────────────────────────────────

test("page loads and drop zone is visible", async ({ page }) => {
  await expect(page.getByText(/drop files here|browse/i).first()).toBeVisible();
});

test("[MOBILE BUG #5] Browse files button tap target must be ≥ 44 px (WCAG 2.5.5)", async ({ page }) => {
  /**
   * WCAG 2.5.5: minimum 44×44 CSS pixels for interactive touch targets.
   * Current button renders at ~32 px height, too small for reliable tapping.
   * After fix: add min-h-[44px] or equivalent to the Browse button.
   */
  const browseBtn = page.getByRole("button", { name: /browse files/i });
  await expect(browseBtn).toBeVisible();
  const box = await browseBtn.boundingBox();
  // FAILS: button is ~32 px, below the 44 px threshold
  expect(box?.height).toBeGreaterThanOrEqual(44);
});

test("drop zone is visible above the fold without scrolling", async ({ page }) => {
  const dropZone = page.locator(".border-dashed").first();
  await expect(dropZone).toBeInViewport();
});

test("switching to URL tab shows URL input", async ({ page }) => {
  await page.getByRole("button", { name: "From URL" }).tap();
  await expect(page.getByPlaceholder("https://example.com/file.pdf")).toBeVisible();
});

test("uploading via Browse shows the file card", async ({ page }) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).tap(),
  ]);
  await fileChooser.setFiles({
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: fakeJpeg(),
  });
  await expect(page.getByText("photo.jpg")).toBeVisible({ timeout: 5_000 });
});

test("uploading a PDF shows the file card", async ({ page }) => {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).tap(),
  ]);
  await fileChooser.setFiles({
    name: "contract.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4"),
  });
  await expect(page.getByText("contract.pdf")).toBeVisible({ timeout: 5_000 });
});

test("[MOBILE BUG #11] HEIC file with .jpg extension — no format mismatch warning shown", async ({ page }) => {
  /**
   * iPhone camera photos (HEIC format) may arrive with .jpg extension.
   * Backend returns format="jpg" but mime_type="image/heic". No warning is
   * shown to the user, so the conversion may silently fail.
   *
   * After fix: a warning badge or toast should appear.
   */
  await mockBackend(page, {
    detection: {
      category: "image",
      format: "jpg",           // extension-based (wrong)
      mime_type: "image/heic", // magic-bytes (correct)
      is_ambiguous: false,
      available_outputs: ["png", "webp"],
    },
  });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).tap(),
  ]);
  await fileChooser.setFiles({
    name: "IMG_1234.jpg",
    mimeType: "image/jpeg",
    buffer: fakeHeic(),
  });

  await expect(page.getByText("IMG_1234.jpg")).toBeVisible({ timeout: 5_000 });
  // FAILS: no mismatch warning is displayed
  await expect(page.getByText(/heic|mismatch|actual format/i)).toBeVisible({ timeout: 3_000 });
});
