"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  X,
  FileText,
  Image as ImageIcon,
  Table,
  Presentation,
  ScanText,
  Music,
  Video,
  Type,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FormatSelector } from "./FormatSelector";
import { ConversionOptions } from "./ConversionOptions";
import { ProgressBar } from "./ProgressBar";
import { DownloadPanel } from "./DownloadPanel";
import { CATEGORY_COLORS, getCategoryLabel, getFormatLabel } from "@/lib/formats";
import { formatFileSize } from "@/lib/utils";
import { estimateOutputSize } from "@/lib/estimateSize";
import type {
  ConversionOptions as ConversionOptionsType,
  FormatRegistry,
  UploadedFile,
} from "@/lib/types";

interface FileCardProps {
  file: UploadedFile;
  formatRegistry: FormatRegistry | null;
  onRemove: () => void;
  onSelectFormat: (format: string) => void;
  onSelectCategory: (category: string) => void;
  onOptionsChange: (options: ConversionOptionsType) => void;
  onConvert: () => void;
  onRetry: () => void;
  onConvertTo?: (format: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  image: ImageIcon,
  document: FileText,
  data: Table,
  presentation: Presentation,
  ocr: ScanText,
  audio: Music,
  video: Video,
  font: Type,
};

const IMAGE_PREVIEW_FORMATS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "tiff", "ico",
]);

export function FileCard({
  file,
  formatRegistry,
  onRemove,
  onSelectFormat,
  onSelectCategory,
  onOptionsChange,
  onConvert,
  onRetry,
  onConvertTo,
}: FileCardProps) {
  const category = file.selectedCategory || file.detection?.category;
  const CategoryIcon = category ? CATEGORY_ICONS[category] || FileText : FileText;
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Auto-expand options when format is selected
  useEffect(() => {
    if (file.selectedFormat) {
      setOptionsOpen(true);
    }
  }, [file.selectedFormat]);

  // Estimated output size
  const estimatedSize = useMemo(() => {
    if (!file.selectedFormat || !file.detection) return null;
    return estimateOutputSize(
      file.size,
      file.detection.format,
      file.selectedFormat,
      file.options.quality,
      file.options.resize?.preset,
      file.options.resize?.width,
      file.options.resize?.height
    );
  }, [
    file.size,
    file.detection,
    file.selectedFormat,
    file.options.quality,
    file.options.resize,
  ]);

  const isSizeSmaller = estimatedSize !== null && estimatedSize < file.size;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Card
        className={`group relative rounded-xl border border-border p-4 shadow-card transition-all hover:border-primary/20 hover:shadow-md ${
          file.status === "error" ? "border-destructive" : ""
        } ${file.status === "done" ? "border-primary/30 shadow-glow" : ""}`}
      >
        {/* Remove button — visible on hover */}
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>

        {/* File info */}
        <div className="flex items-start gap-3 pr-8">
          {/* Preview / Icon */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {file.preview ? (
              <img
                src={file.preview}
                alt={file.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <CategoryIcon className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              {estimatedSize !== null && file.status === "idle" && (
                <span className="flex items-center gap-1 font-mono text-xs">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className={isSizeSmaller ? "text-green-500" : "text-amber-500"}>
                    ~{formatFileSize(estimatedSize)}
                  </span>
                  <span className="text-muted-foreground">(est.)</span>
                </span>
              )}
            </div>
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
                <Collapsible open={optionsOpen} onOpenChange={setOptionsOpen}>
                  <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        optionsOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                    Options
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-3">
                      <ConversionOptions
                        category={category}
                        inputFormat={file.detection.format}
                        outputFormat={file.selectedFormat}
                        options={file.options}
                        onChange={onOptionsChange}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Button
                  onClick={onConvert}
                  className="h-11 w-full bg-primary text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                >
                  Convert to {getFormatLabel(file.selectedFormat)}
                </Button>
              </>
            )}
          </div>
        )}

        {file.status === "converting" && (
          <div className="mt-3 space-y-2">
            <ProgressBar progress={file.progress} />
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Converting...
            </div>
          </div>
        )}

        {file.status === "done" && file.downloadUrl && (
          <div className="mt-3 space-y-3">
            {/* #21 — Image preview (#37 checkerboard for transparency) */}
            {IMAGE_PREVIEW_FORMATS.has(file.selectedFormat || "") && (
              <div className="overflow-hidden rounded-lg border border-border">
                <img
                  src={file.downloadUrl}
                  alt="Preview"
                  className="max-h-48 w-full object-contain bg-checkerboard"
                />
              </div>
            )}

            <DownloadPanel
              downloadUrl={file.downloadUrl}
              filename={`${file.name.replace(/\.[^.]+$/, "")}.${file.selectedFormat}`}
              onConvertAgain={onRetry}
            />

            {/* #22 — Quick-convert to other formats */}
            {onConvertTo && file.detection && file.detection.available_outputs.length > 1 && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Also convert to:</p>
                <div className="flex flex-wrap gap-1">
                  {file.detection.available_outputs
                    .filter((f) => f !== file.selectedFormat)
                    .slice(0, 6)
                    .map((format) => (
                      <Badge
                        key={format}
                        variant="outline"
                        className="cursor-pointer px-2 py-1 text-xs transition-all hover:border-primary/60 hover:bg-accent/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        tabIndex={0}
                        role="button"
                        onClick={() => onConvertTo(format)}
                        onKeyDown={(e) => e.key === "Enter" && onConvertTo(format)}
                      >
                        {getFormatLabel(format)}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
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
