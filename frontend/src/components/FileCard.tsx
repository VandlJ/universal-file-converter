"use client";

import { motion } from "framer-motion";
import {
  X,
  FileText,
  Image as ImageIcon,
  Table,
  Presentation,
  ScanText,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormatSelector } from "./FormatSelector";
import { ConversionOptions } from "./ConversionOptions";
import { ProgressBar } from "./ProgressBar";
import { DownloadPanel } from "./DownloadPanel";
import { CATEGORY_COLORS, getCategoryLabel, getFormatLabel } from "@/lib/formats";
import { formatFileSize } from "@/lib/utils";
import type { ConversionOptions as ConversionOptionsType, FormatRegistry, UploadedFile } from "@/lib/types";

interface FileCardProps {
  file: UploadedFile;
  formatRegistry: FormatRegistry | null;
  onRemove: () => void;
  onSelectFormat: (format: string) => void;
  onSelectCategory: (category: string) => void;
  onOptionsChange: (options: ConversionOptionsType) => void;
  onConvert: () => void;
  onRetry: () => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  image: ImageIcon,
  document: FileText,
  data: Table,
  presentation: Presentation,
  ocr: ScanText,
};

export function FileCard({
  file,
  formatRegistry,
  onRemove,
  onSelectFormat,
  onSelectCategory,
  onOptionsChange,
  onConvert,
  onRetry,
}: FileCardProps) {
  const category = file.selectedCategory || file.detection?.category;
  const CategoryIcon = category ? CATEGORY_ICONS[category] || FileText : FileText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card
        className={`relative p-4 ${
          file.status === "error" ? "border-destructive" : ""
        }`}
      >
        {/* Remove button */}
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* File info */}
        <div className="flex items-start gap-3 pr-8">
          {/* Preview / Icon */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {file.preview ? (
              <img
                src={file.preview}
                alt={file.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <CategoryIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
            {file.detection && category && (
              <Badge
                variant="secondary"
                className={`mt-1 text-xs ${CATEGORY_COLORS[category] || ""}`}
              >
                {getCategoryLabel(category)} — {getFormatLabel(file.detection.format)}
              </Badge>
            )}
          </div>
        </div>

        {/* Status-specific content */}
        {file.status === "detecting" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Detecting file type...
          </div>
        )}

        {file.status === "idle" && file.detection && (
          <div className="mt-4 space-y-4">
            <FormatSelector
              availableOutputs={file.detection.available_outputs}
              selectedFormat={file.selectedFormat}
              onSelect={onSelectFormat}
              isAmbiguous={file.detection.is_ambiguous}
              availableCategories={file.detection.available_categories || undefined}
              selectedCategory={file.selectedCategory}
              onCategoryChange={onSelectCategory}
              formatRegistry={formatRegistry}
            />

            {file.selectedFormat && category && (
              <>
                <ConversionOptions
                  category={category}
                  inputFormat={file.detection.format}
                  outputFormat={file.selectedFormat}
                  options={file.options}
                  onChange={onOptionsChange}
                />
                <Button onClick={onConvert} className="w-full">
                  Convert to {getFormatLabel(file.selectedFormat)}
                </Button>
              </>
            )}
          </div>
        )}

        {file.status === "converting" && (
          <div className="mt-3">
            <ProgressBar progress={file.progress} />
          </div>
        )}

        {file.status === "done" && file.downloadUrl && (
          <div className="mt-3">
            <DownloadPanel
              downloadUrl={file.downloadUrl}
              filename={`${file.name.replace(/\.[^.]+$/, "")}.${file.selectedFormat}`}
            />
          </div>
        )}

        {file.status === "error" && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {file.error || "An error occurred"}
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
