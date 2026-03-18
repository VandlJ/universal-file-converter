"""
Async job store backed by Redis with automatic in-memory fallback.

Redis provides:
- Durability across backend restarts
- Horizontal scaling (multiple backend instances share state)
- Automatic TTL expiry (no manual cleanup needed for Redis entries)

Falls back to an in-memory dict if Redis is unavailable or not configured.
"""

import json
from datetime import datetime
from typing import Any

from loguru import logger


class JobStore:
    def __init__(self, redis_url: str | None, ttl: int = 3600):
        self._redis_url = redis_url
        self._ttl = ttl
        self._redis = None
        self._mem: dict[str, dict[str, Any]] = {}

    async def connect(self) -> None:
        """Connect to Redis. Falls back to in-memory on failure."""
        if not self._redis_url:
            logger.info("No REDIS_URL configured — using in-memory job store")
            return
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(self._redis_url, decode_responses=True)
            await client.ping()
            self._redis = client
            logger.info(f"Connected to Redis at {self._redis_url}")
        except Exception as exc:
            logger.warning(f"Redis unavailable ({exc}) — using in-memory job store")

    async def close(self) -> None:
        if self._redis:
            await self._redis.aclose()

    @property
    def backend(self) -> str:
        return "redis" if self._redis else "memory"

    async def get(self, job_id: str) -> dict[str, Any] | None:
        if self._redis:
            raw = await self._redis.get(f"job:{job_id}")
            return json.loads(raw) if raw else None
        return self._mem.get(job_id)

    async def set(self, job_id: str, job: dict[str, Any]) -> None:
        if self._redis:
            await self._redis.setex(
                f"job:{job_id}",
                self._ttl,
                json.dumps(job, default=str),
            )
        # Always keep an in-memory copy for fast local access during conversion
        self._mem[job_id] = job

    async def delete(self, job_id: str) -> dict[str, Any] | None:
        """Delete and return the job, or None if not found."""
        job = None
        if self._redis:
            raw = await self._redis.getdel(f"job:{job_id}")
            job = json.loads(raw) if raw else None
        job = job or self._mem.pop(job_id, None)
        self._mem.pop(job_id, None)  # ensure removed from in-memory too
        return job

    async def delete_stale(self, older_than_seconds: int) -> int:
        """
        Remove stale in-memory entries older than N seconds.
        Redis handles its own TTL expiry automatically.
        Returns the number of entries removed.
        """
        if not self._mem:
            return 0
        cutoff_ts = datetime.now().timestamp() - older_than_seconds
        stale = [
            jid
            for jid, job in list(self._mem.items())
            if job.get("created_at_ts", float("inf")) < cutoff_ts
        ]
        for jid in stale:
            self._mem.pop(jid, None)
        if stale:
            logger.info(f"JobStore: pruned {len(stale)} stale in-memory entries")
        return len(stale)
