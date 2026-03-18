import type {
  ConversionOptions,
  FileDetectionResult,
  FormatRegistry,
  JobStatus,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function fetchFormats(): Promise<FormatRegistry> {
  const res = await fetch(`${API_BASE}/api/formats`);
  if (!res.ok) throw new Error("Failed to fetch formats");
  return res.json();
}

export async function detectFile(file: File): Promise<FileDetectionResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/detect`, {
    method: "POST",
    body: formData,
  });

  if (res.status === 413) {
    const data = await res.json();
    throw new Error(data.detail || "File too large");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to detect file type");
  }

  return res.json();
}

export async function convertFile(
  file: File,
  outputFormat: string,
  category: string,
  options: ConversionOptions
): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("output_format", outputFormat);
  formData.append("category", category);
  formData.append("options", JSON.stringify(options));

  const res = await fetch(`${API_BASE}/api/convert`, {
    method: "POST",
    body: formData,
  });

  if (res.status === 413) {
    const data = await res.json();
    throw new Error(data.detail || "File too large");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Conversion request failed");
  }

  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/status/${jobId}`);
  if (!res.ok) throw new Error("Failed to get job status");
  return res.json();
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/api/download/${jobId}`;
}

export function getZipDownloadUrl(jobId: string): string {
  return `${API_BASE}/api/download/${jobId}/zip`;
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/job/${jobId}`, { method: "DELETE" });
}
