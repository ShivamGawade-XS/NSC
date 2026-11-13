"""
Tellura — Modular API Routers.
Combines sub-routers into a unified APIRouter instance.
"""
from fastapi import APIRouter

from app.api.routers.analysis import router as analysis_router
from app.api.routers.attribution import router as attribution_router
from app.api.routers.copilot import router as copilot_router
from app.api.routers.datasets import router as datasets_router
from app.api.routers.export import router as export_router
from app.api.routers.system import router as system_router

api_router = APIRouter()

# Mount all domain sub-routers in canonical order
api_router.include_router(system_router)
api_router.include_router(datasets_router)
api_router.include_router(analysis_router)
api_router.include_router(copilot_router)
api_router.include_router(export_router)
api_router.include_router(attribution_router)

__all__ = [
    "analysis_router",
    "api_router",
    "attribution_router",
    "copilot_router",
    "datasets_router",
    "export_router",
    "system_router",
]

