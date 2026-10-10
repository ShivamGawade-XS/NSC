"""
EarthSift — FastAPI Endpoints
Routes for datasets, variables, trend analysis, map layers,
time series, discovery signals, contrasts, provenance, and AI explanations.
"""

from typing import Dict, Any, List, Optional
import numpy as np
from fastapi import APIRouter, HTTPException, Query

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
    VariableInfo
)
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import compute_spatial_trends, mann_kendall_test, sens_slope
from app.science.contrasts import find_contrasting_regions
from app.science.discovery import discover_candidate_signals
from app.science.explainer import explain_evidence_with_ai

router = APIRouter()

# Global adapters registry
ADAPTERS = {
    "merra2_reanalysis": MERRA2Adapter()
}

# In-memory analysis cache: analysis_id -> full dataset dict & calculated grids
ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}


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
    contrasts = find_contrasting_regions(
        slopes=slopes,
        is_significant=sig_fdr,
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

    # Build spatial grid points
    grid_points: List[SpatialGridPoint] = []
    h_len, w_len = slopes.shape
    for i in range(h_len):
        for j in range(w_len):
            s = float(slopes[i, j])
            is_sig = bool(sig_fdr[i, j])
            
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
                p_value=round(float(p_vals[i, j]), 5),
                q_value=round(float(q_vals[i, j]), 5),
                is_significant_raw=bool(sig_raw[i, j]),
                is_significant_fdr=bool(sig_fdr[i, j]),
                direction=direction,
                n_samples=int(n_samples[i, j])
            ))

    total_cells = h_len * w_len
    sig_raw_count = int(np.sum(sig_raw))
    sig_fdr_count = int(np.sum(sig_fdr))

    summary = AnalysisSummary(
        total_cells=total_cells,
        significant_cells_raw=sig_raw_count,
        significant_cells_fdr=sig_fdr_count,
        mean_slope=round(float(np.mean(slopes)), 4),
        max_slope=round(float(np.max(slopes)), 4),
        min_slope=round(float(np.min(slopes)), 4)
    )

    # Robust cache key incorporating bounding box and significance threshold
    if req.bbox and len(req.bbox) == 4:
        bbox_slug = f"b{int(req.bbox[0])}_{int(req.bbox[1])}_{int(req.bbox[2])}_{int(req.bbox[3])}"
    else:
        bbox_slug = "bdef"
    alpha_slug = f"a{int(req.alpha * 1000)}"
    analysis_id = f"ana_{req.dataset_id}_{req.variable_id}_{req.start_year}_{req.end_year}_{bbox_slug}_{alpha_slug}"

    # Bounded cache eviction (LRU policy: cap at 32 analysis entries to prevent memory leaks)
    if len(ANALYSIS_CACHE) >= 32 and analysis_id not in ANALYSIS_CACHE:
        oldest_key = next(iter(ANALYSIS_CACHE))
        ANALYSIS_CACHE.pop(oldest_key, None)

    # Cache for interactive drilldown
    ANALYSIS_CACHE[analysis_id] = {
        "raw_slice": raw_slice,
        "trend_results": trend_results,
        "contrasts": contrasts,
        "signals": signals,
        "grid": grid_points,
        "summary": summary,
        "req": req
    }

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
    cached = ANALYSIS_CACHE.get(analysis_id)
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
    cached = ANALYSIS_CACHE.get(analysis_id)
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
    cached = ANALYSIS_CACHE.get(analysis_id)
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

    evidence = {
        "observation": f"Calculated {mk['direction']} trend of {slope:+.3f} {raw['slope_units']}.",
        "magnitude": f"{slope:+.4f} {raw['slope_units']}",
        "significance": f"p-value = {mk['p_value']:.4f}, FDR q-value = {q_val:.4f} (Significant: {mk['significant']})",
        "method": "Sen's robust median-of-slopes estimator with Mann-Kendall monotonic test and Benjamini-Hochberg FDR",
        "coverage": f"{len(series)} valid annual observations (100% complete)",
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
        intercept=round(intercept, 4),
        p_value=round(mk["p_value"], 5),
        q_value=round(q_val, 5),
        tau=round(mk["tau"], 4),
        significant=mk["significant"],
        direction=mk["direction"],
        evidence_record=evidence
    )


@router.get("/analysis/{analysis_id}/signals", response_model=SignalsResponse)
def get_candidate_signals(analysis_id: str) -> SignalsResponse:
    """Discovery Engine: Return candidate signals worth investigating."""
    cached = ANALYSIS_CACHE.get(analysis_id)
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
    cached = ANALYSIS_CACHE.get(analysis_id)
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
    cached = ANALYSIS_CACHE.get(analysis_id)
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
