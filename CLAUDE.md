# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack file conversion web app: Next.js 16 + React 19 frontend, Python FastAPI backend. Supports 50+ input / 40+ output formats across 5 categories (Image, Document, Data, Presentation, OCR).

## Commands

### Docker (recommended)
```bash
cp .env.example .env
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

### Frontend (manual)
```bash
cd frontend
pnpm install
pnpm dev        # dev server
pnpm build      # production build
pnpm lint       # eslint
```

### Backend (manual)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Requires system packages: `libmagic`, `pandoc`, `libreoffice`, `tesseract-ocr`, `poppler-utils`, `potrace`

## Architecture

### Backend (`backend/`)
- **`main.py`** — FastAPI app, REST endpoints, in-memory job store, rate limiting (5 concurrent/IP), background task queue
- **`config.py`** — Pydantic `BaseSettings` (env-driven: `MAX_FILE_SIZE`, `TEMP_DIR`, `CLEANUP_INTERVAL_SECONDS`, `TESSERACT_LANGUAGES`, `ALLOWED_ORIGINS`)
- **`format_registry.py`** — All format mappings (50+ input → 40+ output)
- **`converters/base.py`** — Abstract `BaseConverter` with 3 methods: `convert()`, `supported_input_formats()`, `supported_output_formats()`
- **`converters/{image,document,data,presentation,ocr}.py`** — Concrete implementations using Pillow, Pandoc/WeasyPrint, pandas, LibreOffice, Tesseract
- **`utils/detection.py`** — File type detection via python-magic + magic bytes
- **`utils/cleanup.py`** — Async scheduler that removes temp files from `/tmp/converter` after 1 hour

**Conversion flow:** `POST /api/convert` → assigns job_id → background task runs converter → client polls `GET /api/status/{job_id}` (0–100%) → `GET /api/download/{job_id}`

### Frontend (`frontend/src/`)
- **`app/page.tsx`** — Root page, composes all major components
- **`app/layout.tsx`** — Providers: `ThemeProvider`, `TooltipProvider`, `Sonner Toaster`
- **`hooks/useFileUpload.ts`** — File list state, auto-detection via `/api/detect`, format selection
- **`hooks/useConversion.ts`** — Conversion logic, polling loop, download handling
- **`lib/api.ts`** — All fetch calls to the backend API
- **`lib/types.ts`** — Shared TypeScript interfaces
- **`components/`** — One component per UI concern (DropZone, FileCard, FormatSelector, ConversionOptions, BatchPanel, DownloadPanel, etc.)
- **`components/ui/`** — shadcn/ui primitives (do not modify directly)

**Data flow:** `DropZone` → `addFiles()` → detect → user picks format + options → `startConversion()` → poll until done → download

### Key Configuration
- **Frontend env:** `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)
- **Tailwind:** v4 with CSS variables; theme tokens in `globals.css`
- **shadcn/ui:** baseColor `neutral`, CSS vars mode — use `components.json` config when adding new components
- **TypeScript:** strict mode, path alias `@/*` → `src/*`
- **Package manager:** pnpm (use `pnpm`, not `npm` or `yarn`)

### Adding a New Converter
1. Add format entries to `backend/format_registry.py`
2. Implement converter in `backend/converters/` extending `BaseConverter`
3. Register it in the `CONVERTERS` dict in `main.py`
4. Add format labels/colors to `frontend/src/lib/formats.ts` if needed
