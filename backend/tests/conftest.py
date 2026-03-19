"""
Shared pytest fixtures.

Sets env-vars before any app import so pydantic-settings picks them up.
Redis is fully mocked — no real Redis required to run the test suite.
"""

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── Path & env setup (must precede any app import) ────────────────────────────

sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Stub libmagic if the system library is not installed ──────────────────────
# python-magic imports libmagic at module load time. When the system library is
# absent (e.g. local dev without `brew install libmagic`) the import raises
# ImportError before any mock can take effect. We stub the whole module so that
# test collection never fails due to a missing C library.
# On CI we install libmagic1 via apt, so the real library is used there.
try:
    import magic as _magic_check  # noqa: F401 — just verifying it loads
except (ImportError, OSError):
    sys.modules["magic"] = MagicMock()

os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("HMAC_SECRET", "test-hmac-secret-key-do-not-use-in-prod")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_store():
    """In-memory replacement for the Redis-backed JobStore."""
    store = MagicMock()
    store.backend = "mock"
    store.connect = AsyncMock()
    store.close = AsyncMock()
    store.get = AsyncMock(return_value=None)
    store.set = AsyncMock()
    store.delete = AsyncMock(return_value=None)
    return store


@pytest.fixture
def app_client(mock_store, tmp_path):
    """
    FastAPI TestClient with:
      - Redis job store replaced by a MagicMock
      - TEMP_DIR pointed at a pytest-managed tmp directory
      - Cleanup tasks patched out so they don't interfere with test isolation
    """
    temp_dir = tmp_path / "converter"
    temp_dir.mkdir()

    import main  # imported here so env-vars are already set

    with (
        patch.object(main, "job_store", mock_store),
        patch("config.settings.TEMP_DIR", str(temp_dir)),
        patch("utils.cleanup.cleanup_on_startup", new=AsyncMock()),
        patch("utils.cleanup.cleanup_scheduler", new=AsyncMock()),
    ):
        from fastapi.testclient import TestClient

        with TestClient(main.app, raise_server_exceptions=True) as client:
            yield client, mock_store, temp_dir
