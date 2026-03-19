/**
 * Shared test helpers for E2E tests.
 *
 * mockBackend() intercepts all /api/* requests with Playwright's route
 * interception so the tests run without a live backend.
 */

import type { Page } from "@playwright/test";

export const SIGNED_JOB_ID = "test-uuid-1234-5678.abcd1234ef56";

const FORMAT_REGISTRY = {
  image: {
    inputs: ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp", "avif", "tiff", "ico", "svg"],
    outputs: ["jpg", "png", "webp", "gif", "avif", "bmp", "tiff", "ico"],
    options: ["quality", "resize", "stripMetadata", "backgroundColor"],
  },
  document: {
    inputs: ["pdf", "docx", "odt", "html", "md", "txt", "epub"],
    outputs: ["pdf", "html", "md", "docx", "txt", "epub"],
    options: ["pdfPageSize", "pdfOrientation", "pdfMargins"],
  },
  data: {
    inputs: ["csv", "xlsx", "xls", "json", "parquet", "tsv"],
    outputs: ["csv", "xlsx", "json", "parquet", "tsv"],
    options: ["delimiter", "encoding", "headerRow"],
  },
  ocr: {
    inputs: ["jpg", "jpeg", "png", "tiff", "bmp", "pdf"],
    outputs: ["txt", "pdf", "html"],
    options: ["ocrLanguages", "dpi"],
  },
};

export interface MockOptions {
  /** Override the detection response (e.g. to simulate a HEIC file) */
  detection?: Record<string, unknown>;
  /** Override job status (default: "completed") */
  jobStatus?: "pending" | "processing" | "completed" | "failed";
  /** Make /api/detect return an error */
  detectError?: boolean;
}

export async function mockBackend(page: Page, opts: MockOptions = {}) {
  const detection = opts.detection ?? {
    category: "image",
    format: "jpg",
    mime_type: "image/jpeg",
    is_ambiguous: false,
    available_outputs: ["png", "webp", "gif", "avif"],
  };

  await page.route("**/api/formats", (r) =>
    r.fulfill({ json: FORMAT_REGISTRY })
  );

  await page.route("**/api/detect", (r) =>
    opts.detectError
      ? r.fulfill({ status: 500, json: { detail: "Detection failed" } })
      : r.fulfill({ json: detection })
  );

  await page.route("**/api/convert", (r) =>
    r.fulfill({ json: { job_id: SIGNED_JOB_ID } })
  );

  await page.route("**/api/status/**", (r) =>
    r.fulfill({
      json: {
        job_id: "test-uuid-1234-5678",
        status: opts.jobStatus ?? "completed",
        progress: 100,
        error: null,
        output_files: ["converted.png"],
      },
    })
  );

  await page.route("**/api/download/**", (r) =>
    r.fulfill({
      body: Buffer.from("\x89PNG\r\n\x1a\n"),
      contentType: "image/png",
      headers: { "Content-Disposition": 'attachment; filename="converted.png"' },
    })
  );
}

/** Create a minimal fake JPEG buffer (just magic bytes). */
export function fakeJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

/** Create a fake HEIC buffer (ftyp box signature). */
export function fakeHeic(): Buffer {
  return Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
}
