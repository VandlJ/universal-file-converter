/**
 * DropZone tests
 *
 * Tests marked [MOBILE BUG] are expected to FAIL until the corresponding bug
 * is fixed. They serve as a specification for what mobile support must look like.
 */
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { DropZone } from "@/components/DropZone";

// framer-motion: render as plain div so drag events fire normally in jsdom
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        {
          /* eslint-disable @typescript-eslint/no-unused-vars */
          animate,
          transition,
          /* eslint-enable @typescript-eslint/no-unused-vars */
          children,
          ...props
        }: React.ComponentPropsWithRef<"div"> & {
          animate?: unknown;
          transition?: unknown;
        },
        ref: React.Ref<HTMLDivElement>
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Prevent real network calls from the URL fetch tab
vi.mock("@/lib/api", () => ({
  fetchFileFromUrl: vi
    .fn()
    .mockResolvedValue(
      new File(["content"], "fetched.pdf", { type: "application/pdf" })
    ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a proper FileList from an array of Files using the DataTransfer API. */
function makeFileList(...files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DropZone — mobile input support", () => {
  let onFilesAdded: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFilesAdded = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ── MOBILE BUGS (intentionally failing until fixed) ───────────────────────

  it("[MOBILE BUG #1] file input must have an `accept` attribute to guide the mobile file picker", () => {
    /**
     * WHY THIS MATTERS:
     * On iOS Safari, tapping a file input without `accept` shows an ambiguous
     * action sheet ("Photo Library / Take Photo or Video / Browse"). With
     * `accept="image/*,application/pdf,..."` the browser can pre-filter the
     * picker and show the right file sources first.
     *
     * FIX: add accept="image/*,application/pdf,..." (or "*") to the input.
     */
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    // FAILS: input.accept is "" (attribute not present)
    expect(input.accept).not.toBe("");
  });

  it("[MOBILE BUG #2] drop zone must handle touch events — drag events do not fire on mobile touchscreens", () => {
    /**
     * WHY THIS MATTERS:
     * On mobile, users cannot drag-and-drop files with their fingers. The DOM
     * fires touchstart/touchend, not dragenter/dragover/drop. The current
     * implementation only listens for drag events, so the drop zone is completely
     * non-functional as a target for finger gestures.
     *
     * FIX: add touch-to-drag polyfill or expose a tap-to-pick alternative that
     * is visually prominent on mobile (e.g., large tap target instead of drag zone).
     */
    const { container } = render(<DropZone onFilesAdded={onFilesAdded} />);
    // Expect at least one element with a touch event handler
    const touchable =
      container.querySelector("[ontouchstart]") ??
      container.querySelector("[data-touch-zone]");
    // FAILS: no touch handlers exist in the component
    expect(touchable).not.toBeNull();
  });

  it("[MOBILE BUG #3] must provide a unified file picker that triggers the native mobile action sheet", () => {
    /**
     * WHY THIS MATTERS:
     * A primary mobile use-case is: take a photo or pick from gallery.
     * On modern iOS/Android, a single <input type="file" accept="image/*,...">
     * automatically opens an action sheet with "Take Photo", "Photo Library",
     * and "Browse/Files". Separate buttons are redundant and confusing.
     *
     * FIX: ensure the "Browse files" button is present and accessible.
     */
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const browseBtn = screen.getByRole("button", {
      name: /browse files|tap to select/i,
    });
    expect(browseBtn).not.toBeNull();
  });

  it("[MOBILE BUG #4] must ensure the file input is correctly configured for mobile media sources", () => {
    /**
     * WHY THIS MATTERS:
     * To ensure the native mobile picker shows "Take Photo" and "Photo Library",
     * the underlying input MUST have the correct `accept` attributes.
     *
     * FIX: Verify image/* is included in the accept attribute.
     */
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input.accept).toContain("image/*");
  });

  // ── WORKING BEHAVIOUR (must continue to pass after any mobile fix) ─────────

  it("renders a hidden file input that accepts multiple files", () => {
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("multiple");
    expect(input.classList.contains("hidden")).toBe(true);
  });

  it("calls onFilesAdded when user selects a file via Browse", async () => {
    const user = userEvent.setup();
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    const file = new File(["hello"], "photo.jpg", { type: "image/jpeg" });
    await user.upload(input, file);
    expect(onFilesAdded).toHaveBeenCalledOnce();
  });

  it("calls onFilesAdded when files are dropped onto the zone", () => {
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const dropTarget = document.querySelector(".border-dashed") as HTMLElement;
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    fireEvent.drop(dropTarget, {
      dataTransfer: { files: makeFileList(file), types: ["Files"] },
    });
    expect(onFilesAdded).toHaveBeenCalled();
  });

  it("does NOT call onFilesAdded when an empty drop occurs", () => {
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const dropTarget = document.querySelector(".border-dashed") as HTMLElement;
    fireEvent.drop(dropTarget, {
      dataTransfer: { files: makeFileList(), types: [] },
    });
    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it("calls onFilesAdded when files are pasted via Ctrl+V", () => {
    render(<DropZone onFilesAdded={onFilesAdded} />);
    const file = new File(["img"], "screenshot.png", { type: "image/png" });

    const pasteEvent = new Event("paste", { bubbles: true }) as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { files: makeFileList(file) },
    });
    document.dispatchEvent(pasteEvent);
    // Verify it was called with a files-like object containing our file
    expect(onFilesAdded).toHaveBeenCalledOnce();
    const arg = onFilesAdded.mock.calls[0][0];
    expect(arg[0]).toBe(file);
  });

  it("removes the paste listener on unmount — no memory leak", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<DropZone onFilesAdded={onFilesAdded} />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("paste", expect.any(Function));
  });

  it("switches to the URL tab and shows the URL input", async () => {
    const user = userEvent.setup();
    render(<DropZone onFilesAdded={onFilesAdded} />);
    await user.click(screen.getByText("From URL"));
    expect(
      screen.getByPlaceholderText("https://example.com/file.pdf")
    ).toBeInTheDocument();
  });

  it("shows a validation error for a syntactically invalid URL", async () => {
    const user = userEvent.setup();
    render(<DropZone onFilesAdded={onFilesAdded} />);
    await user.click(screen.getByText("From URL"));
    await user.type(
      screen.getByPlaceholderText("https://example.com/file.pdf"),
      "not-a-url"
    );
    await user.click(screen.getByRole("button", { name: "Fetch" }));
    expect(await screen.findByText(/valid url/i)).toBeInTheDocument();
  });

  it("does not submit an empty URL", async () => {
    const user = userEvent.setup();
    render(<DropZone onFilesAdded={onFilesAdded} />);
    await user.click(screen.getByText("From URL"));
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
  });
});
