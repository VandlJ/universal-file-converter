"use client";

import { Progress } from "@/components/ui/progress";

interface ProgressBarProps {
  progress: number;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="space-y-1">
      <Progress value={progress} className="h-2" />
      <p className="text-right text-xs text-muted-foreground">{progress}%</p>
    </div>
  );
}
