import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import psutil
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.types import Message, Receive, Scope, Send

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
def custom_rate_limit_exceeded_handler(request: Request, exc: Any) -> JSONResponse:
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
    except Exception:  # noqa: S110
        pass  # Safety net: never crash the 429 handler
    return response

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Standardize input validation errors into clean, structured JSON."""
    errors = exc.errors()
    safe_errors = [
        f"{' -> '.join(str(loc_item) for loc_item in err.get('loc', []))}: {err.get('msg', 'Validation error')}"
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
DEV_CSP = (
    b"default-src 'self'; "
    b"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    b"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    b"font-src 'self' https://fonts.gstatic.com data:; "
    b"img-src 'self' data: blob: https://*.arcgisonline.com https://server.arcgisonline.com "
    b"https://*.earthdata.nasa.gov https://gibs.earthdata.nasa.gov https://*.basemaps.cartocdn.com; "
    b"connect-src 'self' http://localhost:8000 http://localhost:3000 "
    b"http://127.0.0.1:8000 http://127.0.0.1:3000 "
    b"https://power.larc.nasa.gov https://gibs.earthdata.nasa.gov https://*.basemaps.cartocdn.com; "
    b"frame-ancestors 'none'; "
    b"base-uri 'self'; "
    b"form-action 'self';"
)

PROD_CSP = (
    b"default-src 'self'; "
    b"script-src 'self'; "
    b"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    b"font-src 'self' https://fonts.gstatic.com data:; "
    b"img-src 'self' data: blob: https://*.arcgisonline.com https://server.arcgisonline.com "
    b"https://*.earthdata.nasa.gov https://gibs.earthdata.nasa.gov https://*.basemaps.cartocdn.com; "
    b"connect-src 'self' http://localhost:8000 http://localhost:3000 "
    b"http://127.0.0.1:8000 http://127.0.0.1:3000 "
    b"https://power.larc.nasa.gov https://gibs.earthdata.nasa.gov https://*.basemaps.cartocdn.com; "
    b"frame-ancestors 'none'; "
    b"base-uri 'self'; "
    b"form-action 'self';"
)

BASE_SECURITY_HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"x-xss-protection", b"0"),
    (b"cross-origin-opener-policy", b"same-origin"),
    (b"cross-origin-resource-policy", b"same-origin"),
    (b"permissions-policy", b"geolocation=(), camera=(), microphone=(), payment=(), usb=()"),
    (b"strict-transport-security", b"max-age=31536000; includeSubDomains; preload"),
)


class SecurityHardeningMiddleware:
    """High-performance pure ASGI security middleware providing OWASP ASVS headers and DoS defense."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers_dict = {k.lower(): v for k, v in scope.get("headers", [])}
        content_length = headers_dict.get(b"content-length")
        if content_length is not None:
            try:
                cl_val = int(content_length.decode("latin1"))
                if cl_val > MAX_CONTENT_LENGTH:
                    await self._send_json(send, 413, b'{"detail": "Payload Too Large: Maximum permitted request body is 2MB."}', scope)
                    return
            except ValueError:
                await self._send_json(send, 400, b'{"detail": "Invalid Content-Length header: must be a valid integer."}', scope)
                return

        # Check chunked streaming bodies and count all POST, PUT, PATCH request bodies byte-by-byte
        method = scope.get("method", "")
        if method in ("POST", "PUT", "PATCH"):
            buffered = []
            total_bytes = 0
            exhausted = False
            while not exhausted:
                msg = await receive()
                if msg["type"] == "http.request":
                    body = msg.get("body", b"")
                    total_bytes += len(body)
                    if total_bytes > MAX_CONTENT_LENGTH:
                        await self._send_json(send, 413, b'{"detail": "Payload Too Large: Maximum permitted request body is 2MB."}', scope)
                        return
                    buffered.append(msg)
                    if not msg.get("more_body", False):
                        exhausted = True
                elif msg["type"] == "http.disconnect":
                    return

            it = iter(buffered)
            async def replay():
                try:
                    return next(it)
                except StopIteration:
                    return {"type": "http.request", "body": b"", "more_body": False}
            receive = replay

        async def send_wrapper(msg: Message):
            if msg["type"] == "http.response.start":
                h = list(msg.get("headers", []))
                existing_keys = {header[0].lower() for header in h}
                for k, v in BASE_SECURITY_HEADERS:
                    if k not in existing_keys:
                        h.append((k, v))
                path = scope.get("path", "")
                if b"content-security-policy" not in existing_keys:
                    is_dev_docs = (
                        path in ("/docs", "/redoc", "/openapi.json")
                        and os.getenv("ENVIRONMENT") != "production"
                    )
                    csp = DEV_CSP if is_dev_docs else PROD_CSP
                    h.append((b"content-security-policy", csp))
                if b"cache-control" not in existing_keys:
                    if path.startswith("/api/") or path in ("/analysis", "/variables", "/metrics", "/ready", "/auth/status") or "/export" in path:
                        if path.startswith("/api/v1/variables") or path == "/variables" or path == "/datasets" or path.startswith("/api/v1/datasets"):
                            h.append((b"cache-control", b"public, max-age=300"))
                        else:
                            h.append((b"cache-control", b"private, no-cache, no-store, must-revalidate"))
                            h.append((b"pragma", b"no-cache"))
                msg["headers"] = h
            await send(msg)

        await self.app(scope, receive, send_wrapper)

    async def _send_json(self, send: Send, status_code: int, body: bytes, scope: Scope):
        path = scope.get("path", "")
        is_dev_docs = (
            path in ("/docs", "/redoc", "/openapi.json")
            and os.getenv("ENVIRONMENT") != "production"
        )
        csp = DEV_CSP if is_dev_docs else PROD_CSP
        headers = [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode("ascii")),
            (b"cache-control", b"no-store, private"),
            (b"pragma", b"no-cache"),
            *BASE_SECURITY_HEADERS,
            (b"content-security-policy", csp),
        ]
        await send({"type": "http.response.start", "status": status_code, "headers": headers})
        await send({"type": "http.response.body", "body": body, "more_body": False})


app.add_middleware(SlowAPIMiddleware)
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
    expose_headers=[
        "Content-Disposition",
        "Retry-After",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
)

# Mount both versioned and root paths for all typed endpoints
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="")


@app.get("/metrics")
@app.get("/api/v1/metrics")
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


@app.get("/ready")
@app.get("/api/v1/ready")
@limiter.limit("120/minute")
def readiness_check(request: Request):
    """Kubernetes / Cloud readiness probe."""
    return {"status": "ready", "ready": True, "engine": "Mann-Kendall + Theil-Sen + Pettitt + LISA"}



@app.get("/auth/status")
@app.get("/api/v1/auth/status")
@limiter.limit("120/minute")
def earthdata_auth_status(request: Request):
    """Report NASA Earthdata Login authentication state."""
    return settings.get_earthdata_auth_status()


# Mount frontend web instrument (React SPA)
react_dist_dir = Path(__file__).resolve().parent.parent.parent / "frontend-react" / "dist"

if react_dist_dir.exists() and (react_dist_dir / "index.html").exists():
    assets_dir = react_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="react_assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")

        dist_root = react_dist_dir.resolve()
        try:
            candidate = (react_dist_dir / full_path).resolve()
            if candidate.is_relative_to(dist_root) and candidate.is_file():
                return FileResponse(candidate)
        except (ValueError, RuntimeError):
            pass

        return FileResponse(react_dist_dir / "index.html")


if __name__ == "__main__":
    import uvicorn
    bind_host = os.getenv("HOST", "127.0.0.1")
    is_dev = os.getenv("ENVIRONMENT", "production").lower() in ("development", "dev", "local")
    uvicorn.run("app.main:app", host=bind_host, port=8000, reload=is_dev)  # nosec B104
