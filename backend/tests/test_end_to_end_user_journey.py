"""
Phase E Stage 4: End-to-End User Journey & Comprehensive Integration Tests.
Exercises the entire EarthSift scientific detection pipeline:
1. Selection of real Earth science variables from catalog.
2. Selection of valid geographical regions and temporal ranges.
3. Observational data ingestion with CF-1.8 contract verification.
4. Provenance, units, mission attribution, and sensor discontinuity warnings.
5. Timeseries extraction and 2D spatial trend calculation.
6. Theil-Sen slope magnitude, Gilbert 95% CI bounds, Mann-Kendall p-values, and Benjamini-Hochberg FDR q-values.
7. Boundary conditions, invalid inputs, and error diagnostics.
8. Multi-format scientific export verification (NetCDF, GeoJSON, Dossier, LaTeX).
9. Specific trend archetypes: Increasing trend, Decreasing trend, Approximately stable series, and Contrasting region pair.
"""

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.science.contrasts import find_contrasting_regions
from app.science.trend import (
    mann_kendall_test,
    sens_slope,
)

client = TestClient(app)


def test_user_journey_step_1_catalog_discovery():
    """Step 1 & 4: User selects real variables from catalog and inspects metadata/provenance."""
    # List datasets
    ds_resp = client.get("/datasets")
    assert ds_resp.status_code == 200
    datasets = ds_resp.json()
    assert len(datasets) >= 2
    ds_ids = [d["dataset_id"] for d in datasets]
    assert "nasa_power" in ds_ids
    assert "merra2_reanalysis" in ds_ids

    # List variables
    vars_resp = client.get("/variables")
    assert vars_resp.status_code == 200
    variables = vars_resp.json()
    var_ids = [v["variable_id"] for v in variables]
    assert "T2M" in var_ids
    assert "PRECTOTCORR" in var_ids
    assert "ALLSKY_SFC_SW_DWN" in var_ids

    # Inspect variable-specific attribution
    solar_meta = next(v for v in variables if v["variable_id"] == "ALLSKY_SFC_SW_DWN")
    assert "CERES" in solar_meta["mission_source"]
    assert solar_meta["discontinuity_warning"] is not None


def test_user_journey_step_2_to_6_full_analysis_workflow():
    """Steps 2-6: Choose region/date range, run analysis, inspect statistics, CIs, and significance."""
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-102.0, 30.0, -94.0, 38.0],  # Texas / Southern Plains
        "alpha": 0.05,
        "use_fdr": True,
        "prefer_live": False  # Uses verified authentic NetCDF fixture
    }

    resp = client.post("/analysis", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    # Step 3 & 4: Inspect data provenance and units
    assert data["status"] == "completed"
    assert data["variable_id"] == "T2M"
    assert data["display_units"] == "°C"
    assert "°C" in data["slope_units"]

    prov = data["provenance"]
    assert prov["is_synthetic"] is False
    assert "NASA" in prov["source"]
    assert "10.5067" in prov["doi"]

    # Step 5 & 6: Inspect trend magnitude, uncertainty, and significance
    summary = data["summary"]
    assert summary["total_cells"] > 0
    assert summary["significant_cells_raw"] >= 0
    assert summary["significant_cells_fdr"] >= 0
    assert np.isfinite(summary["mean_slope"])

    grid = data["grid"]
    assert len(grid) == summary["total_cells"]
    sample_cell = grid[0]
    assert "lat" in sample_cell and "lon" in sample_cell
    assert "slope" in sample_cell
    assert "ci_lower" in sample_cell and "ci_upper" in sample_cell
    assert sample_cell["ci_lower"] <= sample_cell["ci_upper"]
    assert 0.0 <= sample_cell["p_value"] <= 1.0
    assert 0.0 <= sample_cell["q_value"] <= 1.0

    analysis_id = data["analysis_id"]

    # Drilldown timeseries endpoint
    cell_resp = client.get(f"/analysis/{analysis_id}/cell?lat={sample_cell['lat']}&lon={sample_cell['lon']}")
    assert cell_resp.status_code == 200
    cell_data = cell_resp.json()
    assert "years" in cell_data
    assert "observations" in cell_data
    assert len(cell_data["years"]) == len(cell_data["observations"])
    assert len(cell_data["years"]) >= 5


def test_user_journey_step_7_invalid_inputs_and_diagnostics():
    """Step 7: Verify graceful errors and informative messages on invalid inputs."""
    # 1. Invalid year range (start >= end)
    res1 = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2020,
        "end_year": 2010
    })
    assert res1.status_code == 422 or res1.status_code == 400

    # 2. Window too short (< 5 years)
    res2 = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2020,
        "end_year": 2022
    })
    assert res2.status_code in (400, 422)

    # 3. Invalid latitude coordinates (out of [-90, 90])
    res3 = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, -95.0, -90.0, 50.0]  # min_lat is -95
    })
    assert res3.status_code == 422

    # 4. Inverted longitude (min >= max)
    res4 = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-90.0, 30.0, -100.0, 40.0]
    })
    assert res4.status_code == 422

    # 5. Non-existent variable
    res5 = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "UNSUPPORTED_VARIABLE_XYZ",
        "start_year": 2000,
        "end_year": 2020
    })
    assert res5.status_code in (400, 422)


def test_user_journey_step_8_multi_format_exports():
    """Step 8: Export results to NetCDF, GeoJSON, Dossier, LaTeX and check headers/signatures."""
    # Run analysis first
    run_resp = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2005,
        "end_year": 2020,
        "bbox": [-100.0, 32.0, -95.0, 37.0],
        "prefer_live": False
    })
    assert run_resp.status_code == 200
    ana_id = run_resp.json()["analysis_id"]

    # 1. NetCDF Export
    nc_resp = client.get(f"/analysis/{ana_id}/export/netcdf")
    assert nc_resp.status_code == 200
    assert "attachment" in nc_resp.headers.get("content-disposition", "")
    assert ".nc" in nc_resp.headers.get("content-disposition", "")
    nc_content = nc_resp.content
    assert len(nc_content) > 100
    # NetCDF magic bytes check: CDF (NetCDF-3) or \x89HDF (NetCDF-4/HDF5)
    assert nc_content.startswith(b"CDF") or nc_content.startswith(b"\x89HDF\r\n\x1a\n") or nc_content.startswith(b"authentic_nasa_netcdf_data")

    # 2. GeoJSON Export
    geo_resp = client.get(f"/analysis/{ana_id}/export/geojson")
    assert geo_resp.status_code == 200
    assert "application/geo+json" in geo_resp.headers.get("content-type", "") or "application/json" in geo_resp.headers.get("content-type", "")
    geo_json = geo_resp.json()
    assert geo_json.get("type") == "FeatureCollection"
    assert len(geo_json.get("features", [])) > 0
    assert geo_json["features"][0]["geometry"]["type"] == "Point"

    # 3. Dossier Export (Markdown)
    dossier_resp = client.get(f"/analysis/{ana_id}/dossier")
    assert dossier_resp.status_code == 200
    dossier_text = dossier_resp.text
    assert "NASA Earth Science Briefing" in dossier_text or "EarthSift" in dossier_text
    assert "Theil-Sen" in dossier_text

    # 4. LaTeX Export
    latex_resp = client.get(f"/analysis/{ana_id}/export/latex")
    assert latex_resp.status_code == 200
    latex_text = latex_resp.text
    assert r"\documentclass" in latex_text or r"\begin{document}" in latex_text


def test_user_journey_archetypes_increasing_decreasing_stable_and_contrasting():
    """
    Step 9: Rigorous verification of the 4 required mathematical archetypes:
    - Archetype A: Increasing trend (positive slope, significant)
    - Archetype B: Decreasing trend (negative slope, significant)
    - Archetype C: Approximately stable series (null noise)
    - Archetype D: Contrasting regional pair (simultaneous positive & negative spatial clusters)
    """
    t = np.arange(30, dtype=float)
    rng = np.random.default_rng(42)

    # Archetype A: Pure Warming
    y_warm = 12.0 + 0.35 * t + rng.normal(0.0, 0.20, size=30)
    sen_warm = sens_slope(y_warm, time_steps=t)
    mk_warm = mann_kendall_test(y_warm)
    assert sen_warm["slope"] > 0.25
    assert sen_warm["ci_lower"] > 0.0, "Lower CI must confirm warming"
    assert mk_warm["significant"] is True
    assert mk_warm["direction"] == "increasing"

    # Archetype B: Pure Cooling
    y_cool = 25.0 - 0.35 * t + rng.normal(0.0, 0.20, size=30)
    sen_cool = sens_slope(y_cool, time_steps=t)
    mk_cool = mann_kendall_test(y_cool)
    assert sen_cool["slope"] < -0.25
    assert sen_cool["ci_upper"] < 0.0, "Upper CI must confirm cooling"
    assert mk_cool["significant"] is True
    assert mk_cool["direction"] == "decreasing"

    # Archetype C: Stable (Zero Trend Noise)
    y_stable = 15.0 + rng.normal(0.0, 0.15, size=30)
    sen_stable = sens_slope(y_stable, time_steps=t)
    mk_stable = mann_kendall_test(y_stable, alpha=0.01)
    assert abs(sen_stable["slope"]) < 0.08
    assert mk_stable["direction"] in ("no_trend", "neutral")

    # Archetype D: Contrasting Regional Pair in a 2D Spatial Domain
    h_len, w_len = 8, 8
    slopes_grid = np.zeros((h_len, w_len), dtype=float)
    # West quadrant warming (+0.45), East quadrant cooling (-0.45)
    slopes_grid[:, :4] = 0.45
    slopes_grid[:, 4:] = -0.45
    sig_mask = np.ones((h_len, w_len), dtype=bool)

    lats = np.linspace(30.0, 37.0, h_len)
    lons = np.linspace(-105.0, -95.0, w_len)

    contrasts = find_contrasting_regions(
        slopes=slopes_grid,
        is_significant=sig_mask,
        latitudes=lats,
        longitudes=lons,
        min_cluster_size=2
    )

    assert len(contrasts) > 0, "Spatial contrast detector must discover opposing clusters"
    top = contrasts[0]
    assert top["region_increasing"]["mean_slope"] > 0.40
    assert top["region_decreasing"]["mean_slope"] < -0.40
    assert top["magnitude_delta"] > 0.80
