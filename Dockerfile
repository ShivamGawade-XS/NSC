# EarthSift — Hardened Production Multi-Stage Dockerfile
# Conforms to OWASP ASVS Level 2 & CIS Docker Benchmark (Least-Privilege Non-Root)

# ==========================================
# STAGE 1: Frontend SPA Builder
# ==========================================
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend-react/package*.json ./
RUN npm ci --no-audit --no-fund

COPY frontend-react/ ./
RUN npm run build

# ==========================================
# STAGE 2: Python Dependency Builder
# ==========================================
FROM python:3.12-slim AS python-builder

WORKDIR /build

# Install build dependencies if native C extensions require compiling
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# ==========================================
# STAGE 3: Hardened Minimal Runtime Image
# ==========================================
FROM python:3.12-slim AS runtime

# Create dedicated unprivileged user & group (10001:10001)
RUN groupadd -g 10001 -r appgroup && \
    useradd -u 10001 -r -g appgroup -s /sbin/nologin -d /app appuser

WORKDIR /app

# Install minimal healthcheck utility
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from python-builder stage
COPY --from=python-builder /install /usr/local

# Copy application backend and built frontend SPA
COPY backend /app/backend
COPY --from=frontend-builder /frontend/dist /app/frontend-react/dist

# Create designated cache directory with 0700 permissions owned by 10001:10001
RUN mkdir -p /app/cache /app/backend/data /app/data && \
    chmod 0700 /app/cache && \
    chown -R appuser:appgroup /app

# Ensure Python discovers backend modules and cache DB path
ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    HOME=/app/cache \
    NETRC_DIR=/app/cache \
    NASA_POWER_CACHE_DIR=/app/cache/nasa_power \
    MERRA2_DATA_DIR=/app/backend/data/fixtures \
    EARTHSIFT_DB_PATH=/app/cache/earthdata_cache.db

EXPOSE 8000

# Healthcheck to verify engine readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Enforce execution as unprivileged user
USER appuser:appgroup

WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
