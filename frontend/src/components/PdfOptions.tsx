"use client";

import { Switch } from "@/components/ui/switch";
import type { ConversionOptions } from "@/lib/types";

interface PdfOptionsProps {
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
}

export function PdfOptions({ options, onChange }: PdfOptionsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-sm">Page size</label>
        <select
          value={options.pdfPageSize ?? "A4"}
          onChange={(e) => onChange({ ...options, pdfPageSize: e.target.value })}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="A4">A4</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
          <option value="A3">A3</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Orientation</label>
        <select
          value={options.pdfOrientation ?? "portrait"}
          onChange={(e) =>
            onChange({ ...options, pdfOrientation: e.target.value })
          }
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Margins</label>
        <select
          value={options.pdfMargins ?? "normal"}
          onChange={(e) => onChange({ ...options, pdfMargins: e.target.value })}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="normal">Normal</option>
          <option value="narrow">Narrow</option>
          <option value="wide">Wide</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Font</label>
        <select
          value={options.pdfFont ?? "sans-serif"}
          onChange={(e) => onChange({ ...options, pdfFont: e.target.value })}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="sans-serif">Sans-serif (Arial)</option>
          <option value="serif">Serif (Times New Roman)</option>
          <option value="monospace">Monospace (Courier)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Font size</label>
        <input
          type="number"
          value={options.pdfFontSize ?? 12}
          onChange={(e) =>
            onChange({ ...options, pdfFontSize: Number(e.target.value) })
          }
          min={8}
          max={24}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-sm">Page numbers</label>
        <Switch
          checked={options.pdfPageNumbers ?? true}
          onCheckedChange={(pdfPageNumbers) =>
            onChange({ ...options, pdfPageNumbers })
          }
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Header text</label>
        <input
          type="text"
          value={options.pdfHeader ?? ""}
          onChange={(e) => onChange({ ...options, pdfHeader: e.target.value })}
          placeholder="Optional header"
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Footer text</label>
        <input
          type="text"
          value={options.pdfFooter ?? ""}
          onChange={(e) => onChange({ ...options, pdfFooter: e.target.value })}
          placeholder="Optional footer"
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
