"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";

interface DropZoneProps {
  onFilesAdded: (files: FileList | File[]) => void;
}

export function DropZone({ onFilesAdded }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onFilesAdded(e.dataTransfer.files);
      }
    },
    [onFilesAdded]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFilesAdded(e.target.files);
        e.target.value = "";
      }
    },
    [onFilesAdded]
  );

  return (
    <motion.div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      animate={isDragOver ? { scale: 1.01 } : { scale: 1 }}
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
        isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChange}
      />

      <div
        className={`rounded-full p-4 transition-colors ${
          isDragOver ? "bg-primary/10" : "bg-muted"
        }`}
      >
        <Upload
          className={`h-8 w-8 ${
            isDragOver ? "text-primary" : "text-muted-foreground"
          }`}
        />
      </div>

      <div className="text-center">
        <p className="text-lg font-medium">
          {isDragOver ? "Drop files here" : "Drop files here or click to browse"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload any file type — images, documents, spreadsheets, and more
        </p>
      </div>
    </motion.div>
  );
}
