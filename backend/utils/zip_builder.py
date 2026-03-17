import zipfile
from pathlib import Path


def create_zip(output_dir: Path, filenames: list[str]) -> Path:
    """Create a ZIP archive of the specified files in output_dir."""
    zip_path = output_dir / "converted_files.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename in filenames:
            file_path = output_dir / filename
            if file_path.exists():
                zf.write(file_path, filename)
    return zip_path
