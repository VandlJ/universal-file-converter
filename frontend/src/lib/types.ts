export interface FormatRegistry {
  [category: string]: {
    inputs: string[];
    outputs: string[];
    options: string[];
  };
}

export interface FileDetectionResult {
  category: string | null;
  format: string;
  mime_type: string;
  is_ambiguous: boolean;
  available_outputs: string[];
  available_categories?: string[];
}

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  preview?: string;
  detection?: FileDetectionResult;
  selectedFormat?: string;
  selectedCategory?: string;
  options: ConversionOptions;
  status: "idle" | "detecting" | "converting" | "done" | "error";
  progress: number;
  jobId?: string;
  error?: string;
  downloadUrl?: string;
}

export interface ConversionOptions {
  quality?: number;
  resize?: {
    width?: number;
    height?: number;
    preset?: string;
    lockAspect?: boolean;
  };
  stripMetadata?: boolean;
  backgroundColor?: string;
  mdFormatting?: "interpret" | "literal";
  pdfPageSize?: string;
  pdfOrientation?: string;
  pdfMargins?: string;
  pdfFont?: string;
  pdfFontSize?: number;
  pdfPageNumbers?: boolean;
  pdfHeader?: string;
  pdfFooter?: string;
  delimiter?: string;
  encoding?: string;
  sheet?: string;
  headerRow?: boolean;
  ocrLanguages?: string[];
  dpi?: number;
  slideSelection?: string;
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  output_files: string[];
}
