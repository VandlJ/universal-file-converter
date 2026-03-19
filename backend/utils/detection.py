import asyncio

import magic

from format_registry import EXTENSION_TO_CATEGORY, FORMAT_MAP
from utils.mime_map import get_category_from_mime, get_format_from_mime


async def check_pdf_is_scanned(filepath: str) -> bool:
    """Check if a PDF is scanned (image-based) by trying to extract text."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "pdftotext", filepath, "-",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            return False
        text = stdout_bytes.decode().strip()
        # If very little text extracted, likely scanned
        return len(text) < 50
    except FileNotFoundError:
        return False


async def detect_file(filepath: str, filename: str) -> dict:
    """Detect file type using extension and magic bytes.

    Returns dict with category, format, mime_type, is_ambiguous,
    available_outputs, and optionally available_categories.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    mime = magic.from_file(filepath, mime=True)

    # Content-based inference
    magic_format = get_format_from_mime(mime)
    magic_category = get_category_from_mime(mime)

    # PDF is ambiguous: could be document, presentation source, or OCR target
    if mime == "application/pdf" or ext == "pdf":
        is_scanned = await check_pdf_is_scanned(filepath)
        default_category = "ocr" if is_scanned else "document"
        return {
            "category": default_category,
            "format": "pdf",
            "mime_type": mime,
            "is_ambiguous": True,
            "available_outputs": FORMAT_MAP[default_category]["outputs"],
            "available_categories": ["document", "presentation", "ocr"],
        }

    category = EXTENSION_TO_CATEGORY.get(ext)

    # Resolution: prefer content (magic) over extension if they mismatch significantly
    # or if the extension is missing.
    final_format = ext
    final_category = category

    if not ext or (magic_format and magic_format != ext and magic_category):
        # Mismatch or missing extension: prefer content detection
        if magic_format:
            final_format = magic_format
        if magic_category:
            final_category = magic_category

    available_outputs = []
    if final_category and final_category in FORMAT_MAP:
        available_outputs = FORMAT_MAP[final_category]["outputs"]

    return {
        "category": final_category,
        "format": final_format,
        "mime_type": mime,
        "is_ambiguous": False,
        "available_outputs": available_outputs,
        "available_categories": None,
    }
