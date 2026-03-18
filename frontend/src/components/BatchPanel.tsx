"use client";

import { useMemo, useState } from "react";
import { Download, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFormatLabel, getCategoryLabel } from "@/lib/formats";
import { getPopularAndOther } from "@/lib/formatConfig";
import type { FormatRegistry, UploadedFile } from "@/lib/types";

interface BatchPanelProps {
  files: UploadedFile[];
  formatRegistry: FormatRegistry | null;
  onConvertAll: (format: string) => void;
  onDownloadAll?: () => void;
}

export function BatchPanel({
  files,
  formatRegistry,
  onConvertAll,
  onDownloadAll,
}: BatchPanelProps) {
  const [batchFormat, setBatchFormat] = useState<string | undefined>();

  // Find the dominant category among idle files
  const batchInfo = useMemo(() => {
    const idleFiles = files.filter(
      (f) => f.status === "idle" && f.detection
    );
    if (idleFiles.length < 2) return null;

    const categoryCounts: Record<string, number> = {};
    for (const f of idleFiles) {
      const cat = f.selectedCategory || f.detection?.category;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // Find category with 2+ files
    const entry = Object.entries(categoryCounts).find(([, count]) => count >= 2);
    if (!entry) return null;

    const [category, count] = entry;
    const outputs =
      formatRegistry?.[category]?.outputs ||
      idleFiles.find(
        (f) => (f.selectedCategory || f.detection?.category) === category
      )?.detection?.available_outputs ||
      [];

    return { category, count, outputs };
  }, [files, formatRegistry]);

  if (!batchInfo) return null;

  const { popular } = getPopularAndOther(batchInfo.outputs, batchInfo.category);
  const allDone = files.filter((f) => f.status === "done").length >= 2;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Batch actions
        </h3>
        <Badge variant="secondary" className="text-xs">
          {batchInfo.count} {getCategoryLabel(batchInfo.category)} files
        </Badge>
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Convert all to:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {popular.map((format) => (
              <Badge
                key={format}
                variant={batchFormat === format ? "default" : "outline"}
                className={`cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors ${
                  batchFormat === format
                    ? "bg-primary/15 border-primary text-primary"
                    : "hover:border-primary/40 hover:text-foreground"
                }`}
                onClick={() => setBatchFormat(format)}
              >
                {getFormatLabel(format)}
              </Badge>
            ))}
          </div>
        </div>

        <Button
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!batchFormat}
          onClick={() => batchFormat && onConvertAll(batchFormat)}
        >
          <Play className="mr-1.5 h-4 w-4" />
          Convert all ({batchInfo.count} files)
        </Button>

        {allDone && onDownloadAll && (
          <Button
            variant="outline"
            className="w-full"
            onClick={onDownloadAll}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download all as ZIP
          </Button>
        )}
      </div>
    </div>
  );
}
