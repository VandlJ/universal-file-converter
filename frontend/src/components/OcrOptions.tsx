"use client";

import type { ConversionOptions } from "@/lib/types";

interface OcrOptionsProps {
  options: ConversionOptions;
  onChange: (options: ConversionOptions) => void;
}

const LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "ces", label: "Czech" },
  { code: "deu", label: "German" },
  { code: "fra", label: "French" },
  { code: "spa", label: "Spanish" },
  { code: "ita", label: "Italian" },
];

export function OcrOptions({ options, onChange }: OcrOptionsProps) {
  const selected = options.ocrLanguages ?? ["eng"];

  const toggleLang = (code: string) => {
    const next = selected.includes(code)
      ? selected.filter((l) => l !== code)
      : [...selected, code];
    if (next.length > 0) {
      onChange({ ...options, ocrLanguages: next });
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm">OCR Languages</label>
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => toggleLang(lang.code)}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selected.includes(lang.code)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
