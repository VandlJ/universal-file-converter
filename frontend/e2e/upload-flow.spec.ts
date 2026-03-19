/**
 * Upload → detect → convert → download flow
 *
 * No device override — each test runs on every configured project
 * (Desktop Chrome, Desktop Safari, Mobile Chrome, Mobile Safari).
 * This catches regressions that affect only specific browsers or viewports.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { test, expect } from "@playwright/test";
import { mockBackend, fakeJpeg } from "./helpers";

// ── Full happy-path flow ───────────────────────────────────────────────────

test("full flow: upload → auto-detect → pick format → convert → download appears", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/");

  // Upload via the visible Browse Files button (works on both desktop and mobile)
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).click(),
  ]);
  await fileChooser.setFiles({
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: fakeJpeg(),
  });

  // Detection complete — file card appears
  await expect(page.getByText("photo.jpg")).toBeVisible({ timeout: 5_000 });

  // Select output format
  await page.getByRole("button", { name: "png" }).first().click();

  // Convert
  const convertBtn = page.getByRole("button", { name: /convert/i }).first();
  await expect(convertBtn).toBeVisible();
  await convertBtn.click();

  // Download button should appear after job completes
  await expect(
    page
      .getByRole("link", { name: /download/i })
      .or(page.getByRole("button", { name: /download/i }))
      .first()
  ).toBeVisible({ timeout: 10_000 });
});

// ── Error cases ────────────────────────────────────────────────────────────

test("file over 100 MB limit shows error toast and is not added to list", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/");

  // Write 101 MB to disk — Playwright webkit rejects inline buffers > 50 MB
  const tmpFile = path.join(os.tmpdir(), "playwright-huge-test.raw");
  fs.writeFileSync(tmpFile, Buffer.alloc(101 * 1024 * 1024));
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).click(),
  ]);
  try {
    await fileChooser.setFiles(tmpFile);
  } finally {
    fs.unlinkSync(tmpFile);
  }

  await expect(page.getByText(/too large/i)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("huge.raw")).not.toBeVisible();
});

test("detection API failure shows error on the file card", async ({ page }) => {
  await mockBackend(page, { detectError: true });
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).click(),
  ]);
  await fileChooser.setFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: fakeJpeg(),
  });

  await expect(page.getByText("broken.jpg")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/failed|error/i).first()).toBeVisible({ timeout: 5_000 });
});

// ── Mobile-specific regressions ────────────────────────────────────────────

test("three iOS photos all named 'image.jpg' all appear — no silent dedup", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /browse files/i }).click(),
  ]);
  await fileChooser.setFiles([
    { name: "image.jpg", mimeType: "image/jpeg", buffer: fakeJpeg() },
    { name: "image.jpg", mimeType: "image/jpeg", buffer: fakeJpeg() },
    { name: "image.jpg", mimeType: "image/jpeg", buffer: fakeJpeg() },
  ]);

  await expect(page.getByText("image.jpg")).toHaveCount(3, { timeout: 5_000 });
});

// ── URL fetch ─────────────────────────────────────────────────────────────

test("URL fetch: valid URL adds the file to the list", async ({ page }) => {
  await mockBackend(page);
  await page.route("**/api/fetch-url", (r) =>
    r.fulfill({
      body: fakeJpeg(),
      contentType: "image/jpeg",
      headers: { "Content-Disposition": 'attachment; filename="remote.jpg"' },
    })
  );
  await page.goto("/");

  await page.getByRole("button", { name: "From URL" }).click();
  await page
    .getByPlaceholder("https://example.com/file.pdf")
    .fill("https://example.com/remote.jpg");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText("remote.jpg")).toBeVisible({ timeout: 5_000 });
});

test("URL fetch: invalid URL shows inline validation error", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");

  await page.getByRole("button", { name: "From URL" }).click();
  await page.getByPlaceholder("https://example.com/file.pdf").fill("not-a-url");
  await page.getByRole("button", { name: "Fetch" }).click();

  await expect(page.getByText(/valid url/i)).toBeVisible();
});

test("URL fetch: Fetch button is disabled for empty input", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/");

  await page.getByRole("button", { name: "From URL" }).click();
  await expect(page.getByRole("button", { name: "Fetch" })).toBeDisabled();
});
