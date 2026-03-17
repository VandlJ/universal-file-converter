export const CATEGORY_COLORS: Record<string, string> = {
  image: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  document:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  data: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  presentation:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ocr: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const FORMAT_LABELS: Record<string, string> = {
  jpg: "JPEG",
  jpeg: "JPEG",
  png: "PNG",
  gif: "GIF",
  bmp: "BMP",
  tiff: "TIFF",
  webp: "WebP",
  heic: "HEIC",
  heif: "HEIF",
  avif: "AVIF",
  svg: "SVG",
  ico: "ICO",
  jxl: "JPEG XL",
  qoi: "QOI",
  cr2: "RAW (CR2)",
  nef: "RAW (NEF)",
  arw: "RAW (ARW)",
  pdf: "PDF",
  txt: "Plain Text",
  md: "Markdown",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  xml: "XML",
  yaml: "YAML",
  toml: "TOML",
  csv: "CSV",
  tsv: "TSV",
  rst: "reStructuredText",
  tex: "LaTeX",
  rtf: "RTF",
  docx: "DOCX",
  odt: "ODT",
  epub: "EPUB",
  log: "Log File",
  ini: "INI",
  cfg: "Config",
  env: "ENV",
  xlsx: "Excel",
  xls: "Excel (Legacy)",
  ods: "ODS",
  parquet: "Parquet",
  db: "SQLite",
  sqlite: "SQLite",
  sql: "SQL",
  pptx: "PowerPoint",
  odp: "ODP",
};

export function getFormatLabel(format: string): string {
  return FORMAT_LABELS[format.toLowerCase()] || format.toUpperCase();
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    image: "Image",
    document: "Document",
    data: "Data",
    presentation: "Presentation",
    ocr: "OCR",
  };
  return labels[category] || category;
}
