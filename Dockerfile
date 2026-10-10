# EarthSift — Production Dockerfile
# NASA Space Apps Challenge 2026: Be An Earth System Trend Detective!

FROM python:3.12-slim

WORKDIR /app

# Install system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python scientific dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt && \
    pip install --no-cache-dir netcdf4

# Copy backend application, fixtures, and frontend instrument
COPY backend /app/backend
COPY frontend /app/frontend

# Ensure Python discovers backend modules
ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    MERRA2_DATA_DIR=/app/backend/data/fixtures

EXPOSE 8000

# Healthcheck to verify engine readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
