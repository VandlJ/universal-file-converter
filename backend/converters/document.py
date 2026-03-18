import asyncio
from pathlib import Path

import chardet
from loguru import logger

from converters.base import BaseConverter
from converters.pdf_templates import generate_pdf_css

# Pandoc format mapping: our extension → pandoc format name
PANDOC_FORMAT_MAP = {
    "md": "markdown",
    "html": "html",
    "htm": "html",
    "txt": "plain",
    "rst": "rst",
    "tex": "latex",
    "rtf": "rtf",
    "docx": "docx",
    "odt": "odt",
    "epub": "epub",
    "css": "plain",
    "json": "plain",
    "xml": "plain",
    "yaml": "plain",
    "toml": "plain",
    "csv": "plain",
    "tsv": "plain",
    "log": "plain",
    "ini": "plain",
    "cfg": "plain",
    "env": "plain",
}

# Formats that pandoc can write
PANDOC_OUTPUT_MAP = {
    "md": "markdown",
    "html": "html",
    "txt": "plain",
    "rst": "rst",
    "tex": "latex",
    "rtf": "rtf",
    "docx": "docx",
    "odt": "odt",
    "epub": "epub",
}


async def _run_subprocess(cmd: list[str], timeout: int = 120) -> tuple[int, str]:
    """Run a subprocess asynchronously. Returns (returncode, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        _, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise RuntimeError(f"{cmd[0]} timed out after {timeout} seconds")
    return proc.returncode, stderr_bytes.decode()


async def _run_subprocess_stdout(cmd: list[str], timeout: int = 120) -> tuple[int, str, str]:
    """Run a subprocess and capture stdout. Returns (returncode, stdout, stderr)."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise RuntimeError(f"{cmd[0]} timed out after {timeout} seconds")
    return proc.returncode, stdout_bytes.decode(), stderr_bytes.decode()


class DocumentConverter(BaseConverter):
    async def convert(
        self, input_path: Path, output_format: str, options: dict
    ) -> Path:
        ext = input_path.suffix.lower().lstrip(".")
        output_dir = input_path.parent.parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        stem = input_path.stem
        output_path = output_dir / f"{stem}.{output_format}"

        # PDF output: convert to HTML first, then WeasyPrint
        if output_format == "pdf":
            return await self._to_pdf(input_path, output_path, ext, options)

        # Markdown formatting toggle
        md_formatting = options.get("mdFormatting", "interpret")

        # If input is a plain text/config file, handle simply
        if ext in ("txt", "log", "ini", "cfg", "env", "css", "json", "xml", "yaml", "toml", "csv", "tsv"):
            return await self._convert_plain(input_path, output_path, ext, output_format, options)

        # Use pandoc for rich format conversions
        return await self._convert_with_pandoc(
            input_path, output_path, ext, output_format, md_formatting
        )

    async def _convert_with_pandoc(
        self,
        input_path: Path,
        output_path: Path,
        input_ext: str,
        output_format: str,
        md_formatting: str,
    ) -> Path:
        input_fmt = PANDOC_FORMAT_MAP.get(input_ext, "plain")
        output_fmt = PANDOC_OUTPUT_MAP.get(output_format)

        if not output_fmt:
            raise ValueError(f"Pandoc cannot produce format: {output_format}")

        # If MD formatting should be literal, wrap in code block
        if md_formatting == "literal" and input_ext == "md":
            input_fmt = "plain"

        cmd = [
            "pandoc",
            str(input_path),
            "-f", input_fmt,
            "-t", output_fmt,
            "-o", str(output_path),
            "--standalone",
        ]

        returncode, stderr = await _run_subprocess(cmd, timeout=120)

        if returncode != 0:
            logger.error(f"Pandoc error: {stderr}")
            raise RuntimeError(f"Pandoc conversion failed: {stderr[:500]}")

        logger.info(f"Document converted: {input_path.name} → {output_path.name}")
        return output_path

    async def _to_pdf(
        self, input_path: Path, output_path: Path, ext: str, options: dict
    ) -> Path:
        """Convert to PDF via HTML intermediate + WeasyPrint."""
        from weasyprint import HTML, CSS

        md_formatting = options.get("mdFormatting", "interpret")

        # Step 1: Convert to HTML using pandoc (or read directly if HTML)
        if ext == "html" or ext == "htm":
            html_content = self._read_file(input_path)
        elif ext in ("txt", "log", "ini", "cfg", "env", "css", "json", "xml", "yaml", "toml", "csv", "tsv"):
            # Plain text: wrap in <pre> tag
            text_content = self._read_file(input_path)
            html_content = f"<html><body><pre>{_escape_html(text_content)}</pre></body></html>"
        else:
            # Use pandoc to produce HTML
            input_fmt = PANDOC_FORMAT_MAP.get(ext, "plain")
            if md_formatting == "literal" and ext == "md":
                input_fmt = "plain"

            returncode, stdout, stderr = await _run_subprocess_stdout(
                ["pandoc", str(input_path), "-f", input_fmt, "-t", "html", "--standalone"],
                timeout=120,
            )
            if returncode != 0:
                raise RuntimeError(f"Pandoc HTML conversion failed: {stderr[:500]}")
            html_content = stdout

        # Step 2: Generate PDF CSS from options
        css_string = generate_pdf_css(options)

        # Step 3: Render with WeasyPrint
        html_doc = HTML(string=html_content)
        css_doc = CSS(string=css_string)
        html_doc.write_pdf(str(output_path), stylesheets=[css_doc])

        logger.info(f"PDF generated: {input_path.name} → {output_path.name}")
        return output_path

    async def _convert_plain(
        self,
        input_path: Path,
        output_path: Path,
        input_ext: str,
        output_format: str,
        options: dict,
    ) -> Path:
        """Handle plain text and config file conversions."""
        content = self._read_file(input_path)

        if output_format == "txt":
            output_path.write_text(content, encoding="utf-8")
        elif output_format == "md":
            # Wrap in code block
            output_path.write_text(f"```{input_ext}\n{content}\n```\n", encoding="utf-8")
        elif output_format == "html":
            html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>{input_path.stem}</title></head><body><pre>{_escape_html(content)}</pre></body></html>"
            output_path.write_text(html, encoding="utf-8")
        else:
            # Fallback: try pandoc
            return await self._convert_with_pandoc(
                input_path, output_path, input_ext, output_format, "interpret"
            )

        logger.info(f"Plain text converted: {input_path.name} → {output_path.name}")
        return output_path

    def _read_file(self, path: Path) -> str:
        """Read file with encoding detection."""
        raw = path.read_bytes()
        detected = chardet.detect(raw)
        encoding = detected.get("encoding", "utf-8") or "utf-8"
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            return raw.decode("utf-8", errors="replace")

    def supported_input_formats(self) -> list[str]:
        return [
            "txt", "md", "html", "css", "json", "xml", "yaml", "toml",
            "csv", "tsv", "rst", "tex", "rtf", "docx", "odt", "epub",
            "log", "ini", "cfg", "env",
        ]

    def supported_output_formats(self) -> list[str]:
        return [
            "txt", "md", "html", "pdf", "docx", "odt",
            "epub", "rst", "tex", "rtf",
        ]


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
