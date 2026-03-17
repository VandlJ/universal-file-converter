# Universal File Converter

Full-stack web application for converting files between **50+ input formats** and **40+ output formats** across 5 categories.
Upload via drag & drop, auto-detect file type, pick your target format, and download — all from the browser.

## ✨ Features

- 🖼️ **Image conversion** — JPG, PNG, WebP, HEIC, AVIF, SVG, RAW (CR2/NEF/ARW), ICO, JXL, QOI, and more
- 📄 **Document conversion** — Markdown, HTML, PDF, DOCX, EPUB, LaTeX, RST via Pandoc + WeasyPrint
- 📊 **Data conversion** — CSV, XLSX, JSON, XML, YAML, TOML, Parquet, SQLite → any tabular format
- 🎞️ **Presentation conversion** — PPTX/ODP ↔ PDF ↔ PNG/JPG via LibreOffice headless
- 🔍 **OCR** — Extract text from scanned PDFs and images with Tesseract (Czech, English, German)
- 🎨 **Dark / Light mode** — System-aware theme toggle
- 📁 **Drag & drop upload** — Auto-detection of file type and available conversions
- ⚙️ **Conversion options** — Quality, resize, PDF page settings, OCR language, delimiter, and more
- 🚀 **Docker deployment** — Single `docker compose up` for both frontend and backend
- 🛡️ **Rate limiting** — Max 5 concurrent conversions per IP
- 🧹 **Auto-cleanup** — Temporary files removed after 1 hour

## 🚀 Quick Start

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if you want to change defaults:

```env
# Backend
MAX_FILE_SIZE=104857600          # 100 MB
CLEANUP_INTERVAL_SECONDS=3600   # 1 hour
TESSERACT_LANGUAGES=ces+eng+deu # OCR languages
ALLOWED_ORIGINS=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Run with Docker (recommended)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

### 3. Run manually (development)

**Backend:**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> Requires system packages: `libmagic`, `pandoc`, `libreoffice`, `tesseract-ocr`, `poppler-utils`, `potrace`

**Frontend:**

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/formats` | GET | Get all supported format mappings |
| `/api/detect` | POST | Upload a file and detect its type |
| `/api/convert` | POST | Upload a file and start conversion |
| `/api/status/{job_id}` | GET | Poll conversion progress |
| `/api/download/{job_id}` | GET | Download converted file |
| `/api/download/{job_id}/zip` | GET | Download all output files as ZIP |
| `/api/job/{job_id}` | DELETE | Clean up job files |

### Example

```bash
# Detect file type
curl -X POST http://localhost:8000/api/detect \
  -F "file=@photo.heic"

# Convert file
curl -X POST http://localhost:8000/api/convert \
  -F "file=@photo.heic" \
  -F "output_format=jpg" \
  -F "category=image" \
  -F 'options={"quality": 90}'

# Check status
curl http://localhost:8000/api/status/<job_id>

# Download result
curl -O http://localhost:8000/api/download/<job_id>
```

## 📋 Supported Formats

### Image

| Input | Output |
|-------|--------|
| JPG, JPEG, PNG, GIF, BMP, TIFF, WebP, HEIC, HEIF, AVIF, SVG, ICO, CR2, NEF, ARW, JXL, QOI | JPG, PNG, GIF, BMP, TIFF, WebP, AVIF, ICO, JXL, PDF, SVG |

**Options:** quality (1-100), resize presets (150–3840px), custom dimensions, strip EXIF, background color

### Document

| Input | Output |
|-------|--------|
| TXT, MD, HTML, CSS, JSON, XML, YAML, TOML, CSV, TSV, RST, TEX, RTF, DOCX, ODT, EPUB, LOG, INI, CFG, ENV | TXT, MD, HTML, PDF, DOCX, ODT, EPUB, RST, TEX, RTF |

**Options:** Markdown formatting toggle, PDF page size/orientation/margins/font/page numbers

### Data

| Input | Output |
|-------|--------|
| CSV, TSV, XLSX, XLS, ODS, JSON, XML, YAML, TOML, Parquet, DB, SQLite | CSV, TSV, XLSX, JSON, XML, YAML, TOML, Parquet, PDF, HTML, MD, SQL |

**Options:** delimiter, encoding, sheet selection, header row

### Presentation

| Input | Output |
|-------|--------|
| PPTX, ODP, PDF | PDF, PNG, JPG, PPTX |

**Options:** DPI (72/150/300)

### OCR

| Input | Output |
|-------|--------|
| PDF, JPG, JPEG, PNG, TIFF, BMP | TXT, MD, DOCX, PDF (searchable), HTML |

**Options:** language (English, Czech, German, French, Spanish, Italian)

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| UI | framer-motion, lucide-react, next-themes, sonner |
| Backend | Python 3.12, FastAPI, Uvicorn, Pydantic |
| Image | Pillow, pillow-heif, rawpy, potrace |
| Document | Pandoc, WeasyPrint, python-docx, ebooklib |
| Data | pandas, openpyxl, pyarrow |
| Presentation | LibreOffice (headless), pdf2image, python-pptx |
| OCR | Tesseract, pdf2image |
| Deployment | Docker Compose |

## 📁 Project Structure

```
universal-file-converter/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                  # FastAPI app + endpoints
│   ├── config.py                # Settings (env vars)
│   ├── format_registry.py       # Supported formats map
│   ├── models.py                # Pydantic models
│   ├── converters/
│   │   ├── base.py              # Abstract base converter
│   │   ├── image.py             # Pillow + HEIC + RAW + SVG
│   │   ├── document.py          # Pandoc + WeasyPrint
│   │   ├── data.py              # pandas-based tabular
│   │   ├── presentation.py      # LibreOffice + pdf2image
│   │   ├── ocr.py               # Tesseract OCR
│   │   └── pdf_templates.py     # PDF CSS generation
│   └── utils/
│       ├── detection.py         # File type detection
│       ├── cleanup.py           # Temp file cleanup
│       └── zip_builder.py       # ZIP archive builder
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/
        │   ├── layout.tsx       # Root layout + providers
        │   └── page.tsx         # Main converter page
        ├── components/
        │   ├── DropZone.tsx      # Drag & drop upload
        │   ├── FileList.tsx      # File list with animations
        │   ├── FileCard.tsx      # Per-file card UI
        │   ├── FormatSelector.tsx
        │   ├── ConversionOptions.tsx
        │   ├── DownloadPanel.tsx
        │   └── ThemeToggle.tsx
        ├── hooks/
        │   ├── useFileUpload.ts
        │   └── useConversion.ts
        └── lib/
            ├── api.ts           # Backend API client
            ├── types.ts         # TypeScript interfaces
            ├── formats.ts       # Format labels + colors
            └── utils.ts         # Helpers
```

## 📄 License

MIT — see [LICENSE](LICENSE).
