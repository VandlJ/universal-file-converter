"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { FormatDialog } from "./FormatDialog";
import { getFormatLabel, getCategoryLabel } from "@/lib/formats";
import { getPopularAndOther } from "@/lib/formatConfig";
import type { FormatRegistry } from "@/lib/types";

interface FormatSelectorProps {
  availableOutputs: string[];
  selectedFormat: string | undefined;
  onSelect: (format: string) => void;
  isAmbiguous?: boolean;
  availableCategories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  formatRegistry?: FormatRegistry | null;
}

export function FormatSelector({
  availableOutputs,
  selectedFormat,
  onSelect,
  isAmbiguous,
  availableCategories,
  selectedCategory,
  onCategoryChange,
  formatRegistry,
}: FormatSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const outputs =
    isAmbiguous && selectedCategory && formatRegistry
      ? formatRegistry[selectedCategory]?.outputs || []
      : availableOutputs;

  const category = selectedCategory || "";
  const { popular, other } = getPopularAndOther(outputs, category);

  // #28/#29: shared badge class helpers
  const selectedCls =
    "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25";
  const unselectedCls =
    "hover:border-primary/60 hover:bg-accent/60 hover:shadow-sm";
  const baseCls =
    "cursor-pointer px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50";

  return (
    <div className="space-y-3">
      {isAmbiguous && availableCategories && onCategoryChange && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Convert as
          </p>
          <div className="flex flex-wrap gap-1.5">
            {availableCategories.map((cat) => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className={`${baseCls} ${selectedCategory === cat ? selectedCls : unselectedCls}`}
                tabIndex={0}
                role="button"
                onClick={() => onCategoryChange(cat)}
                onKeyDown={(e) => e.key === "Enter" && onCategoryChange(cat)}
              >
                {getCategoryLabel(cat)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Convert to
        </p>
        <div className="flex flex-wrap gap-1.5">
          {popular.map((format) => (
            <Badge
              key={format}
              variant={selectedFormat === format ? "default" : "outline"}
              className={`${baseCls} ${selectedFormat === format ? selectedCls : unselectedCls}`}
              tabIndex={0}
              role="button"
              onClick={() => onSelect(format)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(format)}
            >
              {getFormatLabel(format)}
            </Badge>
          ))}

          {other.length > 0 && (
            <>
              <Badge
                variant="outline"
                className={`${baseCls} border-dashed text-muted-foreground hover:border-primary/60 hover:text-foreground hover:shadow-sm`}
                tabIndex={0}
                role="button"
                onClick={() => setDialogOpen(true)}
                onKeyDown={(e) => e.key === "Enter" && setDialogOpen(true)}
              >
                +{other.length} more
              </Badge>

              <FormatDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                formats={outputs}
                selectedFormat={selectedFormat}
                onSelect={onSelect}
                category={category}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
