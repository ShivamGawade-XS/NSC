"""
EarthSift — Omni-Scale Championship Test Suite
Verifies:
1. Burrows et al. (Nature 2011) Climate Velocity Vector Field Engine
2. Archimedean Copula Multi-Hazard Risk & Joint Return Periods
3. Monte Carlo AR(1) Red-Noise Simulation & Non-Parametric Bootstrap CI
4. Natural Language Spatiotemporal Query Parser (NLQ)
5. Multi-Region Difference Inspector (Pin A vs Pin B)
6. NASA Technical Memorandum LaTeX & 1-Click Google Colab Export Endpoints
"""

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.science.climate_velocity import compute_climate_velocity
from app.science.copula_hazard import compute_compound_copula_return_periods, fit_bivariate_copula
from app.science.nlq_parser import parse_natural_language_query
from app.science.trend import bootstrap_sen_confidence_interval, monte_carlo_ar1_significance

client = TestClient(app)


def test_climate_velocity_vector_field():
    """Verify climate velocity magnitude (km/decade) and trajectory bearings."""
    lats = np.linspace(30.0, 40.0, 10)
    lons = np.linspace(-100.0, -90.0, 10)
    # North-South temperature gradient with positive warming trend
    slopes = np.ones((10, 10)) * 0.5  # 0.5 °C/decade
    # Temperature decreases towards the North (lat)
    climatology = np.repeat(np.linspace(25.0, 15.0, 10)[:, np.newaxis], 10, axis=1)

    res = compute_climate_velocity(slopes, lats, lons, mean_climatology=climatology)

    assert "velocity_magnitude" in res
    assert "trajectory_bearing" in res
    assert "vectors" in res
    assert len(res["vectors"]) > 0

    # Under warming with cooler conditions to the North, isotherms migrate Northward (~0° bearing)
    sample_vec = res["vectors"][0]
    assert 0.0 <= sample_vec["bearing_deg"] <= 360.0
    assert sample_vec["velocity_km_decade"] > 0.0
    assert res["summary"]["mean_velocity_km_decade"] > 0.0


def test_climate_velocity_reconstructed_climatology_and_nan_filtering():
    """Verify reconstructed meridional climatology and NaN cell filtering in vectors."""
    lats = np.linspace(30.0, 40.0, 6)
    lons = np.linspace(-100.0, -90.0, 6)
    slopes = np.ones((6, 6)) * 0.4
    # Inject NaN cell
    slopes[0, 0] = np.nan

    # Pass mean_climatology=None to exercise reconstructed meridional profile
    res = compute_climate_velocity(slopes, lats, lons, mean_climatology=None)
    assert "velocity_magnitude" in res
    assert "vectors" in res

    # Ensure no vector corresponds to the NaN cell at (lats[0], lons[0])
    first_lat = round(float(lats[0]), 3)
    first_lon = round(float(lons[0]), 3)
    assert not any(v["lat"] == first_lat and v["lon"] == first_lon for v in res["vectors"])

    # Ensure vectors migrate Northward under warming (~0° bearing)
    for v in res["vectors"]:
        assert not np.isnan(v["velocity_km_decade"])
        assert not np.isnan(v["bearing_deg"])
        assert v["cardinal"] in ["N", "NNW", "NNE"]


def test_copula_bivariate_fitting_and_return_periods():
    """Verify Archimedean Gumbel copula estimation and joint return periods."""
    rng = np.random.default_rng(42)
    # Co-occurring warming and drying
    t_slopes = rng.normal(0.6, 0.2, (8, 8))
    p_slopes = rng.normal(-0.4, 0.15, (8, 8))

    copula_info = fit_bivariate_copula(t_slopes.flatten(), -p_slopes.flatten(), copula_type="gumbel")
    assert copula_info["copula_type"] == "gumbel"
    assert copula_info["theta"] >= 1.0

    ret_res = compute_compound_copula_return_periods(t_slopes, p_slopes, base_timestep_years=10.0)
    assert "joint_return_periods_years" in ret_res
    assert ret_res["max_return_period_years"] >= 10.0
    assert "compound_extreme_cells" in ret_res


def test_copula_negative_correlation_independence_bound():
    """Verify that negatively correlated (x, y) yields theta == 1.0 and tail_dependence == 0.0."""
    x = np.linspace(1.0, 10.0, 20)
    y = -np.linspace(1.0, 10.0, 20)  # Perfectly negatively correlated: tau == -1.0

    gumbel_res = fit_bivariate_copula(x, y, copula_type="gumbel")
    assert gumbel_res["tau"] < 0.0
    assert gumbel_res["theta"] == 1.0
    assert gumbel_res["tail_dependence"] == 0.0

    clayton_res = fit_bivariate_copula(x, y, copula_type="clayton")
    assert clayton_res["tau"] < 0.0
    assert clayton_res["theta"] == 0.0
    assert clayton_res["tail_dependence"] == 0.0

    # Also test evaluate_gumbel_cdf at independence bound (theta <= 1.0 + 1e-6)
    from app.science.copula_hazard import evaluate_gumbel_cdf
    u = np.array([0.2, 0.5, 0.8])
    v = np.array([0.3, 0.6, 0.9])
    cdf = evaluate_gumbel_cdf(u, v, theta=1.0)
    np.testing.assert_allclose(cdf, u * v, atol=1e-5)

    # Verify compound_extreme_cells excludes wetting or cooling cells
    t_slopes = np.ones((5, 5)) * 0.5
    p_slopes = np.ones((5, 5)) * 0.5  # wetting!
    ret_res = compute_compound_copula_return_periods(t_slopes, p_slopes)
    assert ret_res["compound_extreme_cells"] == 0


def test_monte_carlo_ar1_significance_and_bootstrap():
    """Verify red-noise surrogate simulation and bootstrap confidence intervals."""
    # Strong upward trend with low noise
    t = np.arange(25, dtype=float)
    strong_trend = 10.0 + 0.5 * t + np.random.default_rng(99).normal(0.0, 0.1, 25)

    mc_res = monte_carlo_ar1_significance(strong_trend, n_simulations=100, alpha=0.05)
    assert mc_res["passes_red_noise_test"] is True
    assert mc_res["empirical_p_value"] < 0.05

    boot_res = bootstrap_sen_confidence_interval(strong_trend, t, n_boot=100)
    assert boot_res["bootstrap_ci_lower"] <= boot_res["bootstrap_ci_upper"]
    assert 0.4 <= boot_res["bootstrap_ci_lower"] <= 0.6


def test_nlq_query_parser():
    """Verify natural language query parsing into structured AnalysisRequest."""
    query = "Show me warming trends in North America from 1995 to 2022 with high confidence"
    res = parse_natural_language_query(query)

    assert res.analysis_request.variable_id == "T2M"
    assert res.analysis_request.start_year == 1995
    assert res.analysis_request.end_year == 2022
    assert res.analysis_request.alpha == 0.01  # 'high confidence'
    assert res.analysis_request.bbox is not None
    assert "North America" in res.matched_regions

    # Verify 'wind' resolves to 'WS10M' and 'Texas' resolves to Texas bounding box
    wind_texas_query = "Assess wind trends in Texas over the past 15 years"
    res_wind = parse_natural_language_query(wind_texas_query)
    assert res_wind.analysis_request.variable_id == "WS10M"
    assert res_wind.analysis_request.dataset_id == "nasa_power"
    assert res_wind.analysis_request.bbox == [-106.6, 25.8, -93.5, 36.5]
    assert "Texas" in res_wind.matched_regions
    assert res_wind.analysis_request.end_year == 2023
    assert res_wind.analysis_request.start_year == 2008  # 2023 - 15

    # Relative temporal window with 'last 20 years' and humidity/moisture -> RH2M
    humidity_query = "Analyze humidity in southern plains for the last 20 years"
    res_humidity = parse_natural_language_query(humidity_query)
    assert res_humidity.analysis_request.variable_id == "RH2M"
    assert res_humidity.analysis_request.dataset_id == "nasa_power"
    assert res_humidity.analysis_request.bbox == [-102.0, 30.0, -94.0, 38.0]
    assert res_humidity.analysis_request.end_year == 2023
    assert res_humidity.analysis_request.start_year == 2003  # 2023 - 20


def test_nlq_endpoint():
    """Verify /copilot/parse-query endpoint returns valid Pydantic schema."""
    payload = {"query": "Mediterranean rainfall drought between 1990 and 2020"}
    res = client.post("/copilot/parse-query", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["analysis_request"]["variable_id"] == "PRECTOT"
    assert data["analysis_request"]["start_year"] == 1990
    assert data["analysis_request"]["end_year"] == 2020


def test_climate_velocity_and_colab_and_latex_endpoints():
    """Verify /velocity, /export/colab, and /export/latex endpoints against active analysis."""
    # Run analysis first
    ana_res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020
    })
    assert ana_res.status_code == 200
    analysis_id = ana_res.json()["analysis_id"]

    # 1. Test /velocity
    vel_res = client.get(f"/analysis/{analysis_id}/velocity")
    assert vel_res.status_code == 200
    vel_data = vel_res.json()
    assert "vectors" in vel_data
    assert len(vel_data["vectors"]) > 0
    assert "summary" in vel_data

    # 2. Test /export/colab
    colab_res = client.get(f"/analysis/{analysis_id}/export/colab")
    assert colab_res.status_code == 200
    colab_data = colab_res.json()
    assert "colab_launcher_url" in colab_data
    assert "badge_markdown" in colab_data

    # 3. Test /export/latex
    latex_res = client.get(f"/analysis/{analysis_id}/export/latex")
    assert latex_res.status_code == 200
    assert "\\documentclass" in latex_res.text
    assert "\\begin{document}" in latex_res.text
    assert "NASA Technical Memorandum" in latex_res.text


def test_compare_locations_endpoint():
    """Verify Pin A vs Pin B dual-site comparative analytics."""
    ana_res = client.post("/analysis", json={
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020
    })
    analysis_id = ana_res.json()["analysis_id"]

    comp_res = client.post("/analysis/compare", json={
        "analysis_id": analysis_id,
        "lat_a": 35.0,
        "lon_a": -100.0,
        "lat_b": 50.0,
        "lon_b": -80.0
    })
    assert comp_res.status_code == 200
    data = comp_res.json()
    assert "delta_slope" in data
    assert "cross_correlation_r" in data
    assert "loc_a" in data
    assert "loc_b" in data
    assert "regime_divergence_summary" in data


def test_copula_in_compound_hazard_endpoint():
    """Verify /analysis/compound returns Archimedean Copula metrics."""
    res = client.post("/analysis/compound", json={
        "dataset_id": "merra2_reanalysis",
        "temp_variable_id": "T2M",
        "precip_variable_id": "PRECTOT",
        "start_year": 2000,
        "end_year": 2020
    })
    assert res.status_code == 200
    data = res.json()
    assert "copula_model" in data
    assert "max_return_period_years" in data
    assert "compound_extreme_cells" in data
    assert "Archimedean Copula" in data["summary"]
