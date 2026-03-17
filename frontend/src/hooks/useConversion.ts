"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { convertFile, deleteJob, getJobStatus, getDownloadUrl } from "@/lib/api";
import type { UploadedFile } from "@/lib/types";

export function useConversion(
  updateFile: (id: string, updates: Partial<UploadedFile>) => void
) {
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map()
  );

  const stopPolling = useCallback((fileId: string) => {
    const interval = pollingRefs.current.get(fileId);
    if (interval) {
      clearInterval(interval);
      pollingRefs.current.delete(fileId);
    }
  }, []);

  const startConversion = useCallback(
    async (file: UploadedFile) => {
      if (!file.selectedFormat || !file.selectedCategory) {
        toast.error("Please select an output format first");
        return;
      }

      updateFile(file.id, {
        status: "converting",
        progress: 0,
        error: undefined,
      });

      try {
        const { job_id } = await convertFile(
          file.file,
          file.selectedFormat,
          file.selectedCategory,
          file.options
        );

        updateFile(file.id, { jobId: job_id, progress: 5 });

        // Start polling
        const interval = setInterval(async () => {
          try {
            const status = await getJobStatus(job_id);
            updateFile(file.id, { progress: status.progress });

            if (status.status === "completed") {
              stopPolling(file.id);
              updateFile(file.id, {
                status: "done",
                progress: 100,
                downloadUrl: getDownloadUrl(job_id),
              });
              toast.success(`${file.name} converted successfully!`);
            } else if (status.status === "failed") {
              stopPolling(file.id);
              updateFile(file.id, {
                status: "error",
                error: status.error || "Conversion failed",
              });
              toast.error(
                status.error || `Failed to convert ${file.name}`
              );
            }
          } catch {
            stopPolling(file.id);
            updateFile(file.id, {
              status: "error",
              error: "Connection lost. Your files are safe — click retry.",
            });
          }
        }, 1000);

        pollingRefs.current.set(file.id, interval);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Conversion request failed";
        updateFile(file.id, { status: "error", error: message });
        toast.error(message);
      }
    },
    [updateFile, stopPolling]
  );

  const cancelConversion = useCallback(
    async (file: UploadedFile) => {
      stopPolling(file.id);
      if (file.jobId) {
        try {
          await deleteJob(file.jobId);
        } catch {
          // Ignore cleanup errors
        }
      }
      updateFile(file.id, {
        status: "idle",
        progress: 0,
        jobId: undefined,
        error: undefined,
      });
    },
    [updateFile, stopPolling]
  );

  return { startConversion, cancelConversion };
}
