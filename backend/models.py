from pydantic import BaseModel


class DetectionResponse(BaseModel):
    category: str | None
    format: str
    mime_type: str
    is_ambiguous: bool
    available_outputs: list[str]
    available_categories: list[str] | None = None


class ConvertResponse(BaseModel):
    job_id: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str  # pending | processing | completed | failed
    progress: int  # 0-100
    error: str | None = None
    output_files: list[str] = []


class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None = None
