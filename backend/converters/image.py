import asyncio
from pathlib import Path

from loguru import logger
from PIL import Image, ImageOps

from converters.base import BaseConverter

# Register HEIF/HEIC opener if available
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    logger.warning("pillow-heif not available — HEIC/HEIF support disabled")

# Try importing rawpy for RAW files
try:
    import rawpy
    HAS_RAWPY = True
except ImportError:
    HAS_RAWPY = False
    logger.warning("rawpy not available — RAW file support disabled")

# Format mapping: our format names → Pillow save format names
PILLOW_FORMAT_MAP = {
    "jpg": "JPEG",
    "jpeg": "JPEG",
    "png": "PNG",
    "gif": "GIF",
    "bmp": "BMP",
    "tiff": "TIFF",
    "webp": "WEBP",
    "heic": "HEIF",
    "avif": "AVIF",
    "ico": "ICO",
    "jxl": "JPEG XL",
    "pdf": "PDF",
}

RAW_EXTENSIONS = {"cr2", "nef", "arw"}


class ImageConverter(BaseConverter):
    async def convert(
        self, input_path: Path, output_format: str, options: dict
    ) -> Path:
        ext = input_path.suffix.lower().lstrip(".")
        output_dir = input_path.parent.parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        stem = input_path.stem
        output_path = output_dir / f"{stem}.{output_format}"

        # SVG output: raster → vector trace via potrace
        if output_format == "svg":
            return await self._to_svg(input_path, output_path, ext, options)

        # Open image
        img = self._open_image(input_path, ext)

        # Apply resize
        img = self._apply_resize(img, options)

        # Strip EXIF if requested
        if options.get("stripMetadata", False):
            img = ImageOps.exif_transpose(img) or img
            if hasattr(img, "info"):
                img.info.pop("exif", None)
                img.info.pop("icc_profile", None)
        else:
            # Auto-orient based on EXIF
            img = ImageOps.exif_transpose(img) or img

        # Handle transparency for non-transparent outputs
        if output_format in ("jpg", "jpeg", "bmp", "pdf", "heic"):
            img = self._flatten_alpha(img, options.get("backgroundColor", "#ffffff"))

        # Save with format-specific options
        save_kwargs = self._get_save_kwargs(output_format, options)

        if output_format == "ico":
            return self._save_ico(img, output_path)

        pillow_format = PILLOW_FORMAT_MAP.get(output_format)
        if not pillow_format:
            raise ValueError(f"Unsupported output format: {output_format}")

        img.save(str(output_path), format=pillow_format, **save_kwargs)
        logger.info(f"Image converted: {input_path.name} → {output_path.name}")
        return output_path

    def _open_image(self, path: Path, ext: str) -> Image.Image:
        """Open an image, handling RAW formats specially."""
        if ext in RAW_EXTENSIONS:
            if not HAS_RAWPY:
                raise RuntimeError(
                    f"Cannot open RAW file (.{ext}): rawpy is not installed"
                )
            raw = rawpy.imread(str(path))
            rgb = raw.postprocess()
            return Image.fromarray(rgb)

        return Image.open(str(path))

    def _apply_resize(self, img: Image.Image, options: dict) -> Image.Image:
        resize = options.get("resize")
        if not resize:
            return img

        target_w = resize.get("width")
        target_h = resize.get("height")
        lock_aspect = resize.get("lockAspect", True)

        if not target_w and not target_h:
            return img

        orig_w, orig_h = img.size

        if lock_aspect:
            if target_w and not target_h:
                ratio = target_w / orig_w
                target_h = int(orig_h * ratio)
            elif target_h and not target_w:
                ratio = target_h / orig_h
                target_w = int(orig_w * ratio)
            else:
                # Both given with lock aspect: fit within bounds
                ratio = min(target_w / orig_w, target_h / orig_h)
                target_w = int(orig_w * ratio)
                target_h = int(orig_h * ratio)

        if target_w and target_h:
            img = img.resize((target_w, target_h), Image.LANCZOS)

        return img

    def _flatten_alpha(self, img: Image.Image, bg_color: str) -> Image.Image:
        """Replace transparency with a solid background color."""
        if img.mode in ("RGBA", "LA", "PA"):
            # Parse hex color
            bg_color = bg_color.lstrip("#")
            r, g, b = int(bg_color[0:2], 16), int(bg_color[2:4], 16), int(bg_color[4:6], 16)
            background = Image.new("RGB", img.size, (r, g, b))
            if img.mode == "RGBA":
                background.paste(img, mask=img.split()[3])
            else:
                img_rgba = img.convert("RGBA")
                background.paste(img_rgba, mask=img_rgba.split()[3])
            return background
        if img.mode != "RGB":
            return img.convert("RGB")
        return img

    def _get_save_kwargs(self, output_format: str, options: dict) -> dict:
        quality = options.get("quality", 85)
        kwargs: dict = {}

        if output_format in ("jpg", "jpeg"):
            kwargs["quality"] = quality
            kwargs["optimize"] = True
        elif output_format == "png":
            kwargs["optimize"] = True
        elif output_format == "webp":
            kwargs["quality"] = quality
            kwargs["method"] = 6
        elif output_format == "avif":
            kwargs["quality"] = quality
        elif output_format == "heic":
            kwargs["quality"] = quality
        elif output_format == "jxl":
            kwargs["quality"] = quality
        elif output_format == "tiff":
            kwargs["compression"] = "tiff_lzw"
        elif output_format == "pdf":
            kwargs["resolution"] = 150.0

        return kwargs

    def _save_ico(self, img: Image.Image, output_path: Path) -> Path:
        """Save as ICO with multiple standard sizes."""
        sizes = []
        for s in [16, 32, 48, 64, 128, 256]:
            if s <= max(img.size):
                sizes.append((s, s))
        if not sizes:
            sizes = [(16, 16), (32, 32)]

        img.save(str(output_path), format="ICO", sizes=sizes)
        return output_path

    async def _to_svg(
        self, input_path: Path, output_path: Path, ext: str, options: dict
    ) -> Path:
        """Convert raster image to SVG via potrace."""
        # First convert to PBM (required by potrace)
        img = self._open_image(input_path, ext)
        img = self._apply_resize(img, options)
        bw = img.convert("1")  # 1-bit black and white
        pbm_path = output_path.with_suffix(".pbm")
        bw.save(str(pbm_path), format="PPM")

        try:
            proc = await asyncio.create_subprocess_exec(
                "potrace", str(pbm_path), "-s", "-o", str(output_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                _, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=60)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                raise RuntimeError("potrace timed out after 60 seconds")
            if proc.returncode != 0:
                raise RuntimeError(f"potrace failed: {stderr_bytes.decode()[:200]}")
        finally:
            if pbm_path.exists():
                pbm_path.unlink()

        if not output_path.exists():
            raise RuntimeError("potrace failed to produce SVG output")

        return output_path

    def supported_input_formats(self) -> list[str]:
        return [
            "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp",
            "heic", "heif", "avif", "svg", "ico",
            "cr2", "nef", "arw", "jxl", "qoi",
        ]

    def supported_output_formats(self) -> list[str]:
        return [
            "jpg", "png", "gif", "bmp", "tiff", "webp",
            "heic", "avif", "ico", "jxl", "pdf", "svg",
        ]
