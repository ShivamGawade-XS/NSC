"""
Tellura — Scientific Export Router.
Provides publication-grade data and memorandum exports in NetCDF-4, GeoJSON,
reproducible Jupyter Notebook (.ipynb), LaTeX Technical Memorandum (.tex), and Google Colab launch metadata.
"""
import hashlib
import hmac
import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from app.api.shared import get_cached_analysis, sanitize_attachment_filename
from app.core.config import settings
from app.core.limiter import limiter
from app.schemas.analysis import SpatialGridPoint
from app.science.export import (
    export_to_geojson,
    export_to_netcdf,
    generate_jupyter_notebook,
    generate_nasa_latex_memorandum,
    generate_scientific_dossier,
)

logger = logging.getLogger("Tellura.api.export")

router = APIRouter(tags=["Export"])


@router.get("/analysis/{analysis_id}/export/netcdf")
@limiter.limit("5/minute")
def export_analysis_netcdf(request: Request, analysis_id: str):
    """Export spatial trend analysis in CF-1.8 compliant NetCDF-4 binary format."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = [g if isinstance(g, SpatialGridPoint) else SpatialGridPoint(**g) for g in cached.get("grid", [])]
    req = cached["req"]

    analysis_record = {
        "variable": req.variable_id,
        "units": raw.get("display_units", ""),
        "is_synthetic": raw.get("is_synthetic", False),
        "provenance": raw.get("provenance", {}),
        "data_source_label": raw.get("data_source_label", ""),
        "results": {
            "cells": [
                {
                    "lat": g.lat, "lon": g.lon, "slope": g.slope,
                    "ci_lower": g.ci_lower, "ci_upper": g.ci_upper,
                    "p_value": g.p_value, "q_value": g.q_value,
                    "significant": g.is_significant_fdr, "direction": g.direction,
                    "lisa_cluster": g.lisa_cluster
                } for g in grid
            ]
        }
    }

    filename = sanitize_attachment_filename("Tellura", req.variable_id, req.start_year, req.end_year, "nc")
    try:
        nc_payload = export_to_netcdf(analysis_record)
        nc_bytes = nc_payload if isinstance(nc_payload, bytes) else Path(nc_payload).read_bytes()
        return Response(
            content=nc_bytes,
            media_type="application/x-netcdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NetCDF export failed: {e!s}") from e


@router.get("/analysis/{analysis_id}/export/geojson")
@limiter.limit("5/minute")
def export_analysis_geojson(request: Request, analysis_id: str):
    """Export full spatial analysis as GeoJSON FeatureCollection."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = [g if isinstance(g, SpatialGridPoint) else SpatialGridPoint(**g) for g in cached.get("grid", [])]
    req = cached["req"]

    analysis_record = {
        "variable": req.variable_id,
        "units": raw.get("display_units", ""),
        "is_synthetic": raw.get("is_synthetic", False),
        "data_source_label": raw.get("data_source_label", ""),
        "results": {
            "cells": [
                {
                    "lat": g.lat, "lon": g.lon, "slope": g.slope,
                    "ci_lower": g.ci_lower, "ci_upper": g.ci_upper,
                    "p_value": g.p_value, "q_value": g.q_value,
                    "tau": 0.0, "significant": g.is_significant_fdr,
                    "direction": g.direction, "lisa_cluster": g.lisa_cluster
                } for g in grid
            ]
        }
    }
    geojson_dict = export_to_geojson(analysis_record)
    filename = sanitize_attachment_filename("tellura_trends", req.variable_id, req.start_year, req.end_year, "geojson")
    return JSONResponse(
        content=geojson_dict,
        media_type="application/geo+json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/analysis/{analysis_id}/dossier")
@router.get("/analysis/{analysis_id}/export/dossier")
@limiter.limit("10/minute")
def get_scientific_dossier(request: Request, analysis_id: str):
    """Generate a publication-quality NASA Climate Science Dossier in Markdown."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = cached["grid"]
    trend_results = cached["trend_results"]
    req = cached["req"]

    moran = trend_results.get("moran_stats", {})

    analysis_record = {
        "variable": req.variable_id,
        "units": raw.get("display_units", ""),
        "is_synthetic": raw.get("is_synthetic", False),
        "alpha": req.alpha,
        "provenance": raw.get("provenance", {}),
        "data_source_label": raw.get("data_source_label", ""),
        "results": {
            "cells": [{"slope": g.slope, "significant": g.is_significant_fdr} for g in grid],
            "spatial_autocorrelation": moran
        }
    }
    dossier_md = generate_scientific_dossier(analysis_record)
    filename = sanitize_attachment_filename("NASA_Climate_Science_Dossier", req.variable_id, req.start_year, req.end_year, "md")
    return PlainTextResponse(
        dossier_md,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/analysis/{analysis_id}/export/notebook")
@limiter.limit("5/minute")
def export_analysis_notebook(request: Request, analysis_id: str):
    """Export self-contained reproducible Jupyter Notebook (.ipynb) independently verifiable in Google Colab or JupyterLab."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = [g if isinstance(g, SpatialGridPoint) else SpatialGridPoint(**g) for g in cached.get("grid", [])]
    req = cached["req"]

    raw_years = raw.get("years", raw.get("time", []))
    years_arr = [int(y) for y in (raw_years.tolist() if hasattr(raw_years, "tolist") else raw_years)]

    # Extract time series for top significant hotspot cell
    sig_cells = [g for g in grid if g.is_significant_fdr]
    top_cell = max(sig_cells, key=lambda g: abs(g.slope)) if sig_cells else (grid[0] if grid else None)
    top_series = []
    if top_cell and "data" in raw and hasattr(raw["data"], "ndim") and raw["data"].ndim == 3:
        lats_arr = np.asarray(raw["lat"])
        lons_arr = np.asarray(raw["lon"])
        i_idx = np.where(np.isclose(lats_arr, top_cell.lat))[0]
        j_idx = np.where(np.isclose(lons_arr, top_cell.lon))[0]
        if len(i_idx) > 0 and len(j_idx) > 0:
            top_series = [round(float(v), 3) for v in raw["data"][:, i_idx[0], j_idx[0]]]

    analysis_record = {
        "variable": req.variable_id,
        "dataset_id": req.dataset_id,
        "units": raw.get("display_units", ""),
        "is_synthetic": raw.get("is_synthetic", False),
        "provenance": raw.get("provenance", {}),
        "years": years_arr,
        "time_series": top_series,
        "results": {
            "cells": [
                {
                    "lat": g.lat, "lon": g.lon, "slope": g.slope,
                    "p_value": g.p_value, "q_value": g.q_value,
                    "significant": g.is_significant_fdr,
                    "ci_lower": g.ci_lower, "ci_upper": g.ci_upper,
                    "direction": g.direction, "lisa_cluster": g.lisa_cluster
                } for g in grid
            ]
        }
    }
    nb_dict = generate_jupyter_notebook(analysis_record)
    content = json.dumps(nb_dict, indent=2)
    filename = sanitize_attachment_filename("tellura_reproducible", req.variable_id, req.start_year, req.end_year, "ipynb")
    return PlainTextResponse(
        content=content,
        media_type="application/x-ipynb+json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/analysis/{analysis_id}/export/latex")
@limiter.limit("10/minute")
def export_analysis_latex(request: Request, analysis_id: str):
    """Generate publication-ready NASA Technical Memorandum (TM) in LaTeX format with HMAC cryptographic verification."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = [g if isinstance(g, SpatialGridPoint) else SpatialGridPoint(**g) for g in cached.get("grid", [])]
    req = cached["req"]

    analysis_record = {
        "variable": req.variable_id,
        "units": raw.get("display_units", "units"),
        "results": {
            "cells": [{"slope": g.slope, "significant": g.is_significant_fdr} for g in grid]
        }
    }

    # Generate HMAC signature
    secret = settings.SECRET_KEY.encode("utf-8")
    sig = hmac.new(secret, analysis_id.encode("utf-8"), hashlib.sha256).hexdigest()

    latex_code = generate_nasa_latex_memorandum(analysis_record, hmac_signature=sig[:24])
    filename = sanitize_attachment_filename("NASA_TM", req.variable_id, req.start_year, req.end_year, "tex")

    return PlainTextResponse(
        latex_code,
        media_type="application/x-latex",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/analysis/{analysis_id}/export/colab")
@limiter.limit("15/minute")
def get_colab_launcher_link(request: Request, analysis_id: str) -> dict[str, Any]:
    """Provide 1-click Google Colab launch metadata and direct notebook open payload."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    req = cached["req"]
    colab_badge_url = "https://colab.research.google.com/assets/colab-badge.svg"
    var_map = {
        "PRECTOT": "PRECTOTCORR",
        "PRECTOTCORR": "PRECTOTCORR",
        "T2M": "T2M",
        "ALLSKY_SFC_SW_DWN": "ALLSKY_SFC_SW_DWN",
        "WS10M": "WS10M",
        "RH2M": "RH2M",
        "compound": "compound",
        "compound_hazard": "compound",
    }
    target_nb = var_map.get(str(req.variable_id).upper(), "T2M")
    if target_nb not in var_map.values():
        target_nb = "T2M"
    github_colab_url = f"https://colab.research.google.com/github/ShivamGawade-XS/NSC/blob/main/notebooks/tellura_reproducible_{target_nb}.ipynb"

    return {
        "analysis_id": analysis_id,
        "variable_id": req.variable_id,
        "colab_launcher_url": github_colab_url,
        "badge_markdown": f"[![Open In Colab]({colab_badge_url})]({github_colab_url})",
        "interactive_execution_ready": True,
        "runtime": "Python 3 (Google Compute Engine GPU/TPU compatible)"
    }

