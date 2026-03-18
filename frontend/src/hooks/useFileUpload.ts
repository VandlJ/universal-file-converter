"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { detectFile } from "@/lib/api";
import type { ConversionOptions, UploadedFile } from "@/lib/types";
import { generateId } from "@/lib/utils";

const MAX_FILE_SIZE = Number(import.meta.env.VITE_MAX_FILE_SIZE ?? 104857600);

export function useFileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);

    const entries: UploadedFile[] = fileArray
      .filter((file) => {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(
            `${file.name} is too large (${(file.size / 1048576).toFixed(1)} MB). Maximum is ${(MAX_FILE_SIZE / 1048576).toFixed(0)} MB.`
          );
          return false;
        }
        return true;
      })
      .map((file) => {
        const isImage = file.type.startsWith("image/");
        return {
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          preview: isImage ? URL.createObjectURL(file) : undefined,
          options: {},
          status: "detecting" as const,
          progress: 0,
        };
      });

    if (entries.length === 0) return;

    setFiles((prev) => [...prev, ...entries]);

    // Detect all files in parallel
    await Promise.allSettled(
      entries.map(async (entry) => {
        try {
          const detection = await detectFile(entry.file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? {
                    ...f,
                    detection,
                    selectedCategory: detection.category || undefined,
                    status: "idle" as const,
                  }
                : f
            )
          );
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Detection failed";
          toast.error(`Failed to detect ${entry.name}: ${message}`);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === entry.id
                ? { ...f, status: "error" as const, error: message }
                : f
            )
          );
        }
      })
    );
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      return [];
    });
  }, []);

  const updateFile = useCallback(
    (id: string, updates: Partial<UploadedFile>) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const setSelectedFormat = useCallback((id: string, format: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, selectedFormat: format } : f
      )
    );
  }, []);

  const setSelectedCategory = useCallback((id: string, category: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        // Reset format when changing category
        return { ...f, selectedCategory: category, selectedFormat: undefined };
      })
    );
  }, []);

  const setOptions = useCallback((id: string, options: ConversionOptions) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, options } : f))
    );
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    clearAll,
    updateFile,
    setSelectedFormat,
    setSelectedCategory,
    setOptions,
  };
}
