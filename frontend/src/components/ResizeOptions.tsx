"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface ResizeConfig {
  width?: number;
  height?: number;
  preset?: string;
  lockAspect?: boolean;
}

interface ResizeOptionsProps {
  resize: ResizeConfig | undefined;
  onChange: (resize: ResizeConfig | undefined) => void;
}

const PRESETS = [
  { label: "Thumbnail", value: 150 },
  { label: "Small", value: 480 },
  { label: "Medium", value: 1024 },
  { label: "HD", value: 1920 },
  { label: "4K", value: 3840 },
];

export function ResizeOptions({ resize, onChange }: ResizeOptionsProps) {
  const activePreset = resize?.preset;

  return (
    <div className="space-y-3">
      <label className="text-sm">Resize</label>

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={!resize ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(undefined)}
        >
          Original
        </Button>
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            variant={activePreset === p.label ? "default" : "outline"}
            size="sm"
            onClick={() =>
              onChange({
                width: p.value,
                preset: p.label,
                lockAspect: true,
              })
            }
          >
            {p.label} ({p.value}px)
          </Button>
        ))}
        <Button
          variant={activePreset === "custom" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            onChange({
              width: resize?.width || 800,
              height: resize?.height || 600,
              preset: "custom",
              lockAspect: resize?.lockAspect ?? true,
            })
          }
        >
          Custom
        </Button>
      </div>

      {activePreset === "custom" && (
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="Width"
            value={resize?.width ?? ""}
            onChange={(e) =>
              onChange({
                ...resize,
                width: Number(e.target.value) || undefined,
                preset: "custom",
              })
            }
            className="w-24 rounded border bg-background px-2 py-1.5 text-sm"
          />
          <span className="text-muted-foreground">x</span>
          <input
            type="number"
            placeholder="Height"
            value={resize?.height ?? ""}
            onChange={(e) =>
              onChange({
                ...resize,
                height: Number(e.target.value) || undefined,
                preset: "custom",
              })
            }
            className="w-24 rounded border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex items-center gap-1.5">
            <Switch
              checked={resize?.lockAspect ?? true}
              onCheckedChange={(lockAspect) =>
                onChange({ ...resize, lockAspect, preset: "custom" })
              }
            />
            <label className="text-xs text-muted-foreground">Lock aspect</label>
          </div>
        </div>
      )}
    </div>
  );
}
