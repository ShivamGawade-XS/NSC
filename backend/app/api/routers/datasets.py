"""
Tellura — Datasets and Variables Metadata Router.
Provides discovery catalogs for NASA Earth-system observation datasets and variables.
"""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.api.shared import ADAPTERS
from app.core.limiter import limiter
from app.schemas.analysis import VariableInfo

logger = logging.getLogger("Tellura.api.datasets")

router = APIRouter(tags=["Datasets"])


@router.get("/datasets")
@limiter.limit("60/minute")
async def list_datasets(request: Request) -> list[dict[str, Any]]:
    """Return available NASA datasets and supported variables."""
    return [adapter.metadata() for adapter in ADAPTERS.values()]


@router.get("/datasets/{dataset_id}")
@limiter.limit("60/minute")
def get_dataset(request: Request, dataset_id: str) -> dict[str, Any]:
    """Retrieve metadata for a specific dataset."""
    adapter = ADAPTERS.get(dataset_id)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    return adapter.metadata()


@router.get("/variables", response_model=list[VariableInfo])
@limiter.limit("60/minute")
def list_variables(request: Request) -> list[VariableInfo]:
    """Return catalog of all supported physical variables across datasets."""
    variables: list[VariableInfo] = []
    for d_id, adapter in ADAPTERS.items():
        meta = adapter.metadata()
        for v_id, v_info in meta["variables"].items():
            variables.append(VariableInfo(
                variable_id=v_id,
                name=v_info["name"],
                source_units=v_info["source_units"],
                display_units=v_info["display_units"],
                slope_units=v_info["slope_units"],
                description=v_info["description"],
                dataset_id=d_id,
                mission_source=v_info.get("mission_source"),
                product_type=v_info.get("product_type"),
                discontinuity_warning=v_info.get("discontinuity_warning"),
                physical_domain=v_info.get("physical_domain", "Atmospheric"),
                earliest_year=v_info.get("earliest_year", 1981),
                latest_year=v_info.get("latest_year", 2024),
                temporal_aggregation=v_info.get("temporal_aggregation", "annual_mean"),
                native_resolution=v_info.get("native_resolution", adapter.NATIVE_RESOLUTION),
                suitable_analysis_types=v_info.get("suitable_analysis_types", ["monotonic_trend", "compound_hazard", "regional_comparison", "robustness_lab"]),
                scientific_references=v_info.get("scientific_references", [])
            ))
    return variables

