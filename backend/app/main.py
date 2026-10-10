from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from app.api.endpoints import router as api_router

app = FastAPI(
    title="EarthSift Scientific API",
    description="Evidence-first Earth-system trend discovery platform for NASA Space Apps 2026.",
    version="1.0.0"
)

# Enable CORS for local development and frontend dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount both versioned and root paths for all typed endpoints
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="")

# Mount frontend static web instrument
frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
