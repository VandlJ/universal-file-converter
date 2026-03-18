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

- [x] **#27 — Missing `cursor: pointer` on interactive elements** ✅ Fixed
  Full component audit: `cursor-pointer` added to all badge/tab/button elements; `cursor-not-allowed` on disabled states (URL fetch button, batch convert button).

- [x] **#28 — No hover/focus ring on format badges** ✅ Fixed
  `FormatSelector.tsx` + `FileCard.tsx` — all badges now have `hover:border-primary/60 hover:bg-accent/60 hover:shadow-sm` and `focus-visible:ring-2 focus-visible:ring-primary/50`. Keyboard navigation works correctly with `tabIndex={0}` + `onKeyDown` Enter handler.

- [x] **#29 — Active/selected badge state is too subtle** ✅ Fixed
  `FormatSelector.tsx` + `BatchPanel.tsx` — selected state changed from `bg-primary/15 border-primary text-primary` to full `bg-primary text-primary-foreground border-primary shadow-sm`. High contrast on both light and dark.

- [x] **#30 — Drop zone has no visual paste hint** ✅ Fixed
  `DropZone.tsx` — keyboard icon + "or paste with Ctrl+V / ⌘V" hint below "Browse files" button.

- [x] **#31 — No drag-over highlight when a file enters from outside the zone** ✅ Fixed
  `DropZone.tsx` — replaced `dragover`/`dragleave` pair with `dragCounter` ref. Counter increments on `dragenter`, decrements on `dragleave`; highlight clears only when counter reaches 0.

- [x] **#32 — FileCard progress bar has no label** ✅ Already done
  `ProgressBar.tsx` already renders `{progress}%` text on the right of the bar.

- [x] **#33 — No empty-state illustration** ✅ Fixed
  `page.tsx` — `FileStack` icon + two-line prompt when `files.length === 0`.

- [x] **#34 — Mobile layout breaks at ≤ 480px** ✅ Fixed
  `BatchPanel.tsx` + `FileCard.tsx` — convert buttons raised to `min-h-[44px]`/`h-11`, badge grids already `flex-wrap`.

- [x] **#35 — No toast on successful batch download** ✅ Fixed
  `page.tsx` — `toast.success("ZIP with N files downloaded")` fires after blob URL is triggered.

- [x] **#36 — Conversion history entries have no timestamp** ✅ Fixed
  `page.tsx` — `relativeTime()` helper outputs `"just now"`, `"5m ago"`, `"2h ago"`, `"3d ago"` beside each history entry.

- [x] **#37 — Dark mode checkerboard for transparent image previews** ✅ Fixed
  `globals.css` — `.bg-checkerboard` utility with `linear-gradient` pattern, dark variant via `.dark .bg-checkerboard`. Applied to `<img>` in `FileCard.tsx`.

- [x] **#38 — URL input has no URL validation** ✅ Fixed
  `DropZone.tsx` — `new URL(url)` try/catch runs before sending the fetch request; shows inline error for obviously invalid input.

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

### Deployment decision

Everything on Hetzner (frontend + backend + Redis) for consistency. Frontend container nginx proxies `/api` to the backend container internally — no CORS or `VITE_API_URL` needed. Host nginx terminates TLS and proxies to the frontend container on `:3000`.

### Open tasks

- [x] **#D1 — Production docker-compose** ✅ Done
  `docker-compose.prod.yml` — uses pre-built ghcr.io images, Redis has no exposed port, `restart: unless-stopped`, `HMAC_SECRET` required from `.env`, healthchecks on backend and Redis.

- [x] **#D2 — nginx config for Hetzner host (TLS + proxy)** ✅ Done
  `deploy/nginx-host.conf` — Let's Encrypt via certbot, `client_max_body_size 110m`, `proxy_pass http://127.0.0.1:3000`, full security headers (X-Frame-Options, HSTS, etc.).

- [x] **#D3 — Frontend deployment** ✅ Done (on Hetzner, not Vercel)
  `frontend/Dockerfile.prod` — accepts `ARG VITE_API_URL=""` build arg (empty = nginx proxy handles `/api`). Served by nginx, SPA routing via `try_files`. Consistent with backend deployment.

- [x] **#D4 — GitHub Actions: CI + CD** ✅ Done
  `.github/workflows/ci.yml` — triggers on push to `dev`/`vandl` and PR to `main`: ruff backend lint, ESLint + `tsc --noEmit` frontend, Docker dry-run builds.
  `.github/workflows/cd.yml` — triggers on push to `main`: build + push to `ghcr.io`, SCP `docker-compose.prod.yml` to server, SSH `docker compose pull && up -d`.

- [ ] **#D5 — First-time server setup**
  One-time steps before the first deploy:
  ```bash
  # On the VPS:
  mkdir -p ~/universal-file-converter
  cat > ~/universal-file-converter/.env << 'EOF'
  HMAC_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  ALLOWED_ORIGINS=https://converter.yourdomain.com
  EOF

  # Install nginx + certbot
  apt install -y nginx certbot python3-certbot-nginx
  cp deploy/nginx-host.conf /etc/nginx/sites-available/converter
  ln -s /etc/nginx/sites-available/converter /etc/nginx/sites-enabled/
  # Edit domain in the config, then:
  certbot --nginx -d converter.yourdomain.com
  ```
  GitHub Actions secrets to add in repo settings:
  - `HETZNER_HOST` — VPS IP or hostname
  - `HETZNER_USER` — SSH username (e.g. `vandl`)
  - `HETZNER_SSH_KEY` — private SSH key (full PEM block, including header/footer)

- [ ] **#D6 — (Optional) PostgreSQL for durable job metadata**
  Redis with AOF is resilient enough for job state with a 1-hour TTL. A PostgreSQL container would only be needed for permanent history (analytics, audit log). Defer until there's a concrete requirement.
