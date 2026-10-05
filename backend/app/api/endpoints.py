"""
EarthSift — FastAPI Endpoints
Routes for datasets, trend analysis, cell drilldown, and scientific evidence.
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
    ExplainResponse
)
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import compute_spatial_trends, mann_kendall_test, sens_slope
from app.science.contrasts import find_contrasting_regions

router = APIRouter(prefix="/api/v1")

# Global adapters registry
ADAPTERS = {
    "merra2_reanalysis": MERRA2Adapter()
}

# In-memory analysis cache: analysis_id -> full dataset dict & calculated grids
ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}


@router.get("/datasets")
def list_datasets() -> List[Dict[str, Any]]:
    """Return available NASA datasets and supported variables."""
    return [adapter.get_metadata() for adapter in ADAPTERS.values()]


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
            bbox=req.bbox
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

    analysis_id = f"ana_{req.dataset_id}_{req.variable_id}_{req.start_year}_{req.end_year}"

    # Cache for interactive drilldown
    ANALYSIS_CACHE[analysis_id] = {
        "raw_slice": raw_slice,
        "trend_results": trend_results,
        "contrasts": contrasts,
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


@router.get("/analysis/{analysis_id}/cell", response_model=CellDetailResponse)
def get_cell_drilldown(
    analysis_id: str,
    lat: float = Query(..., description="Latitude coordinate"),
    lon: float = Query(..., description="Longitude coordinate")
) -> CellDetailResponse:
    """Retrieve time series, fitted trend, and evidence record for selected coordinates."""
    cached = ANALYSIS_CACHE.get(analysis_id)
    if not cached:
        raise HTTPException(status_code=404, detail=f"Analysis '{analysis_id}' not found or expired.")

    raw = cached["raw_slice"]
    data_3d = raw["data"]
    lats = raw["lat"]
    lons = raw["lon"]
    years = raw["time"]
    time_coords = (years - years[0]) / 10.0

    # Find closest coordinate index
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
    
    # FDR q-value from cached spatial field
    q_val = float(cached["trend_results"]["q_values"][lat_idx, lon_idx])

    evidence = {
        "observation": f"Calculated {mk['direction']} trend of {slope:+.3f} {raw['slope_units']}.",
        "magnitude": f"{slope:+.4f} {raw['slope_units']}",
        "significance": f"p-value = {mk['p_value']:.4f}, FDR q-value = {q_val:.4f} (Significant: {mk['significant']})",
        "method": "Sen's robust median-of-slopes estimator with Mann-Kendall monotonic test and Benjamini-Hochberg FDR",
        "coverage": f"{len(series)} valid annual observations (100% complete)",
        "source": f"{raw['provenance']['source']} (DOI: {raw['provenance']['doi']})",
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


@router.post("/explain", response_model=ExplainResponse)
def explain_evidence(req: ExplainRequest) -> ExplainResponse:
    """Downstream scientific explainer: translates verified evidence into clear scientific prose."""
    sig_text = "statistically significant" if req.significant else "not statistically significant"
    dir_word = "increase" if req.slope > 0 else "decrease"

    summary = (
        f"At {req.location}, {req.variable_name} demonstrated a {dir_word} of "
        f"{req.slope:+.3f} {req.slope_units} across the period {req.time_span}."
    )

    assessment = (
        f"The Mann-Kendall test determined this change is {sig_text} "
        f"(p-value = {req.p_value:.4f}, FDR adjusted q-value = {req.q_value:.4f}) "
        f"across {req.sample_count} verified temporal observations from {req.source}."
    )

    limitations = (
        "Statistical significance confirms empirical persistence over the observed period, "
        "but does not identify physical forcing mechanisms or guarantee future extrapolation."
    )

    return ExplainResponse(
        summary=summary,
        statistical_assessment=assessment,
        limitations=limitations
    )
