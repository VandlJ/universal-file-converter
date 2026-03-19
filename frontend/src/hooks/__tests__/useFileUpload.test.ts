/**
 * useFileUpload hook tests
 *
 * Tests marked [MOBILE BUG] document problems with mobile file handling.
 * They either fail immediately (asserting a fix) or assert current broken
 * behaviour with a comment explaining the expected correct behaviour.
 */
import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useFileUpload } from "@/hooks/useFileUpload";
import type { FileDetectionResult } from "@/lib/types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  detectFile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Stable URL stubs so we can assert create/revoke calls
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(global.URL, "createObjectURL", {
  value: mockCreateObjectURL,
  writable: true,
});
Object.defineProperty(global.URL, "revokeObjectURL", {
  value: mockRevokeObjectURL,
  writable: true,
});

import { detectFile } from "@/lib/api";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeDetection = (overrides: Partial<FileDetectionResult> = {}): FileDetectionResult => ({
  category: "image",
  format: "jpeg",
  mime_type: "image/jpeg",
  is_ambiguous: false,
  available_outputs: ["png", "webp", "gif"],
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useFileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(detectFile).mockResolvedValue(makeDetection());
  });

  // ── MOBILE BUGS ────────────────────────────────────────────────────────────

  it("[MOBILE BUG #5] file with no extension leaves the user with no available output formats", async () => {
    /**
     * WHY THIS MATTERS:
     * Files shared via iOS AirDrop, Android share sheet, or certain cloud
     * storage services sometimes arrive without a file extension. The backend
     * detect_file() uses the extension for category / format lookup, so it
     * returns category=null and available_outputs=[] — the user cannot proceed.
     *
     * EXPECTED FIX: when extension is absent, fall back to MIME type (which is
     * detected from magic bytes) to determine category and available outputs.
     *
     * THIS TEST documents the broken state: available_outputs is empty.
     * When fixed, this assertion should be changed to check that outputs ARE present.
     */
    vi.mocked(detectFile).mockResolvedValue(
      makeDetection({
        category: null,
        format: "",
        mime_type: "image/jpeg", // magic bytes correctly identified the type
        available_outputs: [],   // BUG: backend returned nothing
      })
    );

    const { result } = renderHook(() => useFileUpload());
    const noExtFile = new File(["jpg-bytes"], "photo", { type: "image/jpeg" });

    await act(async () => {
      await result.current.addFiles([noExtFile]);
    });

    const uploaded = result.current.files[0];
    // This assertion documents the current broken state:
    expect(uploaded.detection?.available_outputs).toHaveLength(0);
    expect(uploaded.detection?.category).toBeNull();

    // After the fix, the following should pass instead:
    // expect(uploaded.detection?.category).toBe('image');
    // expect(uploaded.detection?.available_outputs.length).toBeGreaterThan(0);
  });

  it("[MOBILE BUG #6] HEIC bytes under a .jpg filename cause a format / MIME mismatch", async () => {
    /**
     * WHY THIS MATTERS:
     * iPhones store photos in HEIC format. When the user selects such a photo
     * via the browser file picker, the browser may report filename="IMG_1234.jpg"
     * and MIME="image/jpeg", but the raw bytes are HEIC. The backend's magic
     * bytes check correctly returns mime_type="image/heic", but the returned
     * `format` field is still "jpg" (from the extension). Downstream this can
     * cause the converter to mis-label the source format, leading to silent
     * conversion failures.
     *
     * EXPECTED FIX: when mime_type does not match the extension's MIME type,
     * prefer the magic-bytes result for the `format` field, or flag is_ambiguous=true.
     */
    vi.mocked(detectFile).mockResolvedValue(
      makeDetection({
        format: "jpg",           // extension-based — wrong
        mime_type: "image/heic", // magic-bytes — correct
      })
    );

    const { result } = renderHook(() => useFileUpload());
    const heicFile = new File(["heic-bytes"], "IMG_1234.jpg", {
      type: "image/jpeg",
    });

    await act(async () => {
      await result.current.addFiles([heicFile]);
    });

    const uploaded = result.current.files[0];
    const formatFromMime = uploaded.detection?.mime_type.split("/")[1]; // "heic"
    const reportedFormat = uploaded.detection?.format; // "jpg"

    // Mismatch is present — no warning is surfaced to the user
    expect(reportedFormat).not.toBe(formatFromMime);
    // After fix: expect(reportedFormat).toBe('heic') OR expect(uploaded.detection?.is_ambiguous).toBe(true)
  });

  it("[MOBILE BUG #7] multiple iOS camera shots all named 'image.jpg' must each be added as distinct files", async () => {
    /**
     * WHY THIS MATTERS:
     * iOS names every camera photo "image.jpg". If the hook deduplicated by
     * filename, a user uploading three photos would silently lose two of them.
     * Files must be distinguished by their unique ID, not by name.
     *
     * Current state: PASSES — IDs are generated via generateId(). This test
     * acts as a regression guard to ensure we never add name-based deduplication.
     */
    const { result } = renderHook(() => useFileUpload());
    const photos = [
      new File(["data1"], "image.jpg", { type: "image/jpeg" }),
      new File(["data2"], "image.jpg", { type: "image/jpeg" }),
      new File(["data3"], "image.jpg", { type: "image/jpeg" }),
    ];

    await act(async () => {
      await result.current.addFiles(photos);
    });

    expect(result.current.files).toHaveLength(3);
    const ids = result.current.files.map((f) => f.id);
    expect(new Set(ids).size).toBe(3); // all IDs are unique
  });

  it("[MOBILE BUG #8] zero-byte file from a failed camera capture must be rejected gracefully", async () => {
    /**
     * WHY THIS MATTERS:
     * Some mobile browsers produce a 0-byte File object when the camera capture
     * is cancelled or fails. Sending this to the backend causes a confusing error.
     * The frontend should detect and reject empty files before uploading.
     *
     * EXPECTED FIX: add a size > 0 check alongside the MAX_FILE_SIZE check.
     */
    const { result } = renderHook(() => useFileUpload());
    const emptyFile = new File([], "camera_capture.jpg", {
      type: "image/jpeg",
    }); // size = 0

    await act(async () => {
      await result.current.addFiles([emptyFile]);
    });

    // FAILS: the hook currently does not filter out 0-byte files.
    // It sends them to the backend where they produce an unhelpful error.
    expect(result.current.files).toHaveLength(0);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  // ── WORKING BEHAVIOUR ──────────────────────────────────────────────────────

  it("adds a file, sets status to detecting, then idle after successful detection", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.addFiles([file]);
    });

    expect(result.current.files).toHaveLength(1);
    const uploaded = result.current.files[0];
    expect(uploaded.status).toBe("idle");
    expect(uploaded.name).toBe("photo.jpg");
    expect(uploaded.detection?.category).toBe("image");
  });

  it("creates a blob preview URL for image files", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(["img"], "shot.jpeg", { type: "image/jpeg" });

    await act(async () => {
      await result.current.addFiles([file]);
    });

    expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
    expect(result.current.files[0].preview).toBe("blob:mock-url");
  });

  it("does NOT create a preview URL for non-image files", async () => {
    vi.mocked(detectFile).mockResolvedValue(
      makeDetection({
        category: "document",
        format: "docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        available_outputs: ["pdf", "html"],
      })
    );
    const { result } = renderHook(() => useFileUpload());
    const file = new File(["docx"], "report.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

    await act(async () => {
      await result.current.addFiles([file]);
    });

    expect(result.current.files[0].preview).toBeUndefined();
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
  });

  it("rejects files over the size limit and shows a toast error", async () => {
    const { result } = renderHook(() => useFileUpload());
    const bigFile = new File(["x"], "huge.raw", { type: "application/octet-stream" });
    // Fake the size without allocating 101 MB
    Object.defineProperty(bigFile, "size", {
      value: 101 * 1024 * 1024,
      configurable: true,
    });

    await act(async () => {
      await result.current.addFiles([bigFile]);
    });

    expect(result.current.files).toHaveLength(0);
    expect(vi.mocked(detectFile)).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  it("sets status to error and shows a toast when detection fails", async () => {
    vi.mocked(detectFile).mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useFileUpload());
    const file = new File(["data"], "file.png", { type: "image/png" });

    await act(async () => {
      await result.current.addFiles([file]);
    });

    expect(result.current.files[0].status).toBe("error");
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  it("removeFile revokes the preview URL and removes the entry", async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(["img"], "photo.png", { type: "image/png" });

    await act(async () => {
      await result.current.addFiles([file]);
    });

    const id = result.current.files[0].id;
    act(() => result.current.removeFile(id));

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(result.current.files).toHaveLength(0);
  });

  it("clearAll revokes all preview URLs", async () => {
    const { result } = renderHook(() => useFileUpload());
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];

    await act(async () => {
      await result.current.addFiles(files);
    });

    act(() => result.current.clearAll());

    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    expect(result.current.files).toHaveLength(0);
  });

  it("setSelectedFormat updates only the target file", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.addFiles([
        new File(["a"], "a.jpg", { type: "image/jpeg" }),
        new File(["b"], "b.png", { type: "image/png" }),
      ]);
    });

    const [f1, f2] = result.current.files;
    act(() => result.current.setSelectedFormat(f1.id, "webp"));

    expect(result.current.files.find((f) => f.id === f1.id)?.selectedFormat).toBe("webp");
    expect(result.current.files.find((f) => f.id === f2.id)?.selectedFormat).toBeUndefined();
  });

  it("setSelectedCategory resets the previously selected format", async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.addFiles([
        new File(["data"], "scan.pdf", { type: "application/pdf" }),
      ]);
    });

    const id = result.current.files[0].id;
    act(() => {
      result.current.setSelectedFormat(id, "docx");
      result.current.setSelectedCategory(id, "ocr");
    });

    const f = result.current.files.find((x) => x.id === id);
    expect(f?.selectedCategory).toBe("ocr");
    expect(f?.selectedFormat).toBeUndefined();
  });

  it("detects multiple files in parallel (all reach idle state)", async () => {
    const { result } = renderHook(() => useFileUpload());
    const files = Array.from({ length: 4 }, (_, i) =>
      new File([`data${i}`], `file${i}.jpg`, { type: "image/jpeg" })
    );

    await act(async () => {
      await result.current.addFiles(files);
    });

    expect(result.current.files).toHaveLength(4);
    expect(result.current.files.every((f) => f.status === "idle")).toBe(true);
    expect(vi.mocked(detectFile)).toHaveBeenCalledTimes(4);
  });
});
