import asyncio
import json
import re
import shutil
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from loguru import logger

from config import settings
from converters.data import DataConverter
from converters.document import DocumentConverter
from converters.image import ImageConverter
from converters.ocr import OcrConverter
from converters.presentation import PresentationConverter
from format_registry import FORMAT_MAP, get_formats
from job_store import JobStore
from models import ConversionOptions, ConvertResponse, DetectionResponse, JobStatusResponse
from utils.cleanup import cleanup_on_startup, cleanup_scheduler
from utils.detection import detect_file
from utils.zip_builder import create_zip

# ---------------------------------------------------------------------------
# Job store
# ---------------------------------------------------------------------------

job_store = JobStore(
    redis_url=settings.REDIS_URL,
    ttl=settings.CLEANUP_INTERVAL_SECONDS,
)

CONVERTERS = {
    "image": ImageConverter(),
    "document": DocumentConverter(),
    "data": DataConverter(),
    "presentation": PresentationConverter(),
    "ocr": OcrConverter(),
}

# ---------------------------------------------------------------------------
# Rate limiting: per-IP + global concurrent job limits
# ---------------------------------------------------------------------------

MAX_CONCURRENT_PER_IP = 5
_ip_semaphores: dict[str, asyncio.Semaphore] = defaultdict(
    lambda: asyncio.Semaphore(MAX_CONCURRENT_PER_IP)
)
_global_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_JOBS)


def _sanitize_filename(filename: str) -> str:
    """Strip path components and replace unsafe characters."""
    name = Path(filename).name
    return re.sub(r"[^\w\-.]", "_", name) or "upload"


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

cleanup_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global cleanup_task
    await job_store.connect()
    logger.info(f"Job store backend: {job_store.backend}")
    await cleanup_on_startup(settings.TEMP_DIR)
    cleanup_task = asyncio.create_task(
        cleanup_scheduler(
            settings.TEMP_DIR,
            settings.CLEANUP_INTERVAL_SECONDS,
            settings.CLEANUP_INTERVAL_SECONDS,
            job_store,
        )
    )
    logger.info("Application started")
    yield
    if cleanup_task:
        cleanup_task.cancel()
    await job_store.close()
    logger.info("Application shutdown")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Universal File Converter", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    """Health check endpoint for load balancers and Docker healthcheck."""
    return {"status": "ok", "store": job_store.backend}


@app.get("/api/formats")
async def get_format_registry():
    """Return all supported input->output format mappings."""
    return get_formats()


@app.post("/api/detect", response_model=DetectionResponse)
async def detect_uploaded_file(file: UploadFile = File(...)):
    """Upload a file and return its detected type + available conversions."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    temp_dir = Path(settings.TEMP_DIR) / "detect"
    temp_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{_sanitize_filename(file.filename)}"
    temp_path = temp_dir / safe_name

    try:
        # Stream to disk, enforcing size limit
        bytes_written = 0
        with open(temp_path, "wb") as out_f:
            while chunk := await file.read(65536):
                bytes_written += len(chunk)
                if bytes_written > settings.MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE // 1_048_576} MB.",
                    )
                out_f.write(chunk)

        result = await detect_file(str(temp_path), file.filename)
        return DetectionResponse(**result)
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.post("/api/convert", response_model=ConvertResponse)
async def convert_file(
    request: Request,
    file: UploadFile = File(...),
    output_format: str = Form(...),
    category: str = Form(...),
    options: str = Form("{}"),
):
    """Upload a file and start conversion. Returns job ID."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    sem = _ip_semaphores[client_ip]
    if sem.locked():
        raise HTTPException(
            status_code=429,
            detail="Too many concurrent conversions. Please wait for current conversions to finish.",
        )

    # Parse and validate options
    try:
        opts_raw = json.loads(options)
        opts = ConversionOptions.model_validate(opts_raw).model_dump()
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid options JSON")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid options: {e}")

    # Validate category
    if category not in FORMAT_MAP:
        raise HTTPException(status_code=400, detail=f"Unknown category: {category}")

    # Validate output format
    if output_format not in FORMAT_MAP[category]["outputs"]:
        raise HTTPException(
            status_code=400,
            detail=f"Output format '{output_format}' not supported for category '{category}'",
        )

    # Create job directories
    job_id = str(uuid.uuid4())
    input_dir = Path(settings.TEMP_DIR) / job_id / "input"
    output_dir = Path(settings.TEMP_DIR) / job_id / "output"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Stream uploaded file to disk, enforcing size limit
    input_path = input_dir / _sanitize_filename(file.filename)
    try:
        bytes_written = 0
        with open(input_path, "wb") as out_f:
            while chunk := await file.read(65536):
                bytes_written += len(chunk)
                if bytes_written > settings.MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE // 1_048_576} MB.",
                    )
                out_f.write(chunk)
    except HTTPException:
        shutil.rmtree(Path(settings.TEMP_DIR) / job_id, ignore_errors=True)
        raise

    # Register job
    job: dict[str, Any] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "error": None,
        "input_files": [file.filename],
        "output_files": [],
        "created_at": datetime.now().isoformat(),
        "created_at_ts": datetime.now().timestamp(),
        "category": category,
        "output_format": output_format,
        "options": opts,
    }
    await job_store.set(job_id, job)

    # Start conversion in background with rate limiting
    asyncio.create_task(
        _run_conversion_with_semaphore(
            sem, job_id, input_path, output_dir, category, output_format, opts
        )
    )

    return ConvertResponse(job_id=job_id)


async def _run_conversion_with_semaphore(
    sem: asyncio.Semaphore,
    job_id: str,
    input_path: Path,
    output_dir: Path,
    category: str,
    output_format: str,
    options: dict,
) -> None:
    async with _global_semaphore:
        async with sem:
            await _run_conversion(job_id, input_path, output_dir, category, output_format, options)


async def _run_conversion(
    job_id: str,
    input_path: Path,
    output_dir: Path,
    category: str,
    output_format: str,
    options: dict,
) -> None:
    """Background task that runs the actual conversion."""
    job = await job_store.get(job_id)
    if not job:
        return

    job["status"] = "processing"
    job["progress"] = 10
    await job_store.set(job_id, job)

    # Progress callback: updates job dict and persists to store
    async def on_progress(pct: int) -> None:
        job["progress"] = pct
        await job_store.set(job_id, job)

    try:
        converter = CONVERTERS.get(category)
        if not converter:
            raise ValueError(f"No converter for category: {category}")

        output_path = await converter.convert(
            input_path, output_format, options, on_progress
        )

        # Move output to job output dir if not already there
        if output_path.parent != output_dir:
            dest = output_dir / output_path.name
            output_path.rename(dest)
            output_path = dest

        # Collect all output files (some conversions produce multiple files)
        output_files = [f.name for f in output_dir.iterdir() if f.is_file()]
        if not output_files:
            output_files = [output_path.name]

        job["status"] = "completed"
        job["progress"] = 100
        job["output_files"] = output_files
        await job_store.set(job_id, job)
        logger.info(f"Job {job_id} completed: {output_files}")

    except NotImplementedError as e:
        job["status"] = "failed"
        job["error"] = str(e)
        await job_store.set(job_id, job)
        logger.warning(f"Job {job_id} failed: {e}")

    except Exception as e:
        job["status"] = "failed"
        job["error"] = "Conversion failed. Please try again."
        await job_store.set(job_id, job)
        logger.error(f"Job {job_id} failed with error: {e}")


@app.get("/api/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Poll conversion progress."""
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        error=job["error"],
        output_files=job.get("output_files", []),
    )


@app.get("/api/download/{job_id}")
async def download_file(job_id: str):
    """Download converted file."""
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed yet")

    output_dir = Path(settings.TEMP_DIR) / job_id / "output"
    output_files = job.get("output_files", [])
    if not output_files:
        raise HTTPException(status_code=404, detail="No output files found")

    file_path = output_dir / output_files[0]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=output_files[0],
        media_type="application/octet-stream",
    )


@app.get("/api/download/{job_id}/zip")
async def download_zip(job_id: str):
    """Download all converted files as ZIP."""
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job is not completed yet")

    output_dir = Path(settings.TEMP_DIR) / job_id / "output"
    output_files = job.get("output_files", [])
    if not output_files:
        raise HTTPException(status_code=404, detail="No output files found")

    zip_path = create_zip(output_dir, output_files)

    return FileResponse(
        path=str(zip_path),
        filename="converted_files.zip",
        media_type="application/zip",
    )


@app.delete("/api/job/{job_id}")
async def delete_job(job_id: str):
    """Clean up job files."""
    job = await job_store.delete(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_dir = Path(settings.TEMP_DIR) / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)

    return {"detail": "Job deleted"}
