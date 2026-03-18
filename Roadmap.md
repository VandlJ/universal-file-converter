# Universal File Converter — Roadmap

A full audit of the codebase. Items are organized by category with checkboxes for tracking progress.

---

## Tech Stack Opinion

### Good Choices

**FastAPI + Python (backend)**
The right call. Python has the richest ecosystem for file processing: Pillow, Pandoc bindings, rawpy, WeasyPrint, Tesseract, pandas. FastAPI gives you async out of the box and Pydantic for validation. Nothing else competes here for this use case.

**TypeScript throughout**
Essential. When you're passing format names, options, and job IDs between frontend and backend, untyped code turns into subtle bugs fast. The types in `lib/types.ts` are clean — good foundation.

**shadcn/ui + Tailwind v4**
Modern and correct. shadcn/ui avoids component-library lock-in (you own the source), Tailwind v4's CSS variable approach makes theming clean. Good long-term choice.

**npm**
Standard package manager with broad ecosystem support.

**Docker Compose**
Right for self-hosted / developer deployment. The volume mount for `/tmp/converter` is a nice touch.

**Pillow, Pandoc, LibreOffice, Tesseract**
Industry-standard tools for their respective domains. Not reinventing the wheel — correct.

---

### Questionable Choices

~~**Next.js for a single-page app**~~
~~This is a single-page tool with no routes, no SSR, no SEO, no RSC. Next.js adds ~50KB of runtime overhead, a more complex build pipeline, and App Router conventions that don't apply here. **Vite + React** would be lighter, faster HMR, simpler to configure, and more than sufficient.~~
✅ **Migrated to Vite + React** — lighter build, faster HMR, simpler config. Nginx serves static assets in Docker with a proxy pass for `/api`.

**In-memory job store (`jobs: dict` in `main.py`)**
Architecturally wrong from day one for anything beyond a local tool. Backend restart = all jobs lost, no horizontal scaling possible. This was the fastest way to prototype but needs to be replaced before any real deployment.

**`subprocess.run()` inside async functions** ✅ Fixed (#9)
~~Synchronous subprocess calls inside `async def` functions block the asyncio event loop. During a 30-second LibreOffice conversion, the entire server is frozen. Should be `asyncio.create_subprocess_exec` + `await proc.communicate()`.~~

---

### Missing from the Stack

| Gap | What's needed |
|---|---|
| Job queue | Redis + ARQ (or Celery) for durable, scalable job processing |
| Real-time progress | SSE or WebSockets instead of adaptive polling |
| Test framework | `pytest` + `pytest-asyncio` for backend; `Vitest` + RTL for frontend |
| Observability | Prometheus metrics endpoint, structured logs, health check endpoint ✅ |
| ffmpeg | Audio/video conversion — biggest missing category |

---

## Bugs

Things that are broken right now.

- [x] **#1 — Detection is sequential, not parallel** ✅ Fixed
  `useFileUpload.ts` — Replaced `for...of` with `await Promise.allSettled(entries.map(...))`. All files now detect concurrently.

- [x] **#2 — Batch conversion has a `setTimeout` race condition** ✅ Fixed
  `page.tsx` — Removed `setTimeout`. Format is now passed directly to `startConversion` via a local `updated` object, bypassing the state-settling race.

- [x] **#3 — docker-compose API URL broken for real deployments** ✅ Fixed
  Migrated to Vite. Frontend uses relative URLs (`""`). Vite dev server proxies `/api` to `localhost:8000`. In Docker, nginx proxies `/api` to `backend:8000`. No baked-in URL.

- [x] **#4 — Rate limiter reads a private asyncio attribute** ✅ Fixed
  `main.py` — Replaced `sem.locked() and sem._value == 0` with `sem.locked()` (public API).

- [x] **#5 — Filename collision in `/api/detect`** ✅ Fixed
  `main.py` — Temp files now prefixed with a UUID hex: `{uuid.uuid4().hex}_{safe_name}`. No collisions possible.

- [x] **#6 — Memory leak: `jobs` dict is never pruned** ✅ Fixed
  `cleanup.py` — Cleanup scheduler now accepts a `jobs` dict reference and removes stale entries when their temp directories are deleted.

- [x] **#7 — `MAX_CONCURRENT_JOBS` config setting is unused** ✅ Fixed
  `main.py` — `_global_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)` now wraps all conversions. Per-IP limit still applies inside.

---

## Technical Debt

Architecture problems that limit reliability and maintainability.

- [x] **#8 — In-memory job store: zero resilience, no horizontal scaling** ✅ Fixed
  Added `job_store.py` — `JobStore` class backed by Redis (`redis.asyncio`) with automatic in-memory fallback. Jobs stored with TTL = cleanup interval. Redis container added to `docker-compose.yml` with AOF persistence. Backend connects on startup via `REDIS_URL` env var; gracefully falls back to in-memory if Redis is unreachable. Cleanup scheduler now calls `job_store.delete_stale()` to prune in-memory entries.

- [x] **#9 — `subprocess.run()` blocks the async event loop** ✅ Fixed
  All converters (`document.py`, `image.py`, `presentation.py`) and `detection.py` now use `asyncio.create_subprocess_exec()` + `await proc.communicate()` with proper timeout handling.

- [x] **#10 — FORMAT_MAP, EXTENSION_TO_CATEGORY, and converter `supported_*` methods are triplicated** ✅ Fixed
  Removed `supported_input_formats()` and `supported_output_formats()` abstract methods from `BaseConverter` and all 5 converter implementations. `FORMAT_MAP` in `format_registry.py` remains the single source of truth.

- [x] **#11 — Options dict has no schema validation** ✅ Fixed
  `models.py` — Added `ConversionOptions` Pydantic model (with `extra="allow"` for extensibility). Validated at the API boundary in `main.py` before passing to converters.

- [x] **#12 — Files fully read into RAM before processing** ✅ Fixed
  `main.py` — Both `/api/detect` and `/api/convert` now stream uploads to disk in 64KB chunks via `await file.read(65536)`. Size limit enforced incrementally during streaming; oversized files are rejected early without full RAM load. Job directory is cleaned up if streaming fails mid-way.

- [x] **#13 — Progress reporting is fake** ✅ Fixed
  Added `ProgressCallback = Callable[[int], Awaitable[None]]` to `converters/base.py`. All 5 converters now accept `on_progress` and call it at meaningful stages. OCR reports per-page progress (20%+70%/n_pages). `_run_conversion` creates the callback that updates the job in the store and persists to Redis. Progress now reflects actual conversion stages rather than jumping 30% → 100%.

- [x] **#14 — No health check endpoint** ✅ Fixed
  Added `GET /health` endpoint in `main.py`. Added `healthcheck` directive in `docker-compose.yml`.

---

## Security Issues

- [x] **#15 — Filenames are not sanitized** ✅ Fixed
  `main.py` — `_sanitize_filename()` helper strips path components via `Path(filename).name` and replaces unsafe characters with `re.sub(r"[^\w\-.]", "_", name)`. Applied at both `/api/detect` and `/api/convert`.

- [x] **#16 — No job ownership verification** ✅ Fixed
  `main.py` — `_sign_job_id()` appends a 16-char HMAC-SHA256 suffix (keyed on `settings.HMAC_SECRET`). `_verify_job_id()` uses `hmac.compare_digest` to validate on every status/download/delete call. Clients who don't have the signed token can't access any job.

- [x] **#17 — Internal error details exposed to clients** ✅ Fixed
  `main.py` — Generic `"Conversion failed. Please try again."` returned to client. Full exception details logged server-side only.

---

## Feature Gaps

- [x] **#18 — No audio/video conversion** ✅ Fixed
  `converters/media.py` — `MediaConverter` drives ffmpeg (already in Dockerfile) via `asyncio.create_subprocess_exec`. Supports audio (MP3/WAV/OGG/FLAC/AAC/M4A/Opus) and video (MP4/MKV/WebM/AVI/MOV/GIF/MP3 extraction). Both categories registered in `format_registry.py`, `CONVERTERS`, and `formats.ts` with icons and colors.

- [x] **#19 — No clipboard paste (Ctrl+V)** ✅ Fixed
  `DropZone.tsx` — `useEffect` adds a `paste` listener on `document`; any clipboard files are forwarded to `onFilesAdded`.

- [x] **#20 — No URL input** ✅ Fixed
  `DropZone.tsx` — Tab switcher ("Drop / Browse" | "From URL"). The URL tab fetches via `POST /api/fetch-url` (httpx, streaming through backend). The returned blob is created into a `File` and passed through the normal detect → convert flow.

- [x] **#21 — No output preview before download** ✅ Fixed
  `FileCard.tsx` — After a conversion completes, image-format outputs (jpg/png/gif/webp/bmp/avif/tiff/ico) render a thumbnail directly from the download URL above the download button.

- [x] **#22 — No multi-format output** ✅ Fixed
  `FileCard.tsx` — When status is "done", a row of quick-pick format badges (up to 6, excluding the current output) lets users kick off a new conversion without re-uploading.

- [x] **#23 — "Download All" across multiple jobs is missing** ✅ Fixed
  `BatchPanel.tsx` — "Download all as ZIP" button appears when all batch files are done. `POST /api/batch-download` accepts a list of signed job IDs and streams a ZIP of all output files.

- [x] **#24 — No font conversion** ✅ Fixed
  `converters/font.py` — `FontConverter` uses `fonttools` (`fontTools.ttLib.TTFont`) to convert between TTF, OTF, WOFF, and WOFF2. `brotli` added for WOFF2 compression. Registered in `format_registry.py`, `CONVERTERS`, and `formats.ts`.

- [x] **#25 — No conversion history / session persistence** ✅ Fixed
  `hooks/useConversionHistory.ts` — Stores the last 20 completed conversions in `localStorage`. `page.tsx` tracks which file IDs have been persisted and adds entries on status → "done". A collapsible history panel below the file list shows past conversions with re-download links. History survives page refresh.

- [x] **#26 — Polling at fixed 1s interval is inefficient** ✅ Fixed
  `useConversion.ts` — Replaced `setInterval` with adaptive `setTimeout` chain: 200ms for first 2s, 1000ms up to 10s, 3000ms thereafter. Fast conversions get near-instant feedback; long jobs don't spam the server.

---

## UI / UX Polish

Small but visible quality-of-life issues that make the app feel unfinished.

- [ ] **#27 — Missing `cursor: pointer` on interactive elements**
  Several clickable elements (format badges in `FormatSelector`, quick-convert badges in `FileCard`, category tabs in `BatchPanel`, the drop zone itself) render the default cursor instead of a pointer. Every element the user can click should respond visually. Audit the full component tree and add `cursor-pointer` where missing, `cursor-not-allowed opacity-50` on disabled states.

- [ ] **#28 — No hover/focus ring on format badges**
  Format badges in `FormatSelector` and the quick-convert row use only a colour change on hover — no border highlight or ring. Add `focus-visible:ring-2 focus-visible:ring-primary/50` and a more pronounced `hover:border-primary hover:shadow-sm` so keyboard and mouse users both see clear affordance.

- [ ] **#29 — Active/selected badge state is too subtle**
  The selected output format badge uses `bg-primary/15 border-primary text-primary` — on dark mode this is hard to distinguish from unselected. Increase contrast: `bg-primary text-primary-foreground` for the selected state, consistent with how the "Convert" button looks.

- [ ] **#30 — Drop zone has no visual paste hint**
  Now that Ctrl+V paste is supported, users don't know it's possible. Add a small `Ctrl+V` keyboard hint below the "Browse files" button, similar to how Figma and Linear surface this.

- [ ] **#31 — No drag-over highlight when a file enters from outside the zone**
  The scale animation triggers correctly, but the border colour doesn't change until `dragenter` fires on the zone itself — if the cursor enters directly onto a child element the highlight is missed. Bind `onDragOver` to the outer container and use a `dragenter`/`dragleave` counter to avoid false negatives.

- [ ] **#32 — FileCard progress bar has no label**
  The `ProgressBar` shows a numeric percentage as a bar fill but no text readout. Add `{progress}%` inside or beside the bar so users know at a glance whether conversion is at 30% or 90%.

- [ ] **#33 — No empty-state illustration**
  When the file list is empty the page below the drop zone is a blank void. A light SVG illustration or a short two-line prompt ("Drop your first file above to get started") would make the initial state feel intentional rather than broken.

- [ ] **#34 — Mobile layout breaks at ≤ 480px**
  The `BatchPanel` format badge grid overflows on small screens and the `FileCard` option collapsible touch target is too small (~24px). Needs a responsive audit: `flex-wrap` badge grids, larger touch targets (`min-h-[44px]`), and full-width buttons on mobile.

- [ ] **#35 — No toast on successful batch download**
  When "Download all as ZIP" succeeds the user only sees the browser's file-save dialog — there's no success toast. Add `toast.success("ZIP downloaded")` after the blob URL is triggered.

- [ ] **#36 — Conversion history entries have no timestamp**
  History entries show filename + download link but not when the conversion happened. Add a relative timestamp (`2 min ago`, `yesterday`) using `Intl.RelativeTimeFormat` so users can distinguish sessions.

- [ ] **#37 — Dark mode checkerboard for transparent image previews**
  The converted image thumbnail uses `bg-muted` as its background. For transparent PNGs this conceals the transparency. Add a CSS checkerboard pattern (two-colour `linear-gradient`) via a `.bg-checkerboard` utility class in `globals.css`.

- [ ] **#38 — URL input has no URL validation**
  The "Fetch" button is enabled for any non-empty string — including obviously invalid inputs like `"hello"`. Add basic URL validation (`URL` constructor try/catch) client-side before sending the request, with an inline error.

---

## Deployment

Split deployment: static frontend on Vercel's CDN, backend + Redis on a Hetzner VPS.

### Architecture

```
Browser
  ↓  HTTPS
Vercel (frontend static)          ← vite build → dist/
  ↓  API calls to BACKEND_URL
Hetzner VPS
  ├── nginx (TLS termination, reverse proxy → :8000)
  ├── Docker: backend (FastAPI / uvicorn)
  ├── Docker: redis (AOF persistence)
  └── /tmp/converter volume
```

### CORS

When FE is on `*.vercel.app` and BE is on a custom domain, `ALLOWED_ORIGINS` in `docker-compose.yml` must list the exact Vercel URL (or `*` during development). Vercel preview deployments get different URLs each time — either allowlist the production domain only, or use a wildcard pattern validated server-side.

### Open tasks

- [ ] **#D1 — Backend: production docker-compose for Hetzner**
  A separate `docker-compose.prod.yml` (or override file) with:
  - No exposed Redis port (`6379` internal only)
  - `HMAC_SECRET` loaded from env / secret file
  - `ALLOWED_ORIGINS=https://your-app.vercel.app`
  - Resource limits (`mem_limit`, `cpus`) to protect the VPS
  - `restart: unless-stopped` on all services
  - Bind-mount `/tmp/converter` to a directory with defined retention

- [ ] **#D2 — nginx config for Hetzner (TLS + proxy)**
  `nginx.conf` for the VPS host (not the Docker nginx already used for the FE container):
  - Let's Encrypt via `certbot --nginx` or `acme.sh`
  - `proxy_pass http://127.0.0.1:8000` for the backend
  - `client_max_body_size 110m` to match `MAX_FILE_SIZE`
  - Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`

- [ ] **#D3 — Vercel: frontend deployment config**
  - `vercel.json` at repo root: `{ "buildCommand": "cd frontend && npm run build", "outputDirectory": "frontend/dist", "framework": null }` (Vite output, no Next.js preset)
  - `VITE_API_URL` env var in Vercel dashboard pointing to the Hetzner backend URL
  - Confirm SPA routing: Vercel rewrites `/*` → `/index.html` (add `rewrites` in `vercel.json`)

- [ ] **#D4 — GitHub Actions: CI pipeline**
  On PR / push to `main`:
  1. `npm ci && npm run build` in `frontend/` — catches TypeScript/build errors early
  2. `pip install -r requirements.txt && python -m py_compile $(find backend -name "*.py")` — catches import errors
  3. Optionally: `docker compose build` smoke test
  On merge to `main`: auto-deploy frontend via Vercel GitHub integration; backend needs a deploy step (SSH + `docker compose pull && docker compose up -d`).

- [ ] **#D5 — Secrets management**
  - `HMAC_SECRET`: generate with `python -c "import secrets; print(secrets.token_hex(32))"`, store in Hetzner `.env` file (not in repo), and in GitHub Actions secrets for the CI deploy step.
  - `REDIS_URL`: internal Docker network — never exposed externally.
  - Rotate `HMAC_SECRET` invalidates all outstanding signed job IDs (short-lived by design — TTL = cleanup interval, typically 1h). Document this.

- [ ] **#D6 — (Optional) PostgreSQL for durable job metadata**
  Redis with AOF is resilient enough for job state with a 1-hour TTL. A PostgreSQL container would only be needed if you want permanent job history (e.g., analytics, audit log). Defer until there's a concrete requirement.
