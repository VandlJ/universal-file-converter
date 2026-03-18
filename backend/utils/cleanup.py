import asyncio
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from loguru import logger


async def cleanup_old_jobs(
    temp_dir: str, max_age_seconds: int, jobs: dict[str, Any] | None = None
) -> int:
    """Delete job directories older than max_age_seconds. Returns count deleted."""
    temp_path = Path(temp_dir)
    if not temp_path.exists():
        return 0

    count = 0
    cutoff = datetime.now() - timedelta(seconds=max_age_seconds)

    for job_dir in temp_path.iterdir():
        if job_dir.is_dir():
            mtime = datetime.fromtimestamp(job_dir.stat().st_mtime)
            if mtime < cutoff:
                shutil.rmtree(job_dir, ignore_errors=True)
                if jobs is not None and job_dir.name in jobs:
                    del jobs[job_dir.name]
                count += 1
                logger.info(f"Cleaned up old job: {job_dir.name}")

    return count


async def cleanup_on_startup(temp_dir: str) -> None:
    """Delete all leftover temp directories on startup."""
    temp_path = Path(temp_dir)
    if temp_path.exists():
        shutil.rmtree(temp_path, ignore_errors=True)
        logger.info("Cleaned up leftover temp directories on startup")
    temp_path.mkdir(parents=True, exist_ok=True)


async def cleanup_scheduler(
    temp_dir: str, interval: int, max_age: int, jobs: dict[str, Any] | None = None
) -> None:
    """Run cleanup periodically."""
    while True:
        await asyncio.sleep(interval)
        count = await cleanup_old_jobs(temp_dir, max_age, jobs)
        if count > 0:
            logger.info(f"Cleanup: removed {count} expired jobs")
