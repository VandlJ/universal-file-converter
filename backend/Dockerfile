FROM python:3.12-slim

# Install system dependencies required at runtime.
# --no-install-recommends keeps the layer lean.
# curl is included for the Docker healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libmagic1 \
    pandoc \
    libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress \
    tesseract-ocr tesseract-ocr-ces tesseract-ocr-deu \
    poppler-utils \
    potrace \
    libheif-dev \
    libjxl-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create a dedicated non-root user.
# -m creates a home dir so LibreOffice can write its per-user config.
RUN groupadd -r appgroup \
    && useradd -r -g appgroup -m -d /home/appuser -s /sbin/nologin appuser

WORKDIR /app

# Create the temp directory with correct ownership before switching to appuser.
# Docker copies this structure when initializing a new named volume.
RUN mkdir -p /tmp/converter && chown appuser:appgroup /tmp/converter

# Copy requirements first — changes to source code won't bust this cache layer.
COPY --chown=appuser:appgroup requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code.
COPY --chown=appuser:appgroup . .

USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
