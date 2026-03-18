FORMAT_MAP: dict = {
    "audio": {
        "inputs": ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus", "aiff"],
        "outputs": ["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus"],
        "options": ["quality"],
    },
    "video": {
        "inputs": ["mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "3gp"],
        "outputs": ["mp4", "mkv", "webm", "avi", "mov", "gif", "mp3"],
        "options": ["quality"],
    },
    "font": {
        "inputs": ["ttf", "otf", "woff", "woff2"],
        "outputs": ["ttf", "otf", "woff", "woff2"],
        "options": [],
    },
    "image": {
        "inputs": [
            "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp",
            "heic", "heif", "avif", "svg", "ico",
            "cr2", "nef", "arw", "jxl", "qoi",
        ],
        "outputs": [
            "jpg", "png", "gif", "bmp", "tiff", "webp",
            "heic", "avif", "ico", "jxl", "pdf", "svg",
        ],
        "options": ["quality", "resize", "strip_metadata", "background_color"],
    },
    "document": {
        "inputs": [
            "txt", "md", "html", "css", "json", "xml", "yaml", "toml",
            "csv", "tsv", "rst", "tex", "rtf", "docx", "odt", "epub",
            "log", "ini", "cfg", "env",
        ],
        "outputs": [
            "txt", "md", "html", "pdf", "docx", "odt",
            "epub", "rst", "tex", "rtf",
        ],
        "options": [
            "md_formatting", "pdf_page_size", "pdf_orientation",
            "pdf_margins", "pdf_font", "pdf_page_numbers",
        ],
    },
    "data": {
        "inputs": [
            "csv", "tsv", "xlsx", "xls", "ods", "json", "xml",
            "yaml", "toml", "parquet", "db", "sqlite",
        ],
        "outputs": [
            "csv", "tsv", "xlsx", "json", "xml", "yaml", "toml",
            "parquet", "pdf", "html", "md", "sql",
        ],
        "options": ["delimiter", "encoding", "sheet", "header_row"],
    },
    "presentation": {
        "inputs": ["pptx", "odp", "pdf"],
        "outputs": ["pdf", "png", "jpg", "pptx"],
        "options": ["dpi", "slide_selection"],
    },
    "ocr": {
        "inputs": ["pdf", "jpg", "jpeg", "png", "tiff", "bmp"],
        "outputs": ["txt", "md", "docx", "pdf", "html"],
        "options": ["language", "output_format"],
    },
}

EXTENSION_TO_CATEGORY: dict[str, str | None] = {
    # images
    "jpg": "image", "jpeg": "image", "png": "image", "gif": "image",
    "bmp": "image", "tiff": "image", "webp": "image",
    "heic": "image", "heif": "image", "avif": "image",
    "svg": "image", "ico": "image", "qoi": "image",
    "cr2": "image", "nef": "image", "arw": "image", "jxl": "image",
    # documents
    "txt": "document", "md": "document", "html": "document", "htm": "document",
    "css": "document", "rst": "document", "tex": "document", "rtf": "document",
    "docx": "document", "odt": "document", "epub": "document",
    "log": "document", "ini": "document", "cfg": "document", "env": "document",
    # data
    "csv": "data", "tsv": "data", "xlsx": "data", "xls": "data",
    "ods": "data", "json": "data", "xml": "data",
    "yaml": "data", "yml": "data", "toml": "data",
    "parquet": "data", "db": "data", "sqlite": "data",
    # presentations
    "pptx": "presentation", "odp": "presentation",
    # audio
    "mp3": "audio", "wav": "audio", "ogg": "audio", "flac": "audio",
    "aac": "audio", "m4a": "audio", "wma": "audio", "opus": "audio", "aiff": "audio",
    # video
    "mp4": "video", "mkv": "video", "avi": "video", "mov": "video",
    "webm": "video", "flv": "video", "wmv": "video", "m4v": "video", "3gp": "video",
    # fonts
    "ttf": "font", "otf": "font", "woff": "font", "woff2": "font",
    # ambiguous
    "pdf": None,
}


def get_formats() -> dict:
    return FORMAT_MAP


def get_available_outputs(category: str, input_format: str) -> list[str]:
    cat = FORMAT_MAP.get(category)
    if not cat:
        return []
    if input_format not in cat["inputs"]:
        return []
    return cat["outputs"]


def get_category_for_extension(ext: str) -> str | None:
    return EXTENSION_TO_CATEGORY.get(ext.lower())
