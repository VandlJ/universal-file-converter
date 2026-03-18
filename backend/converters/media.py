import asyncio
from pathlib import Path

from loguru import logger

from converters.base import BaseConverter, ProgressCallback

AUDIO_CODEC_MAP: dict[str, list[str]] = {
    "mp3": ["libmp3lame"],
    "wav": ["pcm_s16le"],
    "ogg": ["libvorbis"],
    "flac": ["flac"],
    "aac": ["aac"],
    "m4a": ["aac"],
    "opus": ["libopus"],
}

AUDIO_OUTPUTS = set(AUDIO_CODEC_MAP.keys())


class MediaConverter(BaseConverter):
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
            await on_progress(10)

        cmd = self._build_ffmpeg_cmd(input_path, output_path, output_format, options)

        if on_progress:
            await on_progress(20)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr_bytes = await asyncio.wait_for(proc.communicate(), timeout=300)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.communicate()
            raise RuntimeError("ffmpeg timed out after 5 minutes")

        if on_progress:
            await on_progress(90)

        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {stderr_bytes.decode()[:300]}")

        if not output_path.exists():
            raise RuntimeError("ffmpeg produced no output file")

        logger.info(f"Media converted: {input_path.name} → {output_path.name}")
        return output_path

    def _build_ffmpeg_cmd(
        self,
        input_path: Path,
        output_path: Path,
        output_format: str,
        options: dict,
    ) -> list[str]:
        quality = int(options.get("quality", 85))
        cmd = ["ffmpeg", "-y", "-i", str(input_path)]

        if output_format == "gif":
            cmd += ["-vf", "fps=10,scale=480:-1:flags=lanczos", "-loop", "0"]
        elif output_format in AUDIO_OUTPUTS:
            codecs = AUDIO_CODEC_MAP.get(output_format, [])
            if codecs:
                cmd += ["-c:a"] + codecs
            cmd += ["-vn"]  # strip video stream
            if output_format == "mp3":
                q = max(0, min(9, int((100 - quality) * 9 / 100)))
                cmd += ["-q:a", str(q)]
            elif output_format in ("ogg", "opus"):
                bitrate = max(32, int(quality * 3.2))
                cmd += ["-b:a", f"{bitrate}k"]
        elif output_format == "mp4":
            crf = max(0, min(51, int((100 - quality) * 51 / 100)))
            cmd += ["-c:v", "libx264", "-crf", str(crf), "-c:a", "aac"]
        elif output_format == "webm":
            crf = max(4, min(63, int((100 - quality) * 59 / 100) + 4))
            cmd += ["-c:v", "libvpx-vp9", "-crf", str(crf), "-b:v", "0", "-c:a", "libopus"]
        elif output_format in ("mkv", "avi", "mov"):
            crf = max(0, min(51, int((100 - quality) * 51 / 100)))
            cmd += ["-c:v", "libx264", "-crf", str(crf), "-c:a", "aac"]

        cmd.append(str(output_path))
        return cmd
