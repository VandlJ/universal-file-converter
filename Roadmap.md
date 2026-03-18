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

- [ ] **#8 — In-memory job store: zero resilience, no horizontal scaling**
  `main.py:32` — `jobs: dict` means a backend restart wipes all state. Can't run 2 backend instances behind a load balancer. Minimum fix: Redis with `job_id` as key, TTL matching cleanup interval. Proper fix: ARQ or Celery task queue with Redis broker.

- [x] **#9 — `subprocess.run()` blocks the async event loop** ✅ Fixed
  All converters (`document.py`, `image.py`, `presentation.py`) and `detection.py` now use `asyncio.create_subprocess_exec()` + `await proc.communicate()` with proper timeout handling.

- [ ] **#10 — FORMAT_MAP, EXTENSION_TO_CATEGORY, and converter `supported_*` methods are triplicated**
  `format_registry.py` and each converter class each list supported formats independently. The `supported_input_formats()` / `supported_output_formats()` methods on `BaseConverter` are **never called** — `FORMAT_MAP` is the sole source of truth. This dead code will diverge from reality. Either drive everything from `FORMAT_MAP` or make converters authoritative and build `FORMAT_MAP` from them.

- [x] **#11 — Options dict has no schema validation** ✅ Fixed
  `models.py` — Added `ConversionOptions` Pydantic model (with `extra="allow"` for extensibility). Validated at the API boundary in `main.py` before passing to converters.

- [ ] **#12 — Files fully read into RAM before processing**
  `main.py:175` — `content = await file.read()` loads the entire file into memory. A 100MB upload = 100MB RAM per concurrent request. Should stream to disk in chunks using `shutil.copyfileobj` on the raw `file.file` object.

- [ ] **#13 — Progress reporting is fake**
  `main.py:236, 240, 254` — Progress jumps: pending → 10% → 30% → 100% regardless of actual work. Converters report nothing. For a 30-second OCR job, users see 30% for 25 seconds with no feedback. Converters need a progress callback or SSE events.

- [x] **#14 — No health check endpoint** ✅ Fixed
  Added `GET /health` endpoint in `main.py`. Added `healthcheck` directive in `docker-compose.yml`.

---

## Security Issues

- [x] **#15 — Filenames are not sanitized** ✅ Fixed
  `main.py` — `_sanitize_filename()` helper strips path components via `Path(filename).name` and replaces unsafe characters with `re.sub(r"[^\w\-.]", "_", name)`. Applied at both `/api/detect` and `/api/convert`.

- [ ] **#16 — No job ownership verification**
  `main.py:286` — Any client who knows (or enumerates) a `job_id` UUID can download any other user's converted file. There's no session binding. Minimum fix: sign the `job_id` with a server secret (HMAC) so it can't be guessed; proper fix: session tokens tied to the uploading client.

- [x] **#17 — Internal error details exposed to clients** ✅ Fixed
  `main.py` — Generic `"Conversion failed. Please try again."` returned to client. Full exception details logged server-side only.

---

## Feature Gaps

- [ ] **#18 — No audio/video conversion**
  The single largest missing category. `ffmpeg` handles MP3, MP4, WAV, OGG, MKV, WebM, GIF-from-video, and hundreds more. Add an `AudioConverter` and `VideoConverter` backed by `asyncio.create_subprocess_exec(["ffmpeg", ...])`. This alone doubles the product's addressable use cases.

- [ ] **#19 — No clipboard paste (Ctrl+V)**
  Power users expect to paste screenshots directly into the drop zone. A `paste` event listener on `document` that checks `event.clipboardData.files` is ~15 lines of code in `DropZone.tsx`.

- [ ] **#20 — No URL input**
  "Convert from URL" is a very common workflow — paste a link, convert directly without saving locally first. Add a URL input tab to `DropZone.tsx`; backend fetches the file with `httpx` before converting.

- [ ] **#21 — No output preview before download**
  For images, users want to see a thumbnail of the converted result before committing to the download. The backend could return a base64 thumbnail alongside the download URL, or the frontend could display the image directly from the download URL in a preview modal.

- [ ] **#22 — No multi-format output**
  Converting one PNG to jpg + webp + avif simultaneously is a common web-dev workflow. Currently requires three separate uploads. The API would need to accept `output_formats: list[str]` and the UI a multi-select.

- [ ] **#23 — "Download All" across multiple jobs is missing**
  A `/api/download/{job_id}/zip` endpoint exists for multi-output single jobs, but there's no UI button to download all completed jobs as a single archive. `BatchPanel` and `DownloadPanel` need a "Download All as ZIP" action that POSTs a list of job IDs to a new `/api/batch-download` endpoint.

- [ ] **#24 — No font conversion**
  TTF ↔ OTF ↔ WOFF ↔ WOFF2 is a daily developer workflow. `fonttools` (`pip install fonttools`) handles all of these. A `FontConverter` would be small to implement.

- [ ] **#25 — No conversion history / session persistence**
  All state is lost on page refresh. Even storing the last N conversions in `localStorage` (job ID, filename, format, download URL) would be a meaningful UX improvement. Pairs well with #8 (durable job store).

- [x] **#26 — Polling at fixed 1s interval is inefficient** ✅ Fixed
  `useConversion.ts` — Replaced `setInterval` with adaptive `setTimeout` chain: 200ms for first 2s, 1000ms up to 10s, 3000ms thereafter. Fast conversions get near-instant feedback; long jobs don't spam the server.
