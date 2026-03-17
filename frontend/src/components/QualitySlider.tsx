"use client";

import { Slider } from "@/components/ui/slider";

interface QualitySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function QualitySlider({ value, onChange }: QualitySliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm">Quality</label>
        <span className="text-sm font-medium">{value}%</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(val) => {
          const arr = val as number[];
          onChange(arr[0]);
        }}
        min={1}
        max={100}
        step={1}
      />
    </div>
  );
}
