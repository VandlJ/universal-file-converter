"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ConversionOptions as ConversionOptionsType } from "@/lib/types";
import { QualitySlider } from "./QualitySlider";
import { ResizeOptions } from "./ResizeOptions";
import { PdfOptions } from "./PdfOptions";
import { MarkdownToggle } from "./MarkdownToggle";
import { DataOptions } from "./DataOptions";
import { OcrOptions } from "./OcrOptions";
import { Switch } from "@/components/ui/switch";

interface ConversionOptionsProps {
  category: string;
  inputFormat: string;
  outputFormat: string;
  options: ConversionOptionsType;
  onChange: (options: ConversionOptionsType) => void;
}

const LOSSY_FORMATS = ["jpg", "jpeg", "webp", "avif", "jxl"];

export function ConversionOptions({
  category,
  inputFormat,
  outputFormat,
  options,
  onChange,
}: ConversionOptionsProps) {
  const isLossyOutput = LOSSY_FORMATS.includes(outputFormat);
  const isPdfOutput = outputFormat === "pdf";
  const isMdInvolved = inputFormat === "md" || outputFormat === "md";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="space-y-4 overflow-hidden"
      >
        {category === "image" && (
          <>
            {isLossyOutput && (
              <QualitySlider
                value={options.quality ?? 85}
                onChange={(quality) => onChange({ ...options, quality })}
              />
            )}
            <ResizeOptions
              resize={options.resize}
              onChange={(resize) => onChange({ ...options, resize })}
            />
            <div className="flex items-center justify-between">
              <label className="text-sm">Strip EXIF metadata</label>
              <Switch
                checked={options.stripMetadata ?? false}
                onCheckedChange={(stripMetadata) =>
                  onChange({ ...options, stripMetadata })
                }
              />
            </div>
            {!["png", "gif", "webp", "tiff", "svg"].includes(outputFormat) && (
              <div className="flex items-center gap-3">
                <label className="text-sm">Background color</label>
                <input
                  type="color"
                  value={options.backgroundColor ?? "#ffffff"}
                  onChange={(e) =>
                    onChange({ ...options, backgroundColor: e.target.value })
                  }
                  className="h-8 w-8 cursor-pointer rounded border"
                />
              </div>
            )}
          </>
        )}

        {category === "document" && (
          <>
            {isMdInvolved && (
              <MarkdownToggle
                value={options.mdFormatting ?? "interpret"}
                onChange={(mdFormatting) =>
                  onChange({ ...options, mdFormatting })
                }
              />
            )}
            {isPdfOutput && (
              <PdfOptions options={options} onChange={onChange} />
            )}
          </>
        )}

        {category === "data" && (
          <DataOptions options={options} onChange={onChange} />
        )}

        {category === "presentation" && (
          <div className="flex items-center gap-3">
            <label className="text-sm">DPI</label>
            <select
              value={options.dpi ?? 150}
              onChange={(e) =>
                onChange({ ...options, dpi: Number(e.target.value) })
              }
              className="rounded border bg-background px-3 py-1.5 text-sm"
            >
              <option value={72}>72 (Screen)</option>
              <option value={150}>150 (Print)</option>
              <option value={300}>300 (High Quality)</option>
            </select>
          </div>
        )}

        {category === "ocr" && (
          <OcrOptions options={options} onChange={onChange} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
