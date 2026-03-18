"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, Download, FileStack, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { DropZone } from "@/components/DropZone";
import { FileList } from "@/components/FileList";
import { batchDownloadBlob, fetchFormats } from "@/lib/api";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useConversion } from "@/hooks/useConversion";
import { useConversionHistory } from "@/hooks/useConversionHistory";
import type { FormatRegistry } from "@/lib/types";

// #36 — relative timestamp helper
function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Home() {
  const [formats, setFormats] = useState<FormatRegistry | null>(null);
  const { history, addEntry, clearHistory } = useConversionHistory();

  const {
    files,
    addFiles,
    removeFile,
    clearAll,
    updateFile,
    setSelectedFormat,
    setSelectedCategory,
    setOptions,
  } = useFileUpload();

  const { startConversion } = useConversion(updateFile);

  useEffect(() => {
    fetchFormats()
      .then(setFormats)
      .catch(() => {});
  }, []);

  // #25 — Persist completed conversions to localStorage history
  const addedToHistory = useRef(new Set<string>());
  useEffect(() => {
    for (const file of files) {
      if (
        file.status === "done" &&
        file.downloadUrl &&
        file.jobId &&
        file.selectedFormat
      ) {
        const key = `${file.id}-${file.jobId}`;
        if (!addedToHistory.current.has(key)) {
          addedToHistory.current.add(key);
          addEntry({
            jobId: file.jobId,
            filename: `${file.name.replace(/\.[^.]+$/, "")}.${file.selectedFormat}`,
            outputFormat: file.selectedFormat,
            downloadUrl: file.downloadUrl,
            timestamp: Date.now(),
          });
        }
      }
    }
  }, [files, addEntry]);

  const handleBatchConvert = useCallback(
    (format: string) => {
      const idleFiles = files.filter(
        (f) => f.status === "idle" && f.detection
      );
      for (const file of idleFiles) {
        const category = file.selectedCategory || file.detection?.category;
        if (category) {
          const updated = {
            ...file,
            selectedFormat: format,
            selectedCategory: category,
          };
          setSelectedFormat(file.id, format);
          startConversion(updated);
        }
      }
    },
    [files, setSelectedFormat, startConversion]
  );

  // #23 — Download all completed files as ZIP (#35 — success toast)
  const handleDownloadAll = useCallback(async () => {
    const doneFiles = files.filter((f) => f.status === "done" && f.jobId);
    if (doneFiles.length === 0) return;
    try {
      const blob = await batchDownloadBlob(doneFiles.map((f) => f.jobId!));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted_files.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP with ${doneFiles.length} files downloaded`); // #35
    } catch {
      toast.error("Failed to create ZIP archive");
    }
  }, [files]);

  return (
    <div className="min-h-screen bg-background bg-dots">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <DropZone onFilesAdded={addFiles} compact={files.length > 0} />

        {/* #33 — Empty state */}
        {files.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-xl bg-muted p-4">
              <FileStack className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Drop your first file above to get started
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                50+ formats — images, documents, data, audio, video, fonts
              </p>
            </div>
          </div>
        )}

        <FileList
          files={files}
          formatRegistry={formats}
          onRemove={removeFile}
          onClearAll={clearAll}
          onSelectFormat={setSelectedFormat}
          onSelectCategory={setSelectedCategory}
          onOptionsChange={setOptions}
          onConvert={startConversion}
          onBatchConvert={handleBatchConvert}
          onDownloadAll={handleDownloadAll}
        />

        {/* #25 — Conversion history (#36 — relative timestamps) */}
        {history.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent conversions
                </h3>
              </div>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <ul className="space-y-1">
              {history.map((entry) => (
                <li
                  key={`${entry.jobId}-${entry.timestamp}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
                >
                  <span className="truncate text-xs text-foreground/80 flex-1 min-w-0">
                    {entry.filename}
                  </span>
                  {/* #36 — relative timestamp */}
                  <span className="shrink-0 text-xs text-muted-foreground/60 tabular-nums">
                    {relativeTime(entry.timestamp)}
                  </span>
                  <a
                    href={entry.downloadUrl}
                    download={entry.filename}
                    className="flex items-center gap-1 shrink-0 rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
