"use client";

import { AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCard } from "./FileCard";
import { BatchPanel } from "./BatchPanel";
import type { ConversionOptions, FormatRegistry, UploadedFile } from "@/lib/types";

interface FileListProps {
  files: UploadedFile[];
  formatRegistry: FormatRegistry | null;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onSelectFormat: (id: string, format: string) => void;
  onSelectCategory: (id: string, category: string) => void;
  onOptionsChange: (id: string, options: ConversionOptions) => void;
  onConvert: (file: UploadedFile) => void;
  onBatchConvert?: (format: string) => void;
  onDownloadAll?: () => void;
}

export function FileList({
  files,
  formatRegistry,
  onRemove,
  onClearAll,
  onSelectFormat,
  onSelectCategory,
  onOptionsChange,
  onConvert,
  onBatchConvert,
  onDownloadAll,
}: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Uploaded files
          </h2>
          <Badge variant="secondary">{files.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClearAll}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear all
        </Button>
      </div>

      {onBatchConvert && (
        <BatchPanel
          files={files}
          formatRegistry={formatRegistry}
          onConvertAll={onBatchConvert}
          onDownloadAll={onDownloadAll}
        />
      )}

      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              formatRegistry={formatRegistry}
              onRemove={() => onRemove(file.id)}
              onSelectFormat={(format) => onSelectFormat(file.id, format)}
              onSelectCategory={(category) => onSelectCategory(file.id, category)}
              onOptionsChange={(options) => onOptionsChange(file.id, options)}
              onConvert={() => onConvert(file)}
              onRetry={() => onConvert(file)}
              onConvertTo={(format) => {
                onSelectFormat(file.id, format);
                onConvert({ ...file, selectedFormat: format });
              }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
