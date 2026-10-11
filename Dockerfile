# EarthSift — Hardened Production Multi-Stage Dockerfile
# Conforms to OWASP ASVS Level 2 & CIS Docker Benchmark (Least-Privilege Non-Root)

# ==========================================
# STAGE 1: Dependency Builder
# ==========================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies if native extensions need compiling
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt && \
    pip install --no-cache-dir --prefix=/install netcdf4 slowapi

# ==========================================
# STAGE 2: Hardened Minimal Runtime Image
# ==========================================
FROM python:3.12-slim AS runtime

# Create dedicated unprivileged user & group
RUN groupadd -g 10001 -r appgroup && \
    useradd -u 10001 -r -g appgroup -s /sbin/nologin -d /app appuser

WORKDIR /app

# Install minimal healthcheck utility
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder stage
COPY --from=builder /install /usr/local

# Copy application backend, frontend distribution, and scientific fixtures
COPY backend /app/backend
COPY frontend-react/dist /app/frontend-react/dist
COPY frontend /app/frontend

# Create and configure designated writable data cache directories
RUN mkdir -p /app/backend/data /app/data && \
    chown -R appuser:appgroup /app

# Ensure Python discovers backend modules
ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    MERRA2_DATA_DIR=/app/backend/data/fixtures

EXPOSE 8000

# Healthcheck to verify engine readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Enforce execution as unprivileged user
USER appuser:appgroup

WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
