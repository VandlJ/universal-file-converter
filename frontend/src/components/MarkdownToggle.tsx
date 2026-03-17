"use client";

interface MarkdownToggleProps {
  value: "interpret" | "literal";
  onChange: (value: "interpret" | "literal") => void;
}

export function MarkdownToggle({ value, onChange }: MarkdownToggleProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm">Markdown handling</label>
      <div className="flex gap-2">
        <button
          onClick={() => onChange("interpret")}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            value === "interpret"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          }`}
        >
          Interpret formatting
        </button>
        <button
          onClick={() => onChange("literal")}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            value === "literal"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          }`}
        >
          Preserve as literal text
        </button>
      </div>
    </div>
  );
}
