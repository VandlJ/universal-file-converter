"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
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

  return (
    <div className="min-h-screen bg-background bg-dots">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <DropZone onFilesAdded={addFiles} compact={files.length > 0} />

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
        />
      </main>
    </div>
  );
}
