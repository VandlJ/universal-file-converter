"use client";

import { Switch } from "@/components/ui/switch";
import type { ConversionOptions } from "@/lib/types";

interface DataOptionsProps {
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
}

export function DataOptions({ options, onChange }: DataOptionsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="text-sm">Delimiter</label>
        <select
          value={options.delimiter ?? "auto"}
          onChange={(e) => onChange({ ...options, delimiter: e.target.value })}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="auto">Auto-detect</option>
          <option value=",">Comma (,)</option>
          <option value="	">Tab</option>
          <option value=";">Semicolon (;)</option>
          <option value="|">Pipe (|)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm">Encoding</label>
        <select
          value={options.encoding ?? "auto"}
          onChange={(e) => onChange({ ...options, encoding: e.target.value })}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm"
        >
          <option value="auto">Auto-detect</option>
          <option value="utf-8">UTF-8</option>
          <option value="latin-1">Latin-1</option>
          <option value="windows-1250">Windows-1250</option>
          <option value="windows-1252">Windows-1252</option>
          <option value="ascii">ASCII</option>
        </select>
      </div>

      <div className="flex items-center justify-between sm:col-span-2">
        <label className="text-sm">First row is header</label>
        <Switch
          checked={options.headerRow ?? true}
          onCheckedChange={(headerRow) => onChange({ ...options, headerRow })}
        />
      </div>
    </div>
  );
}
