"""
EarthSift — FastAPI Endpoints
Routes for datasets, variables, trend analysis, map layers,
time series, discovery signals, contrasts, provenance, and AI explanations.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from fastapi import APIRouter, HTTPException, Query

import os
import shutil
import tempfile
import threading
from collections import OrderedDict
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from starlette.background import BackgroundTask

from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    SpatialGridPoint,
    AnalysisSummary,
    CellDetailResponse,
    ExplainRequest,
    ExplainResponse,
    MapLayerResponse,
    SignalsResponse,
    CandidateSignal,
    ContrastsResponse,
    ProvenanceResponse,
    VariableInfo,
    CompoundHazardRequest,
    CompoundHazardResponse
)
from app.adapters.merra2 import MERRA2Adapter
from app.adapters.nasa_power import NASAPowerAdapter
from app.science.trend import compute_spatial_trends, mann_kendall_test, sens_slope, pettitt_changepoint_test
from app.science.contrasts import find_contrasting_regions
from app.science.discovery import discover_candidate_signals
from app.science.explainer import explain_evidence_with_ai
from app.science.export import export_to_netcdf, export_to_geojson, generate_scientific_dossier, generate_jupyter_notebook
from app.science.compound import compute_compound_hazard

router = APIRouter()

# Global adapters registry
ADAPTERS = {
    "merra2_reanalysis": MERRA2Adapter(),
    "nasa_power": NASAPowerAdapter()
}

# Thread-safe in-memory LRU analysis cache
CACHE_LOCK = threading.Lock()
ANALYSIS_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()


def get_cached_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve analysis from cache with thread-safe LRU ordering."""
    with CACHE_LOCK:
        if analysis_id in ANALYSIS_CACHE:
            ANALYSIS_CACHE.move_to_end(analysis_id)
            return ANALYSIS_CACHE[analysis_id]
        return None


def set_cached_analysis(analysis_id: str, value: Dict[str, Any], max_size: int = 32) -> None:
    """Store analysis in cache with thread-safe bounded LRU eviction."""
    with CACHE_LOCK:
        if analysis_id in ANALYSIS_CACHE:
            ANALYSIS_CACHE.move_to_end(analysis_id)
        ANALYSIS_CACHE[analysis_id] = value
        while len(ANALYSIS_CACHE) > max_size:
            ANALYSIS_CACHE.popitem(last=False)


@router.get("/health")
def health_check() -> Dict[str, Any]:
    """API health and capabilities status."""
    return {
        "status": "healthy",
        "service": "EarthSift Scientific API",
        "version": "1.0.0",
        "engine": "Mann-Kendall + Theil-Sen + Benjamini-Hochberg FDR",
        "adapters": list(ADAPTERS.keys())
    }


@router.get("/datasets")
def list_datasets() -> List[Dict[str, Any]]:
    """Return available NASA datasets and supported variables."""
    return [adapter.metadata() for adapter in ADAPTERS.values()]


@router.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> Dict[str, Any]:
    """Retrieve metadata for a specific dataset."""
    adapter = ADAPTERS.get(dataset_id)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    return adapter.metadata()


@router.get("/variables", response_model=List[VariableInfo])
def list_variables() -> List[VariableInfo]:
    """Return catalog of all supported physical variables across datasets."""
    variables: List[VariableInfo] = []
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
                dataset_id=d_id
            ))
    return variables


@router.post("/analysis", response_model=AnalysisResponse)
def run_analysis(req: AnalysisRequest) -> AnalysisResponse:
    """Execute spatiotemporal trend analysis across requested domain."""
    adapter = ADAPTERS.get(req.dataset_id)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found.")

    try:
        raw_slice = adapter.fetch_subset(
            variable=req.variable_id,
            start_year=req.start_year,
            end_year=req.end_year,
            bbox=req.bbox,
            prefer_live=req.prefer_live
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data_3d = raw_slice["data"]  # (time, lat, lon)
    years = raw_slice["time"]
    lats = raw_slice["lat"]
    lons = raw_slice["lon"]
    time_coords = (years - req.start_year) / 10.0  # Decades

    # Run vectorized scientific analysis
    trend_results = compute_spatial_trends(data_3d, time_coords=time_coords, alpha=req.alpha)

    slopes = trend_results["slopes"]
    p_vals = trend_results["p_values"]
    q_vals = trend_results["q_values"]
    sig_raw = trend_results["is_significant_raw"]
    sig_fdr = trend_results["is_significant_fdr"]
    n_samples = trend_results["n_samples"]

    # Discover opposing regional contrasts
    active_sig = sig_fdr if req.use_fdr else sig_raw
    contrasts = find_contrasting_regions(
        slopes=slopes,
        is_significant=active_sig,
        latitudes=lats,
        longitudes=lons
    )
    if not contrasts and req.use_fdr and int(np.sum(sig_raw)) > 0:
        contrasts = find_contrasting_regions(
            slopes=slopes,
            is_significant=sig_raw,
            latitudes=lats,
            longitudes=lons
        )

    # Discover candidate signals with transparent composite score and true completeness
    signals = discover_candidate_signals(
        slopes=slopes,
        p_values=p_vals,
        q_values=q_vals,
        is_significant_raw=sig_raw,
        is_significant_fdr=sig_fdr,
        latitudes=lats,
        longitudes=lons,
        alpha=req.alpha,
        top_n=10,
        data_3d=data_3d
    )

    # Build spatial grid points (with CI and LISA)
    grid_points: List[SpatialGridPoint] = []
    h_len, w_len = slopes.shape
    ci_lower = trend_results.get("ci_lower", np.zeros_like(slopes))
    ci_upper = trend_results.get("ci_upper", np.zeros_like(slopes))
    lisa_clusters = trend_results.get("lisa_clusters", np.full_like(slopes, "NS", dtype=object))

    for i in range(h_len):
        for j in range(w_len):
            s = float(slopes[i, j])
            is_sig = bool(sig_fdr[i, j]) if req.use_fdr else bool(sig_raw[i, j])

            if is_sig and s > 0:
                direction = "increasing"
            elif is_sig and s < 0:
                direction = "decreasing"
            else:
                direction = "neutral"

            grid_points.append(SpatialGridPoint(
                lat=float(lats[i]),
                lon=float(lons[j]),
                slope=round(s, 4),
                ci_lower=round(float(ci_lower[i, j]), 4),
                ci_upper=round(float(ci_upper[i, j]), 4),
                p_value=round(float(p_vals[i, j]), 5),
                q_value=round(float(q_vals[i, j]), 5),
                is_significant_raw=bool(sig_raw[i, j]),
                is_significant_fdr=bool(sig_fdr[i, j]),
                direction=direction,
                lisa_cluster=str(lisa_clusters[i, j]),
                n_samples=int(n_samples[i, j])
            ))

    total_cells = h_len * w_len
    sig_raw_count = int(np.sum(sig_raw))
    sig_fdr_count = int(np.sum(sig_fdr))
    moran_stats = trend_results.get("moran_stats", {})

    summary = AnalysisSummary(
        total_cells=total_cells,
        significant_cells_raw=sig_raw_count,
        significant_cells_fdr=sig_fdr_count,
        mean_slope=round(float(np.mean(slopes)), 4),
        max_slope=round(float(np.max(slopes)), 4),
        min_slope=round(float(np.min(slopes)), 4),
        spatial_autocorrelation=moran_stats
    )

    # Robust cache key incorporating bounding box and significance threshold
    if req.bbox and len(req.bbox) == 4:
        bbox_slug = f"b{int(req.bbox[0])}_{int(req.bbox[1])}_{int(req.bbox[2])}_{int(req.bbox[3])}"
    else:
        bbox_slug = "bdef"
    alpha_slug = f"a{int(req.alpha * 1000)}"
    analysis_id = f"ana_{req.dataset_id}_{req.variable_id}_{req.start_year}_{req.end_year}_{bbox_slug}_{alpha_slug}"

    # Cache for interactive drilldown with thread-safe bounded LRU eviction
    set_cached_analysis(analysis_id, {
        "raw_slice": raw_slice,
        "trend_results": trend_results,
        "contrasts": contrasts,
        "signals": signals,
        "grid": grid_points,
        "summary": summary,
        "req": req
    })

    return AnalysisResponse(
        analysis_id=analysis_id,
        status="completed",
        dataset_id=req.dataset_id,
        variable_id=req.variable_id,
        variable_name=raw_slice["variable_name"],
        display_units=raw_slice["display_units"],
        slope_units=raw_slice["slope_units"],
        time_span=f"{req.start_year} - {req.end_year}",
        summary=summary,
        grid=grid_points,
        contrasts=contrasts,
        provenance=raw_slice["provenance"]
    )


@router.get("/analysis/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: str) -> AnalysisResponse:
    """Retrieve full cached analysis results by ID."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")
    raw_slice = cached["raw_slice"]
    req = cached["req"]

    return AnalysisResponse(
        analysis_id=analysis_id,
        status="completed",
        dataset_id=req.dataset_id,
        variable_id=req.variable_id,
        variable_name=raw_slice["variable_name"],
        display_units=raw_slice["display_units"],
        slope_units=raw_slice["slope_units"],
        time_span=f"{req.start_year} - {req.end_year}",
        summary=cached["summary"],
        grid=cached["grid"],
        contrasts=cached["contrasts"],
        provenance=raw_slice["provenance"]
    )


@router.get("/analysis/{analysis_id}/map", response_model=MapLayerResponse)
def get_analysis_map(analysis_id: str) -> MapLayerResponse:
    """Retrieve spatial grid field and map bounding boundaries."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")
    raw = cached["raw_slice"]
    lats = raw["lat"]
    lons = raw["lon"]
    bounds = [float(np.min(lons)), float(np.min(lats)), float(np.max(lons)), float(np.max(lats))]

    return MapLayerResponse(
        analysis_id=analysis_id,
        variable_id=raw["variable_id"],
        variable_name=raw["variable_name"],
        slope_units=raw["slope_units"],
        bounds=bounds,
        summary=cached["summary"],
        grid=cached["grid"]
    )


@router.get("/analysis/{analysis_id}/timeseries", response_model=CellDetailResponse)
@router.get("/analysis/{analysis_id}/cell", response_model=CellDetailResponse)
def get_cell_timeseries(
    analysis_id: str,
    lat: Optional[float] = Query(None, description="Latitude coordinate"),
    lon: Optional[float] = Query(None, description="Longitude coordinate")
) -> CellDetailResponse:
    """Retrieve time series, fitted trend, and structured evidence record for coordinates."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found or expired.")

    raw = cached["raw_slice"]
    data_3d = raw["data"]
    lats = raw["lat"]
    lons = raw["lon"]
    years = raw["time"]
    time_coords = (years - years[0]) / 10.0

    # If coordinates omitted, default to top candidate signal coordinate
    if lat is None or lon is None:
        if cached.get("signals") and len(cached["signals"]) > 0:
            lat = cached["signals"][0]["lat"]
            lon = cached["signals"][0]["lon"]
        else:
            lat = float(lats[len(lats) // 2])
            lon = float(lons[len(lons) // 2])

    lat_idx = int(np.argmin(np.abs(lats - lat)))
    lon_idx = int(np.argmin(np.abs(lons - lon)))

    series = data_3d[:, lat_idx, lon_idx]
    
    # Calculate Sen's slope and intercept
    sen = sens_slope(series, time_steps=time_coords)
    slope = sen["slope"]
    intercept = sen["intercept"]
    fitted = intercept + slope * time_coords

    # Mann-Kendall statistics
    mk = mann_kendall_test(series, alpha=cached["req"].alpha)
    q_val = float(cached["trend_results"]["q_values"][lat_idx, lon_idx])

    # Pettitt (1979) abrupt regime changepoint test
    pettitt = pettitt_changepoint_test(series, time_coords=years, alpha=cached["req"].alpha)
    cp_year = pettitt.get("changepoint_time")
    cp_pval = pettitt.get("p_value")
    cp_sig = pettitt.get("significant", False)

    # Pull pre-computed CI and LISA from spatial results
    _ci_l_grid = cached["trend_results"].get("ci_lower")
    _ci_u_grid = cached["trend_results"].get("ci_upper")
    _lisa_grid = cached["trend_results"].get("lisa_clusters")
    ci_l = round(float(_ci_l_grid[lat_idx, lon_idx]), 4) if _ci_l_grid is not None else slope
    ci_u = round(float(_ci_u_grid[lat_idx, lon_idx]), 4) if _ci_u_grid is not None else slope
    lisa_lbl = str(_lisa_grid[lat_idx, lon_idx]) if _lisa_grid is not None else "NS"

    valid_obs = int(np.sum(~np.isnan(series)))
    total_obs = len(series)
    pct = (valid_obs / max(1, total_obs)) * 100

    evidence = {
        "observation": f"Calculated {mk['direction']} trend of {slope:+.3f} {raw['slope_units']}.",
        "magnitude": f"{slope:+.4f} {raw['slope_units']}",
        "confidence_interval_95": f"[{ci_l:+.4f}, {ci_u:+.4f}] {raw['slope_units']} (Gilbert 1987)",
        "significance": f"p-value = {mk['p_value']:.4f}, FDR q-value = {q_val:.4f} (Significant: {mk['significant']})",
        "changepoint": (
            f"Abrupt regime shift detected in {cp_year} (p = {cp_pval:.4f})"
            if cp_sig and cp_year else
            f"Gradual monotonic drift (no abrupt changepoint, p = {cp_pval:.4f})"
        ),
        "lisa_cluster": lisa_lbl,
        "method": "Sen's robust median-of-slopes estimator with Mann-Kendall, Hamed-Rao autocorrelation correction, Benjamini-Hochberg FDR, Pettitt changepoint test, and Gilbert (1987) 95% CI",
        "coverage": f"{valid_obs} / {total_obs} valid annual observations ({pct:.1f}% complete)",
        "source": f"{raw['provenance']['source']} (DOI: {raw['provenance']['doi']})",
        "is_synthetic": raw.get("is_synthetic", False),
        "data_source_label": raw.get("data_source_label", "NASA Observations"),
        "scientific_limitation": (
            "Empirical observation of monotonic trend. Does not prove underlying atmospheric "
            "or oceanic causation without physical process attribution."
        )
    }

    return CellDetailResponse(
        lat=float(lats[lat_idx]),
        lon=float(lons[lon_idx]),
        variable_name=raw["variable_name"],
        display_units=raw["display_units"],
        slope_units=raw["slope_units"],
        years=[int(y) for y in years],
        observations=[round(float(v), 2) for v in series],
        fitted_values=[round(float(v), 2) for v in fitted],
        slope=round(slope, 4),
        ci_lower=ci_l,
        ci_upper=ci_u,
        intercept=round(intercept, 4),
        p_value=round(mk["p_value"], 5),
        q_value=round(q_val, 5),
        tau=round(mk["tau"], 4),
        significant=mk["significant"],
        direction=mk["direction"],
        lisa_cluster=lisa_lbl,
        changepoint_year=cp_year,
        changepoint_p_value=cp_pval,
        evidence_record=evidence
    )


@router.get("/analysis/{analysis_id}/signals", response_model=SignalsResponse)
def get_candidate_signals(analysis_id: str) -> SignalsResponse:
    """Discovery Engine: Return candidate signals worth investigating."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")
    raw = cached["raw_slice"]
    signals = [CandidateSignal(**s) for s in cached["signals"]]

    return SignalsResponse(
        analysis_id=analysis_id,
        variable_name=raw["variable_name"],
        method="Composite Discovery Scoring (magnitude * significance * completeness * spatial coherence)",
        criteria=[
            "Statistical significance (FDR q <= 0.05)",
            "Robust slope rate magnitude |Sen's slope|",
            "Temporal data completeness fraction",
            "Spatial neighborhood coherence (8-neighbor cluster consistency)"
        ],
        signals=signals
    )


@router.get("/analysis/{analysis_id}/contrasts", response_model=ContrastsResponse)
def get_analysis_contrasts(analysis_id: str) -> ContrastsResponse:
    """Contrast Engine: Return opposing regional trend pairs."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")
    contrasts = cached["contrasts"]
    raw = cached["raw_slice"]

    return ContrastsResponse(
        analysis_id=analysis_id,
        variable_name=raw["variable_name"],
        contrasts_found=len(contrasts),
        contrasts=contrasts
    )


@router.get("/analysis/{analysis_id}/provenance", response_model=ProvenanceResponse)
def get_analysis_provenance(analysis_id: str) -> ProvenanceResponse:
    """Provenance Engine: Return full data lineage, citations, and validation metadata."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")
    raw = cached["raw_slice"]

    return ProvenanceResponse(
        analysis_id=analysis_id,
        dataset_id=cached["req"].dataset_id,
        provenance=raw["provenance"]
    )


@router.post("/explain", response_model=ExplainResponse)
def explain_evidence(req: ExplainRequest) -> ExplainResponse:
    """Downstream scientific explainer: translates verified evidence into clear scientific prose via Gemini/LLM or deterministic fallback."""
    return explain_evidence_with_ai(req)


@router.get("/analysis/{analysis_id}/export/netcdf")
def export_analysis_netcdf(analysis_id: str):
    """Export full spatial analysis as CF-1.8 compliant NetCDF-4 file (viewable in NASA Panoply/QGIS)."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = cached["grid"]
    trend_results = cached["trend_results"]
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

    out_dir = tempfile.mkdtemp(prefix="earthsift_")
    nc_path = os.path.join(out_dir, f"earthsift_{analysis_id}.nc")
    filename = f"earthsift_{req.variable_id}_{req.start_year}_{req.end_year}.nc"
    try:
        export_to_netcdf(analysis_record, nc_path)
        return FileResponse(
            nc_path,
            media_type="application/x-netcdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            },
            background=BackgroundTask(shutil.rmtree, out_dir, ignore_errors=True)
        )
    except Exception as e:
        shutil.rmtree(out_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"NetCDF export failed: {str(e)}")


@router.get("/analysis/{analysis_id}/export/geojson")
def export_analysis_geojson(analysis_id: str):
    """Export full spatial analysis as GeoJSON FeatureCollection."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = cached["grid"]
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
    filename = f"earthsift_trends_{req.variable_id}_{req.start_year}_{req.end_year}.geojson"
    return JSONResponse(
        content=geojson_dict,
        media_type="application/geo+json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/analysis/{analysis_id}/dossier")
def get_scientific_dossier(analysis_id: str):
    """Generate a publication-quality NASA Climate Science Dossier in Markdown."""
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = cached["grid"]
    trend_results = cached["trend_results"]
    req = cached["req"]

    slopes = [g.slope for g in grid]
    sig_count = sum(1 for g in grid if g.is_significant_fdr)
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
    filename = f"NASA_Climate_Science_Dossier_{req.variable_id}_{req.start_year}_{req.end_year}.md"
    return PlainTextResponse(
        dossier_md,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/analysis/{analysis_id}/export/notebook")
def export_analysis_notebook(analysis_id: str):
    """Export self-contained reproducible Jupyter Notebook (.ipynb) independently verifiable in Google Colab or JupyterLab."""
    import json
    cached = get_cached_analysis(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found.")

    raw = cached["raw_slice"]
    grid = cached["grid"]
    req = cached["req"]

    analysis_record = {
        "variable": req.variable_id,
        "units": raw.get("display_units", ""),
        "is_synthetic": raw.get("is_synthetic", False),
        "provenance": raw.get("provenance", {}),
        "results": {
            "cells": [
                {
                    "lat": g.lat, "lon": g.lon, "slope": g.slope,
                    "p_value": g.p_value, "q_value": g.q_value,
                    "significant": g.is_significant_fdr
                } for g in grid
            ]
        }
    }
    nb_dict = generate_jupyter_notebook(analysis_record)
    content = json.dumps(nb_dict, indent=2)
    filename = f"earthsift_reproducible_{req.variable_id}_{req.start_year}_{req.end_year}.ipynb"
    return PlainTextResponse(
        content=content,
        media_type="application/x-ipynb+json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.post("/analysis/compound", response_model=CompoundHazardResponse)
def run_compound_hazard_analysis(req: CompoundHazardRequest) -> CompoundHazardResponse:
    """
    Spatiotemporal Compound Climate Hazard Engine:
    Cross-analyzes joint thermal and hydrological trends (e.g. T2M warming + PRECTOT drying)
    to calculate the Compound Aridification Index (CAI) and classify regional divergence regimes:
    - Severe Aridification (Warming + Drying hotspot)
    - Hydrological Intensification (Warming + Pluvial extreme)
    - Thermal Buffering (Cooling/Stable + Wetting)
    """
    adapter = ADAPTERS.get(req.dataset_id)
    if not adapter:
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found.")

    # 1. Fetch thermal variable slice
    try:
        slice_t = adapter.fetch_subset(
            variable=req.temp_variable_id,
            start_year=req.start_year,
            end_year=req.end_year,
            bbox=req.bbox,
            prefer_live=req.prefer_live
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Temperature variable error: {str(e)}")

    # 2. Fetch precipitation variable slice
    try:
        slice_p = adapter.fetch_subset(
            variable=req.precip_variable_id,
            start_year=req.start_year,
            end_year=req.end_year,
            bbox=req.bbox,
            prefer_live=req.prefer_live
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Precipitation variable error: {str(e)}")

    # Compute spatial trends for both variables (scaled to decades)
    time_coords_t = (slice_t["time"] - req.start_year) / 10.0
    time_coords_p = (slice_p["time"] - req.start_year) / 10.0
    trend_t = compute_spatial_trends(slice_t["data"], time_coords=time_coords_t, alpha=req.alpha)
    trend_p = compute_spatial_trends(slice_p["data"], time_coords=time_coords_p, alpha=req.alpha)

    # Align spatial dimensions if shapes differ slightly
    t_slopes = trend_t["slopes"]
    p_slopes = trend_p["slopes"]
    min_h = min(t_slopes.shape[0], p_slopes.shape[0])
    min_w = min(t_slopes.shape[1], p_slopes.shape[1])
    t_slopes = t_slopes[:min_h, :min_w]
    p_slopes = p_slopes[:min_h, :min_w]

    t_sig = trend_t["is_significant_fdr"][:min_h, :min_w]
    p_sig = trend_p["is_significant_fdr"][:min_h, :min_w]

    compound_res = compute_compound_hazard(
        temp_slopes=t_slopes,
        precip_slopes=p_slopes,
        temp_sig=t_sig,
        precip_sig=p_sig
    )

    lats = slice_t["lat"][:min_h]
    lons = slice_t["lon"][:min_w]
    cai_map = compound_res["cai_map"]
    hazard_map = compound_res["hazard_classification"]

    cells = []
    dist = {}
    for r in range(min_h):
        for c in range(min_w):
            h_class = str(hazard_map[r, c])
            dist[h_class] = dist.get(h_class, 0) + 1
            cells.append({
                "lat": float(lats[r]),
                "lon": float(lons[c]),
                "temp_slope": float(round(t_slopes[r, c], 4)),
                "precip_slope": float(round(p_slopes[r, c], 4)),
                "cai": float(round(cai_map[r, c], 3)),
                "hazard_class": h_class,
                "hazard_type": h_class,
                "temp_significant": bool(t_sig[r, c]),
                "precip_significant": bool(p_sig[r, c])
            })

    return CompoundHazardResponse(
        dataset_id=req.dataset_id,
        time_span=f"{req.start_year} - {req.end_year}",
        aridification_fraction=compound_res["aridification_fraction"],
        intensification_fraction=compound_res["intensification_fraction"],
        summary=compound_res["summary"],
        hazard_distribution=dist,
        cells=cells
    )
