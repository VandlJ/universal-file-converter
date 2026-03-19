"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Keyboard, Link, Loader2, Upload } from "lucide-react";
import { fetchFileFromUrl } from "@/lib/api";

interface DropZoneProps {
  onFilesAdded: (files: FileList | File[]) => void;
  compact?: boolean;
}

export function DropZone({ onFilesAdded, compact }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [tab, setTab] = useState<"drop" | "url">("drop");
  const [urlValue, setUrlValue] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  // #31 — counter prevents false dragleave when cursor crosses child elements
  const dragCounter = useRef(0);

  // #19 — Clipboard paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files?.length) {
        onFilesAdded(e.clipboardData.files);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onFilesAdded]);

  // #31 — use dragenter counter instead of dragover/dragleave pair
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // required to allow drop
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onFilesAdded(e.dataTransfer.files);
      }
    },
    [onFilesAdded]
  );

  const handleClick = useCallback(() => {
    if (tab === "drop") inputRef.current?.click();
  }, [tab]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesAdded(e.target.files);
        e.target.value = "";
      }
    },
    [onFilesAdded]
  );

  // #20 + #38 — URL fetch with client-side validation
  const handleFetchUrl = useCallback(async () => {
    const url = urlValue.trim();
    if (!url) return;

    // #38 — validate before sending
    try {
      new URL(url);
    } catch {
      setUrlError("Please enter a valid URL (e.g. https://example.com/file.pdf)");
      return;
    }

    setUrlLoading(true);
    setUrlError(null);
    try {
      const file = await fetchFileFromUrl(url);
      onFilesAdded([file]);
      setUrlValue("");
      setTab("drop");
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Failed to fetch URL");
    } finally {
      setUrlLoading(false);
    }
  }, [urlValue, onFilesAdded]);

  return (
    <div className="space-y-2">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("drop")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            tab === "drop"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Drop / Browse
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            tab === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link className="h-3.5 w-3.5" />
          From URL
        </button>
      </div>

      {tab === "drop" ? (
        <motion.div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          // #32 — handle touch for mobile
          onTouchStart={() => setIsDragOver(true)}
          onTouchEnd={() => setIsDragOver(false)}
          data-touch-zone
          animate={isDragOver ? { scale: 1.02 } : { scale: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed bg-card transition-all duration-200 ${
            compact ? "min-h-[120px] p-6" : "min-h-[200px] p-12"
          } ${
            isDragOver
              ? "border-primary bg-primary/5 shadow-glow"
              : "border-border hover:border-primary/40 hover:shadow-glow"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,audio/*,video/*"
            className="hidden"
            onChange={handleChange}
          />
          {/* #34 — camera capture input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleChange}
          />
          {/* #35 — photo library input */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
          />

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
            className={`rounded-xl p-3 transition-all duration-200 ${
              isDragOver ? "bg-primary/15" : "bg-muted"
            }`}
          >
            <Upload
              className={`transition-all duration-200 ${
                compact ? "h-5 w-5" : "h-8 w-8"
              } ${isDragOver ? "text-primary scale-110" : "text-muted-foreground"}`}
            />
          </motion.div>

          <div className="text-center">
            <p className="text-sm font-medium">
              <span className="md:inline hidden">
                {isDragOver ? "Release to upload" : "Drop files here or click to browse"}
              </span>
              <span className="md:hidden inline">
                {isDragOver ? "Release to upload" : "Tap to select files"}
              </span>
            </p>
            {!compact && (
              <p className="mt-1 text-xs text-muted-foreground">
                Images, documents, spreadsheets, audio, video, fonts, and more
              </p>
            )}
          </div>

          {!compact && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-primary/30 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/60 min-h-[44px] flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                >
                  Browse files
                </button>
                {/* #34 + #35 — mobile-specific buttons */}
                <button
                  type="button"
                  className="md:hidden flex cursor-pointer rounded-md border border-primary/30 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/60 min-h-[44px] items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                >
                  Take photo
                </button>
                <button
                  type="button"
                  className="md:hidden flex cursor-pointer rounded-md border border-primary/30 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 hover:border-primary/60 min-h-[44px] items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    galleryInputRef.current?.click();
                  }}
                >
                  Choose from library
                </button>
              </div>
              {/* #30 — paste hint (hidden on touch devices) */}
              <span className="md:flex hidden items-center gap-1 text-xs text-muted-foreground/60">
                <Keyboard className="h-3 w-3" />
                or paste with Ctrl+V / ⌘V
              </span>
            </div>
          )}
        </motion.div>
      ) : (
        <div
          className={`flex flex-col gap-3 rounded-xl border-2 border-dashed border-border bg-card p-6 ${
            compact ? "min-h-[120px]" : "min-h-[200px]"
          } justify-center`}
        >
          <p className="text-sm font-medium text-center">Paste a file URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => {
                setUrlValue(e.target.value);
                setUrlError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
              placeholder="https://example.com/file.pdf"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            />
            <button
              type="button"
              onClick={handleFetchUrl}
              disabled={urlLoading || !urlValue.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {urlLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Fetch"
              )}
            </button>
          </div>
          {urlError && (
            <p className="text-xs text-destructive text-center">{urlError}</p>
          )}
        </div>
      )}
    </div>
  );
}
