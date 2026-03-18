import asyncio
from pathlib import Path

from loguru import logger

from converters.base import BaseConverter, ProgressCallback


class FontConverter(BaseConverter):
    async def convert(
        self,
        input_path: Path,
        output_format: str,
        options: dict,
        on_progress: ProgressCallback | None = None,
    ) -> Path:
        output_dir = input_path.parent.parent / "output"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{input_path.stem}.{output_format}"

        if on_progress:
            await on_progress(20)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, self._convert_font, input_path, output_path, output_format
        )

        if on_progress:
            await on_progress(90)

        logger.info(f"Font converted: {input_path.name} → {output_path.name}")
        return output_path

    def _convert_font(
        self, input_path: Path, output_path: Path, output_format: str
    ) -> None:
        from fontTools.ttLib import TTFont  # type: ignore[import-untyped]

        font = TTFont(str(input_path))

        if output_format == "woff":
            font.flavor = "woff"
        elif output_format == "woff2":
            font.flavor = "woff2"
        else:
            font.flavor = None  # ttf / otf

        font.save(str(output_path))
