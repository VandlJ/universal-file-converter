MIME_TO_FORMAT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/x-icon": "ico",
    "application/pdf": "pdf",
    "text/csv": "csv",
    "text/tab-separated-values": "tsv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.oasis.opendocument.text": "odt",
    "application/epub+zip": "epub",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.oasis.opendocument.spreadsheet": "ods",
    "application/json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/x-yaml": "yaml",
    "text/yaml": "yaml",
    "application/toml": "toml",
    "application/x-parquet": "parquet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.oasis.opendocument.presentation": "odp",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "video/mp4": "mp4",
    "video/x-matroska": "mkv",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "font/ttf": "ttf",
    "font/otf": "otf",
    "font/woff": "woff",
    "font/woff2": "woff2",
}

MIME_TO_CATEGORY = {
    "image/": "image",
    "audio/": "audio",
    "video/": "video",
    "font/": "font",
    "application/pdf": None,  # ambiguous
    "text/csv": "data",
    "text/tab-separated-values": "data",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "data",
    "application/vnd.ms-excel": "data",
    "application/vnd.oasis.opendocument.spreadsheet": "data",
    "application/x-parquet": "data",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
    "application/vnd.oasis.opendocument.text": "document",
    "application/epub+zip": "document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "presentation",
    "application/vnd.oasis.opendocument.presentation": "presentation",
}


def get_format_from_mime(mime: str) -> str | None:
    return MIME_TO_FORMAT.get(mime)


def get_category_from_mime(mime: str) -> str | None:
    # Try exact match first
    if mime in MIME_TO_CATEGORY:
        return MIME_TO_CATEGORY[mime]
    # Try prefix match (e.g., image/)
    for prefix, cat in MIME_TO_CATEGORY.items():
        if prefix.endswith("/") and mime.startswith(prefix):
            return cat
    return None
