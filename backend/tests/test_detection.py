"""
utils/detection.py tests

Tests marked [MOBILE BUG] expose failures in the extension-based file
identification logic that break common mobile workflows.

All tests are async — pytest-asyncio handles them via asyncio_mode=auto.
`magic` is stubbed at the sys.modules level in conftest.py so that this file
imports cleanly even without the libmagic system library installed locally.
"""

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.detection import detect_file


# ── MOBILE BUGS (intentionally failing until fixed) ───────────────────────────


@pytest.mark.asyncio
async def test_detect_file_with_no_extension_returns_null_category(tmp_path):
    """
    [MOBILE BUG #10] Files without extensions arrive with category=None and no outputs.

    WHY THIS MATTERS:
    iOS AirDrop and Android share sheet can send files without a file extension.
    detect_file() derives `category` and `format` solely from the extension.
    When the extension is absent the function returns category=None and
    available_outputs=[], so the user cannot select any output format.

    EXPECTED FIX: when `ext` is empty, fall back to the MIME type returned by
    `magic.from_file()` to determine both `format` and `category`.

    This test asserts the DESIRED post-fix behaviour; the final assertion currently FAILS.
    """
    fake_file = tmp_path / "photo"  # no extension
    fake_file.write_bytes(b"\xff\xd8\xff\xe0")  # JPEG magic bytes

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "image/jpeg"
        result = await detect_file(str(fake_file), "photo")

    # Correct behaviour:
    assert result["category"] == "image"
    assert result["format"] == "jpg"
    assert len(result["available_outputs"]) > 0


@pytest.mark.asyncio
async def test_detect_heic_bytes_under_jpg_extension_causes_format_mismatch(tmp_path):
    """
    [MOBILE BUG #11] HEIC file sent with .jpg extension: format/MIME mismatch.

    WHY THIS MATTERS:
    iPhones store photos in HEIC. When a user selects such a photo in a mobile
    browser, the browser may report the filename as "IMG_1234.jpg". The backend's
    magic bytes check correctly identifies the MIME as "image/heic", but
    detect_file() returns format="jpg" (from the extension). The converter then
    receives a mismatched label, which can cause silent conversion failures for
    converters that trust the format label.

    EXPECTED FIX: when the magic MIME type doesn't match the extension's expected
    MIME, use the magic-derived format instead (or set is_ambiguous=True).

    The final assertion currently FAILS because format="jpg" != "heic".
    """
    fake_file = tmp_path / "IMG_1234.jpg"
    fake_file.write_bytes(b"\x00\x00\x00\x1cftypheic")  # HEIC magic signature

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "image/heic"
        result = await detect_file(str(fake_file), "IMG_1234.jpg")

    assert result["mime_type"] == "image/heic"  # Correct: magic bytes
    assert result["format"] == "heic"            # Correct: content-based override
    assert result["category"] == "image"        # Correct: content-based


@pytest.mark.asyncio
async def test_detect_file_no_extension_handles_gracefully(tmp_path):
    """
    [MOBILE BUG #12] Empty filename stub — detect_file itself does not crash.

    The /api/detect endpoint guard (`if not file.filename`) is tested separately
    in test_api.py. This test verifies that detect_file() itself degrades
    gracefully when given an empty extension rather than raising an exception.
    """
    fake_file = tmp_path / "upload"
    fake_file.write_bytes(b"\xff\xd8\xff")

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "image/jpeg"
        result = await detect_file(str(fake_file), "")

    # Correct behaviour:
    assert result["format"] == "jpg"
    assert result["category"] == "image"


# ── WORKING BEHAVIOUR ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_detect_jpeg_by_extension(tmp_path):
    fake_file = tmp_path / "photo.jpg"
    fake_file.write_bytes(b"\xff\xd8\xff")

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "image/jpeg"
        result = await detect_file(str(fake_file), "photo.jpg")

    assert result["category"] == "image"
    assert result["format"] == "jpg"
    assert result["mime_type"] == "image/jpeg"
    assert result["is_ambiguous"] is False
    assert len(result["available_outputs"]) > 0


@pytest.mark.asyncio
async def test_detect_png_by_extension(tmp_path):
    fake_file = tmp_path / "diagram.png"
    fake_file.write_bytes(b"\x89PNG")

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "image/png"
        result = await detect_file(str(fake_file), "diagram.png")

    assert result["category"] == "image"
    assert result["format"] == "png"
    assert result["is_ambiguous"] is False


@pytest.mark.asyncio
async def test_detect_pdf_returns_ambiguous_with_multiple_categories(tmp_path):
    fake_file = tmp_path / "document.pdf"
    fake_file.write_bytes(b"%PDF-1.4")

    with (
        patch("utils.detection.magic") as mock_magic,
        patch("utils.detection.check_pdf_is_scanned", new=AsyncMock(return_value=False)),
    ):
        mock_magic.from_file.return_value = "application/pdf"
        result = await detect_file(str(fake_file), "document.pdf")

    assert result["is_ambiguous"] is True
    assert result["category"] in ("document", "ocr")
    assert set(result["available_categories"]) >= {"document", "ocr", "presentation"}


@pytest.mark.asyncio
async def test_detect_scanned_pdf_defaults_to_ocr_category(tmp_path):
    fake_file = tmp_path / "scan.pdf"
    fake_file.write_bytes(b"%PDF-1.4")

    with (
        patch("utils.detection.magic") as mock_magic,
        patch("utils.detection.check_pdf_is_scanned", new=AsyncMock(return_value=True)),
    ):
        mock_magic.from_file.return_value = "application/pdf"
        result = await detect_file(str(fake_file), "scan.pdf")

    assert result["category"] == "ocr"
    assert result["is_ambiguous"] is True


@pytest.mark.asyncio
async def test_detect_heic_file_with_correct_extension(tmp_path):
    """HEIC files named correctly should be detected as image/heic."""
    fake_file = tmp_path / "burst.heic"
    fake_file.write_bytes(b"\x00\x00\x00\x1cftypheic")

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "image/heic"
        result = await detect_file(str(fake_file), "burst.heic")

    assert result["category"] == "image"
    assert result["format"] == "heic"
    assert result["mime_type"] == "image/heic"


@pytest.mark.asyncio
async def test_detect_csv_returns_data_category(tmp_path):
    fake_file = tmp_path / "data.csv"
    fake_file.write_text("name,age\nAlice,30\n")

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "text/csv"
        result = await detect_file(str(fake_file), "data.csv")

    assert result["category"] == "data"
    assert result["format"] == "csv"


@pytest.mark.asyncio
async def test_detect_unknown_extension_returns_null_category(tmp_path):
    fake_file = tmp_path / "mystery.xyz99"
    fake_file.write_bytes(b"random")

    with patch("utils.detection.magic") as mock_magic:
        mock_magic.from_file.return_value = "application/octet-stream"
        result = await detect_file(str(fake_file), "mystery.xyz99")

    assert result["category"] is None
    assert result["format"] == "xyz99"
    assert result["available_outputs"] == []
