"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropZone } from "@/components/DropZone";
import { FileList } from "@/components/FileList";
import { fetchFormats } from "@/lib/api";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useConversion } from "@/hooks/useConversion";
import type { FormatRegistry } from "@/lib/types";

export default function Home() {
  const [formats, setFormats] = useState<FormatRegistry | null>(null);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
              <path d="M7 21h10" />
              <path d="M12 3v18" />
              <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
            </svg>
            <h1 className="text-xl font-semibold">Universal File Converter</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <DropZone onFilesAdded={addFiles} />

        <FileList
          files={files}
          formatRegistry={formats}
          onRemove={removeFile}
          onClearAll={clearAll}
          onSelectFormat={setSelectedFormat}
          onSelectCategory={setSelectedCategory}
          onOptionsChange={setOptions}
          onConvert={startConversion}
        />
      </main>
    </div>
  );
}
