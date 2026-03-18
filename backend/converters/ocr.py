from pathlib import Path

from loguru import logger

from converters.base import BaseConverter, ProgressCallback

try:
    import pytesseract
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

try:
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False


class OcrConverter(BaseConverter):
    async def convert(
        self,
        input_path: Path,
        output_format: str,
        options: dict,
        on_progress: ProgressCallback | None = None,
    ) -> Path:
        if not HAS_TESSERACT:
            raise RuntimeError("pytesseract is not installed")

        ext = input_path.suffix.lower().lstrip(".")
        output_dir = input_path.parent.parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        stem = input_path.stem
        output_path = output_dir / f"{stem}.{output_format}"

        languages = options.get("ocrLanguages", ["eng"])
        lang_str = "+".join(languages)

        if on_progress:
            await on_progress(10)

        # Get images for OCR
        images = self._get_images(input_path, ext)
        n_pages = len(images)

        if on_progress:
            await on_progress(20)

        if output_format == "pdf":
            result = self._to_searchable_pdf(images, output_path, lang_str)
            if on_progress:
                await on_progress(95)
            return result

        # Extract text from all pages, reporting per-page progress
        all_text = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img, lang=lang_str)
            all_text.append(text.strip())
            if on_progress:
                pct = 20 + int(70 * (i + 1) / n_pages)
                await on_progress(pct)

        full_text = "\n\n".join(all_text)

        if output_format == "txt":
            output_path.write_text(full_text, encoding="utf-8")

        elif output_format == "md":
            lines = []
            for line in full_text.split("\n"):
                stripped = line.strip()
                if stripped and len(stripped) < 80 and stripped.isupper():
                    lines.append(f"## {stripped.title()}")
                else:
                    lines.append(line)
            output_path.write_text("\n".join(lines), encoding="utf-8")

        elif output_format == "html":
            paragraphs = full_text.split("\n\n")
            html_parts = [
                f"<p>{_escape_html(p.strip())}</p>"
                for p in paragraphs if p.strip()
            ]
            html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{stem} (OCR)</title></head>
<body>{"".join(html_parts)}</body></html>"""
            output_path.write_text(html, encoding="utf-8")

        elif output_format == "docx":
            self._to_docx(full_text, output_path)

        else:
            raise ValueError(f"Unsupported OCR output format: {output_format}")

        if on_progress:
            await on_progress(95)

        logger.info(f"OCR completed: {input_path.name} → {output_path.name}")
        return output_path

    def _get_images(self, input_path: Path, ext: str) -> list:
        """Convert input to list of PIL Images for OCR."""
        if ext == "pdf":
            if not HAS_PDF2IMAGE:
                raise RuntimeError("pdf2image is required for PDF OCR")
            return convert_from_path(str(input_path), dpi=300)

        from PIL import Image
        return [Image.open(str(input_path))]

    def _to_searchable_pdf(self, images: list, output_path: Path, lang: str) -> Path:
        """Create a searchable PDF using Tesseract's PDF output."""
        pdf_pages = []
        for img in images:
            pdf_bytes = pytesseract.image_to_pdf_or_hocr(img, lang=lang, extension="pdf")
            pdf_pages.append(pdf_bytes)

        if len(pdf_pages) == 1:
            output_path.write_bytes(pdf_pages[0])
        else:
            try:
                from pypdf import PdfMerger
                merger = PdfMerger()
                for i, page_bytes in enumerate(pdf_pages):
                    tmp = output_path.parent / f"_ocr_page_{i}.pdf"
                    tmp.write_bytes(page_bytes)
                    merger.append(str(tmp))
                merger.write(str(output_path))
                merger.close()
                for f in output_path.parent.glob("_ocr_page_*.pdf"):
                    f.unlink()
            except ImportError:
                output_path.write_bytes(pdf_pages[0])

        logger.info(f"Searchable PDF created: {output_path.name}")
        return output_path

    def _to_docx(self, text: str, output_path: Path) -> None:
        """Create a DOCX document from OCR text."""
        from docx import Document

        doc = Document()
        for paragraph in text.split("\n\n"):
            stripped = paragraph.strip()
            if stripped:
                doc.add_paragraph(stripped)

        doc.save(str(output_path))


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
