"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadPanelProps {
  downloadUrl: string;
  filename: string;
}

export function DownloadPanel({ downloadUrl, filename }: DownloadPanelProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        render={<a href={downloadUrl} download={filename} />}
      >
        <Download className="mr-1.5 h-4 w-4" />
        Download
      </Button>
    </div>
  );
}
