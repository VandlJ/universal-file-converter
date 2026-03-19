/**
 * API layer tests
 *
 * These test the fetch wrappers in lib/api.ts. fetch() is stubbed globally so
 * no real network requests are made. Tests focus on what is sent (FormData
 * shape) and how errors are handled — especially mobile edge cases.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  detectFile,
  convertFile,
  fetchFileFromUrl,
  getDownloadUrl,
  getZipDownloadUrl,
  batchDownloadBlob,
} from "@/lib/api";

// ─── fetch stub ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function errorJson(status: number, detail: string) {
  return Promise.resolve(
    new Response(JSON.stringify({ detail }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("detectFile", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("POSTs FormData with the file to /api/detect", async () => {
    mockFetch.mockResolvedValueOnce(
      okJson({
        category: "image",
        format: "jpeg",
        mime_type: "image/jpeg",
        is_ambiguous: false,
        available_outputs: ["png", "webp"],
      })
    );

    const file = new File(["bytes"], "photo.jpg", { type: "image/jpeg" });
    await detectFile(file);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch("/api/detect");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
  });

  it("throws a descriptive error on 413 (file too large)", async () => {
    mockFetch.mockResolvedValueOnce(
      errorJson(413, "File exceeds maximum allowed size of 100 MB.")
    );
    const file = new File(["x"], "huge.raw");
    await expect(detectFile(file)).rejects.toThrow(/100 MB/i);
  });

  it("throws on non-ok response without a JSON body", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }));
    await expect(detectFile(new File(["x"], "f.jpg"))).rejects.toThrow();
  });

  it("[MOBILE BUG #9] file with no extension: request is sent without extension hint, backend may fail", async () => {
    /**
     * WHY THIS MATTERS:
     * Files without extensions from mobile (AirDrop, share sheet) are sent to
     * /api/detect with filename="photo" (no dot). The backend's detect_file()
     * uses the extension for category lookup and returns category=null when it
     * is absent. The frontend sends the request fine — the bug is entirely on
     * the backend side — but this test documents that the client does not add
     * any fallback hint (e.g., a MIME-type header) that could help the backend.
     *
     * EXPECTED FIX: send the file's MIME type as a separate form field so the
     * backend can use it as a fallback when the extension is missing.
     */
    mockFetch.mockResolvedValueOnce(
      okJson({
        category: null,
        format: "",
        mime_type: "image/jpeg",
        is_ambiguous: false,
        available_outputs: [],
      })
    );

    const noExtFile = new File(["jpg-bytes"], "photo", { type: "image/jpeg" });
    await detectFile(noExtFile);

    const formData = mockFetch.mock.calls[0][1].body as FormData;

    // Currently no mime_type hint is sent — the backend is left to guess alone
    // FAILS: no mime_type field present; after fix, remove this assertion
    expect(formData.get("mime_type")).not.toBeNull();
  });
});

describe("convertFile", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("POSTs all required fields to /api/convert", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ job_id: "abc.def123" }));

    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    await convertFile(file, "png", "image", { quality: 90 });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch("/api/convert");
    expect(init.method).toBe("POST");

    const fd = init.body as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("output_format")).toBe("png");
    expect(fd.get("category")).toBe("image");
    expect(JSON.parse(fd.get("options") as string)).toEqual({ quality: 90 });
  });

  it("throws a descriptive error when conversion is rejected (400)", async () => {
    mockFetch.mockResolvedValueOnce(
      errorJson(400, "Output format 'xyz' not supported for category 'image'")
    );
    await expect(
      convertFile(new File(["x"], "f.png"), "xyz", "image", {})
    ).rejects.toThrow(/not supported/i);
  });

  it("throws on 429 rate-limit response", async () => {
    mockFetch.mockResolvedValueOnce(
      errorJson(429, "Too many concurrent conversions.")
    );
    await expect(
      convertFile(new File(["x"], "f.png"), "webp", "image", {})
    ).rejects.toThrow(/concurrent/i);
  });
});

describe("fetchFileFromUrl", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("extracts filename from Content-Disposition header", async () => {
    const blob = new Blob(["pdf-content"], { type: "application/pdf" });
    mockFetch.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="annual_report.pdf"',
        },
      })
    );

    const file = await fetchFileFromUrl("https://example.com/dl");
    expect(file.name).toBe("annual_report.pdf");
    expect(file.type).toBe("application/pdf");
  });

  it("falls back to URL path segment when Content-Disposition is absent", async () => {
    const blob = new Blob(["img"], { type: "image/png" });
    mockFetch.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      })
    );

    const file = await fetchFileFromUrl("https://cdn.example.com/images/logo.png?v=2");
    expect(file.name).toBe("logo.png");
  });

  it("falls back to 'downloaded_file' when URL has no path segment", async () => {
    const blob = new Blob(["data"], { type: "application/octet-stream" });
    mockFetch.mockResolvedValueOnce(
      new Response(blob, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      })
    );

    const file = await fetchFileFromUrl("https://api.example.com/");
    expect(file.name).toBe("downloaded_file");
  });

  it("throws when the backend returns a non-ok status", async () => {
    mockFetch.mockResolvedValueOnce(errorJson(400, "Failed to fetch URL: connection refused"));
    await expect(fetchFileFromUrl("https://dead.example.com/file.pdf")).rejects.toThrow(
      /Failed to fetch URL/i
    );
  });
});

describe("URL helpers", () => {
  it("getDownloadUrl returns the correct path", () => {
    expect(getDownloadUrl("abc.mac123")).toBe("/api/download/abc.mac123");
  });

  it("getZipDownloadUrl returns the correct zip path", () => {
    expect(getZipDownloadUrl("abc.mac123")).toBe("/api/download/abc.mac123/zip");
  });
});

describe("batchDownloadBlob", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("POSTs job IDs as JSON and returns a Blob", async () => {
    const zipBlob = new Blob(["zip-data"], { type: "application/zip" });
    mockFetch.mockResolvedValueOnce(new Response(zipBlob, { status: 200 }));

    const result = await batchDownloadBlob(["id1.mac1", "id2.mac2"]);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ job_ids: ["id1.mac1", "id2.mac2"] });
    // jsdom may use a different Blob realm, so check duck-type instead of instanceof
    expect(typeof result.size).toBe("number");
    expect(typeof result.type).toBe("string");
  });

  it("throws when batch-download fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(batchDownloadBlob(["id1.mac1"])).rejects.toThrow(/batch download failed/i);
  });
});
