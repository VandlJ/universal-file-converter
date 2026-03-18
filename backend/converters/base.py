from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from pathlib import Path

# Callback type: receives progress 0-100
ProgressCallback = Callable[[int], Awaitable[None]]


class BaseConverter(ABC):
    @abstractmethod
    async def convert(
        self,
        input_path: Path,
        output_format: str,
        options: dict,
        on_progress: ProgressCallback | None = None,
    ) -> Path:
        """Convert file and return path to output file."""
        ...
