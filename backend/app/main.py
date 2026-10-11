from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.endpoints import router as api_router

import time
import psutil
import os
from contextlib import asynccontextmanager
from app.core.config import settings

START_TIME = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Perform startup checks and setup credentials."""
    settings.setup_netrc()
    yield

app = FastAPI(
    title="EarthSift Scientific API",
    description="Evidence-first Earth-system trend discovery platform for NASA Space Apps 2026.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local development and frontend dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Mount both versioned and root paths for all typed endpoints
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="")

@app.get("/metrics")
def get_metrics():
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
def readiness_check():
    """Kubernetes / Cloud readiness probe."""
    return {"ready": True, "engine": "Mann-Kendall + Theil-Sen + Pettitt + LISA"}

@app.get("/api/v1/auth/status")
def earthdata_auth_status():
    """Report NASA Earthdata Login authentication state."""
    return settings.get_earthdata_auth_status()

from fastapi.responses import FileResponse

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
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
