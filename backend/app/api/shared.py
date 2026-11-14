"""
Tellura — API Shared State, Cache & Utility Helpers.
Provides thread-safe in-memory cache, compute concurrency semaphores,
adapters registry, and shared helper routines across API routers.
"""
import logging
import math
import os
import re
import threading
from collections import OrderedDict
from typing import Any

import numpy as np
from fastapi import HTTPException

from app.adapters.merra2 import MERRA2Adapter
from app.adapters.nasa_power import NASAPowerAdapter
from app.adapters.planetary_computer import PlanetaryComputerSTACAdapter
from app.core.config import Settings
from app.core.db_cache import load_from_db_cache, normalize_cache_params, save_to_db_cache
from app.schemas.analysis import AnalysisRequest, CellDetailResponse
from app.science.attribution import compute_event_attribution
from app.science.trend import (
    mann_kendall_test,
    pettitt_changepoint_test,
    sens_slope,
)

logger = logging.getLogger("Tellura.api")

# Global adapters registry
ADAPTERS = {
    "merra2_reanalysis": MERRA2Adapter(),
    "nasa_power": NASAPowerAdapter(),
    "planetary_computer": PlanetaryComputerSTACAdapter(),
}

# Thread-safe in-memory LRU analysis cache
CACHE_LOCK = threading.Lock()
ANALYSIS_CACHE: OrderedDict[str, dict[str, Any]] = OrderedDict()

# Concurrency semaphore protecting compute resources against memory/CPU saturation on free tiers
COMPUTE_SEMAPHORE = threading.Semaphore(int(os.getenv("MAX_CONCURRENT_COMPUTATIONS", "2")))


def get_cached_analysis(analysis_id: str) -> dict[str, Any] | None:
    """Retrieve analysis from cache with thread-safe LRU ordering and L2 SQLite fallback."""
    with CACHE_LOCK:
        if analysis_id in ANALYSIS_CACHE:
            ANALYSIS_CACHE.move_to_end(analysis_id)
            return ANALYSIS_CACHE[analysis_id]

    # L2 persistent SQLite database cache lookup via B-Tree index
    db_payload = load_from_db_cache(analysis_id)
    if db_payload:
        with CACHE_LOCK:
            ANALYSIS_CACHE[analysis_id] = db_payload
            while len(ANALYSIS_CACHE) > Settings.CACHE_MAX_SIZE:
                ANALYSIS_CACHE.popitem(last=False)
        return db_payload
    return None


def set_cached_analysis(analysis_id: str, value: dict[str, Any], max_size: int | None = None) -> None:
    """Store analysis in cache with thread-safe bounded LRU eviction and indexed SQLite persistence."""
    effective_max = max_size if max_size is not None else Settings.CACHE_MAX_SIZE
    with CACHE_LOCK:
        if analysis_id in ANALYSIS_CACHE:
            ANALYSIS_CACHE.move_to_end(analysis_id)
        ANALYSIS_CACHE[analysis_id] = value
        while len(ANALYSIS_CACHE) > effective_max:
            ANALYSIS_CACHE.popitem(last=False)

    # L2 SQLite indexed persistence
    save_to_db_cache(analysis_id, value)


def _generate_analysis_id(req: AnalysisRequest) -> str:
    """Generate deterministic, quantized cache identifier preventing sub-degree and alpha collisions."""
    norm = normalize_cache_params(
        req.dataset_id, req.variable_id, req.start_year, req.end_year, req.bbox, req.alpha, req.use_fdr
    )
    _, _, _, _, q_bbox, q_alpha, _ = norm

    def _coord_slug(c: float) -> str:
        r = round(float(c), 3)
        return str(int(r)) if r.is_integer() else str(r)

    if req.bbox and len(req.bbox) == 4:
        bbox_slug = f"b{_coord_slug(q_bbox[0])}_{_coord_slug(q_bbox[1])}_{_coord_slug(q_bbox[2])}_{_coord_slug(q_bbox[3])}"
    else:
        bbox_slug = "bdef"
    alpha_slug = f"a{int(round(q_alpha * 1000))}"
    fdr_slug = "" if req.use_fdr else "_raw"
    return f"ana_{req.dataset_id}_{req.variable_id}_{req.start_year}_{req.end_year}_{bbox_slug}_{alpha_slug}{fdr_slug}"


def sanitize_attachment_filename(prefix: str, var_id: Any, start: Any, end: Any, ext: str) -> str:
    """
    Sanitize filename tokens to prevent Content-Disposition parameter escaping,
    HTTP header injection, path traversal, or non-ASCII control characters.
    """
    clean_prefix = re.sub(r"[^a-zA-Z0-9_\-]", "", str(prefix))
    clean_var = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(var_id))
    clean_var = re.sub(r"_+", "_", clean_var).strip("_") or "variable"
    clean_start = re.sub(r"[^a-zA-Z0-9_\-]", "", str(start))
    clean_end = re.sub(r"[^a-zA-Z0-9_\-]", "", str(end))
    clean_ext = re.sub(r"[^a-zA-Z0-9]", "", str(ext).lstrip("."))
    return f"{clean_prefix}_{clean_var}_{clean_start}_{clean_end}.{clean_ext}"


def _compute_cell_detail(
    analysis_id: str,
    lat: float | None = None,
    lon: float | None = None
) -> CellDetailResponse:
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

    cell_cache = cached.setdefault("_cell_cache", {})
    cache_key = (lat_idx, lon_idx)
    if cache_key in cell_cache:
        cached_entry = cell_cache[cache_key]
        if isinstance(cached_entry, CellDetailResponse):
            return cached_entry

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

    # Stott et al. (2004) / Otto et al. (2020) Fraction of Attributable Risk (FAR)
    attribution = compute_event_attribution(
        slope=float(slope),
        n_years=len(years),
        series=series,
        alpha=cached["req"].alpha
    )

    # Hawkins & Sutton (2012) Signal-to-Noise Ratio (SNR) / IPCC AR6 Time of Emergence (ToE)
    residuals = series - fitted
    noise_sigma = float(np.nanstd(residuals))
    total_change = abs(float(slope) * (float(years[-1]) - float(years[0])) / 10.0)
    snr = round(float(total_change / max(noise_sigma, 1e-6)), 2)
    if snr >= 2.0:
        emergence_status = "Emergent Signal (Trend > 2σ natural noise; IPCC AR6 ToE)"
    elif snr >= 1.0:
        emergence_status = "Emerging Signal (Trend > 1σ natural noise)"
    else:
        emergence_status = "Noise Dominated (Natural interannual variability exceeds trend)"

    # Decoupling Natural Oscillations (ENSO/PDO) & Variance Explained
    tot_var = float(np.nanvar(series))
    fit_var = float(np.nanvar(fitted))
    var_exp = round(float(min(100.0, max(0.0, (fit_var / max(tot_var, 1e-6)) * 100.0))), 1)

    base_var_s = (valid_obs * (valid_obs - 1) * (2 * valid_obs + 5)) / 18.0 if valid_obs >= 5 else 1.0
    vif = round(float(max(1.0, float(mk.get("var_s", base_var_s)) / max(base_var_s, 1e-6))), 2)

    if var_exp >= 50.0 and snr >= 2.0:
        decoupling_status = (
            f"Secular Anthropogenic Emergence: Monotonic trend accounts for {var_exp}% of total variance "
            f"(SNR {snr:.2f} > 2σ). Natural oscillation noise decoupled."
        )
    elif vif >= 1.20:
        decoupling_status = (
            f"Cyclical Red-Noise Persistence Detected (ENSO/PDO mode). "
            f"Hamed-Rao expanded variance by +{round((vif - 1.0) * 100)}% (VIF = {vif}) to suppress false-alarm trend detection."
        )
    else:
        decoupling_status = (
            f"Natural Interannual Oscillations Preponderant: Monotonic drift explains only {var_exp}% of total variance. "
            f"Residual variability reflects internal climate cycles."
        )

    evidence = {
        "observation": f"Calculated {mk['direction']} trend of {slope:+.3f} {raw['slope_units']}.",
        "magnitude": f"{slope:+.4f} {raw['slope_units']}",
        "confidence_interval_95": f"[{ci_l:+.4f}, {ci_u:+.4f}] {raw['slope_units']} (Gilbert 1987)",
        "significance": f"p-value = {mk['p_value']:.4f}, FDR q-value = {q_val:.4f} (Significant: {mk['significant']})",
        "signal_to_noise": snr,
        "emergence_status": emergence_status,
        "variance_explained_pct": var_exp,
        "variance_inflation_factor": vif,
        "oscillation_decoupling_status": decoupling_status,
        "snr_interpretation": (
            f"SNR = {snr:.2f} (Total change: {total_change:.2f} {raw['display_units']}, Residual σ: {noise_sigma:.2f}). "
            f"Hawkins & Sutton (2012) Time of Emergence (ToE) threshold: SNR >= 2.0 signifies departure from historical noise envelope."
        ),
        "changepoint": (
            f"Abrupt regime shift detected in {cp_year} (p = {cp_pval:.4f})"
            if cp_sig and cp_year else
            f"Gradual monotonic drift (no abrupt changepoint, p = {cp_pval:.4f})"
        ),
        "lisa_cluster": lisa_lbl,
        "attribution": attribution,
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

    resp_obj = CellDetailResponse(
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
        z=round(float(mk["z"]), 3) if mk.get("z") is not None and math.isfinite(float(mk["z"])) else None,
        significant=mk["significant"],
        direction=mk["direction"],
        lisa_cluster=lisa_lbl,
        changepoint_year=cp_year,
        changepoint_p_value=cp_pval,
        signal_to_noise=snr,
        emergence_status=emergence_status,
        variance_explained_pct=var_exp,
        variance_inflation_factor=vif,
        oscillation_decoupling_status=decoupling_status,
        evidence_record=evidence
    )
    cell_cache[cache_key] = resp_obj
    return resp_obj

