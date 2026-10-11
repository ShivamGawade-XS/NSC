import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

import psutil
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.endpoints import router as api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging_security import install_security_logging

logger = logging.getLogger("earthsift.main")
install_security_logging()

START_TIME = time.time()
MAX_CONTENT_LENGTH = 2 * 1024 * 1024  # 2MB Maximum request body size


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Perform startup checks and setup credentials."""
    install_security_logging()
    settings.setup_netrc()
    yield


app = FastAPI(
    title="EarthSift Scientific API",
    description="Evidence-first Earth-system trend discovery platform for NASA Space Apps 2026.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None,
)

# Connect SlowAPI limiter to FastAPI state and register custom exception handler with Retry-After header
def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after = getattr(exc, "retry_after", 60) or 60
    response = JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}. Please slow down your requests.",
            "error": "rate_limit_exceeded",
            "retry_after": int(retry_after),
        },
        headers={"Retry-After": str(int(retry_after))}
    )
    try:
        limiter_inst = getattr(getattr(request, "app", None), "state", None)
        limiter_obj = getattr(limiter_inst, "limiter", None) if limiter_inst else None
        if limiter_obj and hasattr(limiter_obj, "_inject_headers") and hasattr(getattr(request, "state", None), "view_rate_limit"):
            response = limiter_obj._inject_headers(response, request.state.view_rate_limit)
    except Exception:
        pass  # Safety net: never crash the 429 handler
    return response

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Standardize input validation errors into clean, structured JSON."""
    errors = exc.errors()
    safe_errors = [
        f"{' -> '.join(str(l) for l in err.get('loc', []))}: {err.get('msg', 'Validation error')}"
        for err in errors
    ]
    return JSONResponse(
        status_code=422,
        content={
            "detail": "; ".join(safe_errors),
            "errors": safe_errors,
        }
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Suppress internal stack traces and server internals in production mode."""
    is_prod = os.getenv("ENVIRONMENT") == "production"
    logger.error("Unhandled server exception: %s", str(exc), exc_info=not is_prod)
    if is_prod:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error occurred. Please contact support or retry."}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {exc!s}"}
    )


# Security headers and request size limiter
class SecurityHardeningMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Bound request payload size to prevent memory exhaustion
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_CONTENT_LENGTH:
            return JSONResponse(
                status_code=413,
                content={"detail": "Payload Too Large: Maximum permitted request body is 2MB."}
            )

        response = await call_next(request)

        # Baseline security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), camera=(), microphone=(), payment=(), usb=()"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Content Security Policy for API docs and tile endpoints
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com data:; "
            "img-src 'self' data: blob: https://*.arcgisonline.com https://server.arcgisonline.com "
            "https://*.earthdata.nasa.gov https://gibs.earthdata.nasa.gov; "
            "connect-src 'self' http://localhost:8000 http://localhost:3000 "
            "http://127.0.0.1:8000 http://127.0.0.1:3000 "
            "https://power.larc.nasa.gov https://gibs.earthdata.nasa.gov; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )

        return response


app.add_middleware(SecurityHardeningMiddleware)


# Cross-Origin Resource Sharing (CORS) origin whitelist
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allow_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allow_origins = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    expose_headers=["Content-Disposition", "Retry-After"],
)

# Mount both versioned and root paths for all typed endpoints
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="")


@app.get("/metrics")
@limiter.limit("120/minute")
def get_metrics(request: Request):
    """System telemetry and performance metrics."""
    uptime = time.time() - START_TIME
    try:
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        mem_mb = round(mem_info.rss / (1024 * 1024), 2)
    except Exception:
        mem_mb = 0.0

    from app.api.endpoints import ANALYSIS_CACHE
    from app.core.db_cache import get_cache_db_stats
    return {
        "service": "EarthSift Scientific API",
        "version": settings.VERSION,
        "uptime_seconds": round(uptime, 1),
        "cached_analyses": len(ANALYSIS_CACHE),
        "database_cache": get_cache_db_stats(),
        "memory_rss_mb": mem_mb,
        "status": "operational"
    }


@app.get("/api/v1/ready")
@limiter.limit("120/minute")
def readiness_check(request: Request):
    """Kubernetes / Cloud readiness probe."""
    return {"ready": True, "engine": "Mann-Kendall + Theil-Sen + Pettitt + LISA"}


@app.get("/api/v1/auth/status")
@limiter.limit("120/minute")
def earthdata_auth_status(request: Request):
    """Report NASA Earthdata Login authentication state."""
    return settings.get_earthdata_auth_status()


# Mount frontend web instrument (prefers React build with SPA support, falls back to legacy frontend)
react_dist_dir = Path(__file__).resolve().parent.parent.parent / "frontend-react" / "dist"
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"

if react_dist_dir.exists() and (react_dist_dir / "index.html").exists():
    assets_dir = react_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="react_assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = react_dist_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(react_dist_dir / "index.html")
elif frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    bind_host = os.getenv("HOST", "127.0.0.1")
    uvicorn.run("app.main:app", host=bind_host, port=8000, reload=True)  # nosec B104
