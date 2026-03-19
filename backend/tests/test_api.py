"""
FastAPI endpoint tests (main.py)

Tests marked [MOBILE BUG] expose endpoint-level failures specific to mobile
file upload scenarios. All tests use a TestClient with a mocked job store —
no real Redis or filesystem conversion takes place.
"""

import hashlib
import hmac
import os
import sys
from io import BytesIO
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))

HMAC_SECRET = os.environ.get("HMAC_SECRET", "test-hmac-secret-key-do-not-use-in-prod")


# ── Helpers ───────────────────────────────────────────────────────────────────


def sign_job_id(job_id: str) -> str:
    mac = hmac.new(
        HMAC_SECRET.encode(), job_id.encode(), hashlib.sha256
    ).hexdigest()[:16]
    return f"{job_id}.{mac}"


def make_jpeg() -> bytes:
    return b"\xff\xd8\xff\xe0" + b"\x00" * 100  # minimal JPEG-like header


def make_upload(filename: str, content: bytes = b"data", mime: str = "image/jpeg"):
    return ("file", (filename, BytesIO(content), mime))


# ── Health ────────────────────────────────────────────────────────────────────


class TestHealth:
    def test_health_returns_ok(self, app_client):
        client, *_ = app_client
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ── Formats ───────────────────────────────────────────────────────────────────


class TestFormats:
    def test_formats_returns_registry(self, app_client):
        client, *_ = app_client
        r = client.get("/api/formats")
        assert r.status_code == 200
        body = r.json()
        assert "image" in body
        assert "inputs" in body["image"]
        assert "outputs" in body["image"]


# ── /api/detect ───────────────────────────────────────────────────────────────


class TestDetect:

    # ── MOBILE BUGS ───────────────────────────────────────────────────────────

    def test_detect_empty_filename_handled_gracefully(self, app_client):
        """
        [FIXED #13] Empty filename from mobile is now handled by providing a default.
        """
        client, *_ = app_client
        # Mock detection result for the default filename generated on backend
        detection = {
            "category": "image",
            "format": "jpg",
            "mime_type": "image/jpeg",
            "is_ambiguous": False,
            "available_outputs": ["png", "webp"],
            "available_categories": None,
        }
        with patch("main.detect_file", new=AsyncMock(return_value=detection)):
            r = client.post(
                "/api/detect",
                files=[("file", ("", BytesIO(make_jpeg()), "image/jpeg"))],
            )
        # Should now be 200
        assert r.status_code == 200
        assert r.json()["category"] == "image"

    def test_detect_no_extension_file_returns_null_category(self, app_client, tmp_path):
        """
        [MOBILE BUG #14] File without extension produces null category and no outputs.

        WHY THIS MATTERS:
        Mobile sharing flows (AirDrop, Android share sheet) can produce files
        without extensions. The backend returns category=null and
        available_outputs=[], leaving the user unable to pick a conversion target.

        EXPECTED FIX: fall back to MIME type (from magic bytes) to infer category.
        """
        client, *_ = app_client

        with patch("main.detect_file") as mock_detect:
            mock_detect.return_value = {
                "category": None,
                "format": "",
                "mime_type": "image/jpeg",
                "is_ambiguous": False,
                "available_outputs": [],
                "available_categories": None,
            }
            r = client.post(
                "/api/detect",
                files=[make_upload("photo", make_jpeg(), "image/jpeg")],
            )

        assert r.status_code == 200
        body = r.json()
        # Documents the current broken state — null category, empty outputs:
        assert body["category"] is None
        assert body["available_outputs"] == []
        # After fix: assert body["category"] == "image" and len(body["available_outputs"]) > 0

    # ── WORKING BEHAVIOUR ─────────────────────────────────────────────────────

    def test_detect_jpeg_returns_image_category(self, app_client):
        client, *_ = app_client

        detection = {
            "category": "image",
            "format": "jpg",
            "mime_type": "image/jpeg",
            "is_ambiguous": False,
            "available_outputs": ["png", "webp", "gif"],
            "available_categories": None,
        }
        with patch("main.detect_file", new=AsyncMock(return_value=detection)):
            r = client.post(
                "/api/detect",
                files=[make_upload("photo.jpg", make_jpeg())],
            )

        assert r.status_code == 200
        body = r.json()
        assert body["category"] == "image"
        assert body["format"] == "jpg"
        assert "png" in body["available_outputs"]

    def test_detect_enforces_file_size_limit(self, app_client):
        client, *_ = app_client
        # Override MAX_FILE_SIZE to a tiny value for this test
        with patch("config.settings.MAX_FILE_SIZE", 10):
            r = client.post(
                "/api/detect",
                files=[make_upload("big.jpg", b"x" * 20)],
            )
        assert r.status_code == 413

    def test_detect_missing_file_field_returns_422(self, app_client):
        client, *_ = app_client
        r = client.post("/api/detect")
        assert r.status_code == 422


# ── /api/convert ──────────────────────────────────────────────────────────────


class TestConvert:

    # ── MOBILE BUGS ───────────────────────────────────────────────────────────

    def test_convert_empty_filename_handled_gracefully(self, app_client):
        """
        [FIXED #15] Conversion endpoint also accepts empty filename.
        """
        client, mock_store, _ = app_client
        mock_store.set = AsyncMock()

        r = client.post(
            "/api/convert",
            files=[("file", ("", BytesIO(make_jpeg()), "image/jpeg"))],
            data={"output_format": "png", "category": "image", "options": "{}"},
        )
        assert r.status_code == 200
        assert "job_id" in r.json()

    def test_convert_heic_file_with_jpg_extension_accepted(self, app_client):
        """
        [MOBILE BUG #16] HEIC bytes under .jpg extension: conversion is accepted
        but may fail silently in the background worker.

        The endpoint itself returns 200 (job accepted). The actual failure
        happens asynchronously in the background task. This test verifies the
        endpoint doesn't pre-validate the content — but also means there is no
        early warning for the user about the format mismatch.
        """
        client, mock_store, _ = app_client
        mock_store.set = AsyncMock()
        mock_store.get = AsyncMock(return_value=None)

        heic_bytes = b"\x00\x00\x00\x1cftypheic" + b"\x00" * 50
        r = client.post(
            "/api/convert",
            files=[make_upload("IMG_1234.jpg", heic_bytes, "image/jpeg")],
            data={"output_format": "png", "category": "image", "options": "{}"},
        )
        # The endpoint accepts the job (no pre-validation of content vs. extension)
        assert r.status_code == 200
        assert "job_id" in r.json()
        # After fix: endpoint should flag the mismatch or the job should fail fast
        # with a user-facing message rather than silently producing a corrupt output.

    # ── WORKING BEHAVIOUR ─────────────────────────────────────────────────────

    def test_convert_returns_signed_job_id(self, app_client):
        client, mock_store, _ = app_client
        mock_store.set = AsyncMock()

        r = client.post(
            "/api/convert",
            files=[make_upload("photo.jpg", make_jpeg())],
            data={"output_format": "png", "category": "image", "options": "{}"},
        )
        assert r.status_code == 200
        job_id = r.json()["job_id"]
        # Signed token has format "{uuid}.{hmac16}"
        assert "." in job_id
        parts = job_id.rsplit(".", 1)
        assert len(parts[1]) == 16

    def test_convert_invalid_category_returns_400(self, app_client):
        client, *_ = app_client
        r = client.post(
            "/api/convert",
            files=[make_upload("photo.jpg", make_jpeg())],
            data={"output_format": "png", "category": "nonexistent", "options": "{}"},
        )
        assert r.status_code == 400
        assert "category" in r.json()["detail"].lower()

    def test_convert_invalid_output_format_returns_400(self, app_client):
        client, *_ = app_client
        r = client.post(
            "/api/convert",
            files=[make_upload("photo.jpg", make_jpeg())],
            data={"output_format": "xyz_unknown", "category": "image", "options": "{}"},
        )
        assert r.status_code == 400

    def test_convert_invalid_options_json_returns_400(self, app_client):
        client, *_ = app_client
        r = client.post(
            "/api/convert",
            files=[make_upload("photo.jpg", make_jpeg())],
            data={"output_format": "png", "category": "image", "options": "not-json"},
        )
        assert r.status_code == 400

    def test_convert_enforces_size_limit(self, app_client):
        client, *_ = app_client
        with patch("config.settings.MAX_FILE_SIZE", 10):
            r = client.post(
                "/api/convert",
                files=[make_upload("big.jpg", b"x" * 20)],
                data={"output_format": "png", "category": "image", "options": "{}"},
            )
        assert r.status_code == 413


# ── /api/status ───────────────────────────────────────────────────────────────


class TestStatus:
    def test_status_with_tampered_token_returns_403(self, app_client):
        client, *_ = app_client
        r = client.get("/api/status/fake-job-id.badhmacsig")
        assert r.status_code == 403

    def test_status_with_missing_token_dot_returns_403(self, app_client):
        client, *_ = app_client
        r = client.get("/api/status/nodotatall")
        assert r.status_code == 403

    def test_status_for_unknown_job_returns_404(self, app_client):
        client, mock_store, _ = app_client
        import uuid
        job_id = str(uuid.uuid4())
        signed = sign_job_id(job_id)
        mock_store.get = AsyncMock(return_value=None)

        r = client.get(f"/api/status/{signed}")
        assert r.status_code == 404

    def test_status_returns_job_progress(self, app_client):
        client, mock_store, _ = app_client
        import uuid
        job_id = str(uuid.uuid4())
        signed = sign_job_id(job_id)

        mock_store.get = AsyncMock(return_value={
            "job_id": job_id,
            "status": "processing",
            "progress": 42,
            "error": None,
            "output_files": [],
        })

        r = client.get(f"/api/status/{signed}")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "processing"
        assert body["progress"] == 42


# ── /api/fetch-url ────────────────────────────────────────────────────────────


def _httpx_cm(get_side_effect=None, get_return=None):
    """
    Build a mock for `async with httpx.AsyncClient(...) as c: await c.get(url)`.

    httpx.AsyncClient is used as an async context manager. We need __aenter__
    to be an AsyncMock so that `await cm.__aenter__()` works inside the endpoint.
    """
    import httpx  # noqa: F401 — ensure httpx types are available

    inner = AsyncMock()
    if get_return is not None:
        inner.get = AsyncMock(return_value=get_return)
    elif get_side_effect is not None:
        inner.get = AsyncMock(side_effect=get_side_effect)

    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=inner)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


class TestFetchUrl:
    def test_fetch_url_forwards_remote_content(self, app_client):
        client, *_ = app_client

        import httpx
        url = "https://example.com/report.pdf"
        mock_response = httpx.Response(
            200,
            content=b"%PDF-1.4",
            headers={"content-type": "application/pdf"},
            request=httpx.Request("GET", url),  # required for raise_for_status()
        )
        with patch("main.httpx.AsyncClient", return_value=_httpx_cm(get_return=mock_response)):
            r = client.post("/api/fetch-url", data={"url": url})

        assert r.status_code == 200
        assert "report.pdf" in r.headers["content-disposition"]
        assert r.content == b"%PDF-1.4"

    def test_fetch_url_sanitizes_filename(self, app_client):
        client, *_ = app_client

        import httpx
        url = "https://cdn.example.com/../../etc/passwd"
        mock_response = httpx.Response(
            200,
            content=b"data",
            headers={"content-type": "text/plain"},
            request=httpx.Request("GET", url),
        )
        with patch("main.httpx.AsyncClient", return_value=_httpx_cm(get_return=mock_response)):
            r = client.post("/api/fetch-url", data={"url": url})

        assert r.status_code == 200
        # Filename must not contain path traversal characters
        disposition = r.headers.get("content-disposition", "")
        assert ".." not in disposition
        assert "/" not in disposition

    def test_fetch_url_rejects_oversized_remote_file(self, app_client):
        client, *_ = app_client

        import httpx
        url = "https://example.com/huge.bin"
        mock_response = httpx.Response(
            200,
            content=b"x" * 20,
            headers={"content-type": "application/octet-stream"},
            request=httpx.Request("GET", url),
        )
        with (
            patch("main.httpx.AsyncClient", return_value=_httpx_cm(get_return=mock_response)),
            patch("config.settings.MAX_FILE_SIZE", 10),
        ):
            r = client.post("/api/fetch-url", data={"url": url})

        assert r.status_code == 413

    def test_fetch_url_propagates_http_error_from_remote(self, app_client):
        client, *_ = app_client

        import httpx
        err = httpx.HTTPStatusError(
            "404",
            request=httpx.Request("GET", "https://example.com/missing.pdf"),
            response=httpx.Response(404),
        )
        with patch("main.httpx.AsyncClient", return_value=_httpx_cm(get_side_effect=err)):
            r = client.post(
                "/api/fetch-url",
                data={"url": "https://example.com/missing.pdf"},
            )

        assert r.status_code == 400
        assert "404" in r.json()["detail"]


# ── /api/batch-download ───────────────────────────────────────────────────────


class TestBatchDownload:
    def test_batch_download_skips_invalid_tokens(self, app_client):
        """Invalid/tampered job IDs in a batch are silently skipped (no 403 for the whole request)."""
        client, mock_store, _ = app_client
        mock_store.get = AsyncMock(return_value=None)

        r = client.post(
            "/api/batch-download",
            json={"job_ids": ["tampered.badhmacsig", "also-bad.000000000000"]},
        )
        # The endpoint continues and returns an (empty) ZIP rather than 403
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"
