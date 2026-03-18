"""Generate CSS for WeasyPrint PDF rendering based on conversion options."""

PAGE_SIZES = {
    "A4": "210mm 297mm",
    "A3": "297mm 420mm",
    "Letter": "8.5in 11in",
    "Legal": "8.5in 14in",
}

MARGIN_PRESETS = {
    "normal": "2.54cm",
    "narrow": "1.27cm",
    "wide": "3.81cm",
}

FONT_MAP = {
    "sans-serif": "Arial, Helvetica, sans-serif",
    "serif": "Times New Roman, Georgia, serif",
    "monospace": "Courier New, Courier, monospace",
}


def generate_pdf_css(options: dict) -> str:
    """Build a CSS string from conversion options for WeasyPrint."""
    page_size = PAGE_SIZES.get(options.get("pdfPageSize", "A4"), "210mm 297mm")
    orientation = options.get("pdfOrientation", "portrait")
    margins = MARGIN_PRESETS.get(options.get("pdfMargins", "normal"), "2.54cm")
    font_family = FONT_MAP.get(options.get("pdfFont", "sans-serif"), "Arial, sans-serif")
    font_size = options.get("pdfFontSize", 12)
    page_numbers = options.get("pdfPageNumbers", True)
    header_text = options.get("pdfHeader", "")
    footer_text = options.get("pdfFooter", "")

    if orientation == "landscape":
        page_size += " landscape"

    css_parts = [
        "@page {",
        f"  size: {page_size};",
        f"  margin: {margins};",
    ]

    # Page numbers in bottom center
    if page_numbers:
        css_parts.append(
            '  @bottom-center { content: counter(page) " / " counter(pages); font-size: 10px; color: #666; }'
        )

    if header_text:
        css_parts.append(
            f'  @top-center {{ content: "{header_text}"; font-size: 10px; color: #666; }}'
        )

    if footer_text:
        css_parts.append(
            f'  @bottom-left {{ content: "{footer_text}"; font-size: 10px; color: #666; }}'
        )

    css_parts.append("}")

    css_parts.extend([
        "body {",
        f"  font-family: {font_family};",
        f"  font-size: {font_size}pt;",
        "  line-height: 1.6;",
        "  color: #333;",
        "}",
        "h1, h2, h3, h4, h5, h6 { margin-top: 1em; margin-bottom: 0.5em; }",
        "pre, code { font-family: Courier New, monospace; font-size: 0.9em; background: #f5f5f5; padding: 2px 4px; }",
        "pre { padding: 1em; overflow-x: auto; }",
        "table { border-collapse: collapse; width: 100%; margin: 1em 0; }",
        "th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }",
        "th { background: #f5f5f5; font-weight: bold; }",
        "img { max-width: 100%; }",
    ])

    return "\n".join(css_parts)
