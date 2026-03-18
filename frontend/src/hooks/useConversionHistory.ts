"use client";

import { useCallback, useState } from "react";

export interface ConversionHistoryEntry {
  jobId: string;
  filename: string;
  outputFormat: string;
  downloadUrl: string;
  timestamp: number;
}

const STORAGE_KEY = "ufc_conversion_history";
const MAX_ENTRIES = 20;

function loadHistory(): ConversionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConversionHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function useConversionHistory() {
  const [history, setHistory] = useState<ConversionHistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: ConversionHistoryEntry) => {
    setHistory((prev) => {
      const next = [
        entry,
        ...prev.filter((e) => e.jobId !== entry.jobId),
      ].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // quota exceeded — ignore
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, addEntry, clearHistory };
}
