# GEMINI.md

This file provides project-specific context and instructions for Gemini CLI interactions within the Universal File Converter workspace.

## Project Overview

Universal File Converter is a full-stack web application for converting files between 50+ input and 40+ output formats. It supports five main categories: Image, Document, Data, Presentation, and OCR.

### Tech Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, framer-motion.
- **Backend**: FastAPI (Python 3.12), Pydantic, Uvicorn, Loguru.
- **Conversion Libraries**: Pillow, Pandoc, WeasyPrint, pandas, LibreOffice (headless), Tesseract OCR, pdf2image.
- **Infrastructure**: Docker Compose, optional Redis for job state.

## Core Mandates

1. **Idiomatic Code**: 
   - Backend: Use type hints, Pydantic models for validation, and FastAPI's `BackgroundTasks` or `asyncio.create_task` for long-running conversions.
   - Frontend: Use TypeScript strict mode, React 19 features, and Tailwind v4 CSS variables.
2. **Security**: 
   - Never expose `HMAC_SECRET` or other environment variables in logs.
   - All `job_id` parameters in public-facing endpoints (status, download) MUST be HMAC-signed (format: `uuid.hmac16`). Verify them using `backend/main.py:_verify_job_id`.
3. **Temporary Files**: All conversion data should reside in `settings.TEMP_DIR` (default `/tmp/converter`). Ensure cleanup logic is respected.
4. **Performance**: Conversions are rate-limited to 5 concurrent jobs per IP.

## Building and Running

### Prerequisites
- System packages (for manual backend run): `libmagic`, `pandoc`, `libreoffice`, `tesseract-ocr`, `poppler-utils`, `potrace`.
- `pnpm` for frontend development.

### Docker (Recommended)
```bash
cp .env.example .env
docker compose up --build
```

### Manual Setup
**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
pnpm install
pnpm dev
```

## Project Structure

- `backend/`: FastAPI application.
  - `converters/`: Concrete implementations of `BaseConverter` for each category.
  - `utils/`: File detection, cleanup schedulers, and ZIP builders.
  - `main.py`: API entry point and job management logic.
  - `format_registry.py`: Centralized mapping of all supported input/output formats.
- `frontend/`: Vite-based React application.
  - `src/app/`: Main page components (`page.tsx`, `layout.tsx`).
  - `src/components/`: Modular UI components (DropZone, FileCard, etc.).
  - `src/hooks/`: Custom hooks for file uploads (`useFileUpload`) and conversion polling (`useConversion`).
  - `src/lib/`: API client, types, and format configurations.

## Development Workflows

### Adding a New Format or Converter
1. **Registry**: Add the new format(s) to `backend/format_registry.py`.
2. **Converter**: Implement or update a class in `backend/converters/` extending `BaseConverter`.
3. **Frontend**: Add corresponding labels, icons, or colors to `frontend/src/lib/formats.ts`.
4. **Options**: If the format requires special settings (e.g., quality, DPI), update `backend/models.py:ConversionOptions` and the relevant frontend options component in `src/components/`.

### Testing
- **Backend**: Run `pytest` from the `backend/` directory. Tests are located in `backend/tests/`.
- **Frontend**: 
  - Unit/Component tests: `pnpm test` (Vitest).
  - E2E tests: `pnpm test:e2e` (Playwright).

## Key API Endpoints
- `GET /api/formats`: List all supported formats.
- `POST /api/detect`: Detect file type and return compatible conversion targets.
- `POST /api/convert`: Start a conversion job (returns a signed `job_id`).
- `GET /api/status/{job_id}`: Poll progress (0-100%).
- `GET /api/download/{job_id}`: Fetch the result.
