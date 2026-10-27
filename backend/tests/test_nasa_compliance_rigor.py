"""
TDD Suite: NASA Space Apps Challenge 2026 Compliance & Rigor Verification.
Tests newly required capabilities and edge-case boundaries:
1. High-latitude Arctic polar area-weighting stability in contrasting regions.
2. Mission and model provenance metadata enrichment (MODIS, AIRS, GPM, GEOS-5).
3. Dynamic GitHub repository configuration for 1-click Colab reproducibility.
4. Theil-Sen & Mann-Kendall resilience against high-density ties and extreme outliers.
5. Actionable provenance guidance for NASA POWER extent clamping.
"""

import numpy as np
from fastapi.testclient import TestClient

from app.adapters.merra2 import MERRA2Adapter
from app.adapters.nasa_power import NASAPowerAdapter
from app.core.config import settings
from app.main import app
from app.science.contrasts import find_contrasting_regions
from app.science.trend import mann_kendall_test, sens_slope


def test_polar_latitude_area_weighting_numerical_stability():
    """Verify that Arctic/Antarctic transects (latitudes 70° to 85°) maintain finite area-weighted statistics."""
    h_len, w_len = 10, 10
    lats = np.linspace(70.0, 85.0, h_len)
    lons = np.linspace(-40.0, -20.0, w_len)

    # Left half warming (+0.5°C/decade), right half cooling (-0.5°C/decade)
    slopes = np.zeros((h_len, w_len), dtype=float)
    slopes[:, :5] = 0.50
    slopes[:, 5:] = -0.50

    is_sig = np.ones((h_len, w_len), dtype=bool)

    contrasts = find_contrasting_regions(
        slopes=slopes,
        is_significant=is_sig,
        latitudes=lats,
        longitudes=lons,
        min_cluster_size=2
    )

    assert len(contrasts) > 0, "Should detect contrasting regions even in polar latitudes."
    top_contrast = contrasts[0]
    pos = top_contrast["region_increasing"]
    neg = top_contrast["region_decreasing"]

    assert np.isfinite(pos["mean_slope"]), "Polar positive mean slope must be finite."
    assert np.isfinite(neg["mean_slope"]), "Polar negative mean slope must be finite."
    assert np.isfinite(pos["center"][0]) and np.isfinite(pos["center"][1]), "Centroid coordinates must be finite."
    assert pos["center"][1] >= 70.0 and pos["center"][1] <= 85.0, "Centroid latitude must lie within grid bounds."


def test_theil_sen_and_mann_kendall_extreme_ties_and_outliers():
    """
    Ground-truth mathematical test:
    Verify that 50% tied observations plus a massive 10,000x single-point sensor outlier
    does not distort Sen's median slope or cause Mann-Kendall variance degeneration.
    """
    t = np.arange(20, dtype=float)
    # Base true slope = 0.20 per unit time
    # Introduce discrete steps creating multiple identical tie groups
    y = np.floor(0.20 * t)
    # Add a massive sensor artifact outlier at index 10
    y[10] = 9999.0

    sen = sens_slope(y, time_steps=t)
    mk = mann_kendall_test(y, correct_autocorrelation=True)

    # Median slope must be resistant to the single massive outlier
    assert 0.0 <= sen["slope"] <= 0.35, f"Sen slope should be robust against outlier, got {sen['slope']}"
    assert np.isfinite(sen["ci_lower"]) and np.isfinite(sen["ci_upper"]), "Confidence bounds must be finite."
    assert sen["ci_lower"] <= sen["ci_upper"], "Lower confidence bound must not exceed upper bound."

    # Mann-Kendall variance with ties
    assert mk["var_s"] > 0, "Variance of S must remain strictly positive under ties."
    assert -1.0 <= mk["tau"] <= 1.0, "Kendall's tau must remain within [-1, 1]."


def test_mission_and_model_provenance_metadata():
    """
    Verify that dataset adapters expose Earth science mission and numerical model provenance,
    identifying satellite instruments (MODIS, AIRS, GPM) and assimilation models (GEOS-5).
    """
    power_adapter = NASAPowerAdapter()
    power_meta = power_adapter.metadata()
    assert "missions_and_models" in power_meta, "NASA POWER metadata must document driving missions and models."
    missions_text = str(power_meta["missions_and_models"]).upper()
    assert any(m in missions_text for m in ["CERES", "MODIS", "GEOS", "GMAO", "LARC"]), (
        f"NASA POWER metadata must cite satellite instruments or models, got {missions_text}"
    )

    merra2_adapter = MERRA2Adapter()
    merra2_meta = merra2_adapter.metadata()
    assert "missions_and_models" in merra2_meta, "MERRA-2 metadata must document driving missions and models."
    merra_text = str(merra2_meta["missions_and_models"]).upper()
    assert any(m in merra_text for m in ["GEOS", "GMAO", "MODIS", "AIRS", "SATELLITE"]), (
        f"MERRA-2 metadata must cite assimilation model or instruments, got {merra_text}"
    )


def test_dynamic_colab_launcher_url_respects_settings():
    """Verify that the Colab export link derives from settings.GITHUB_REPO."""
    client = TestClient(app)

    # Run a quick analysis to get an analysis_id
    payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2015,
        "end_year": 2023,
        "alpha": 0.05,
        "use_fdr": True
    }
    resp = client.post("/analysis", json=payload)
    assert resp.status_code == 200
    ana_id = resp.json()["analysis_id"]

    # Test colab endpoint
    colab_resp = client.get(f"/analysis/{ana_id}/export/colab")
    assert colab_resp.status_code == 200
    colab_json = colab_resp.json()

    assert "colab_launcher_url" in colab_json
    expected_repo = getattr(settings, "GITHUB_REPO", "ShivamGawade-XS/NSC")
    assert expected_repo in colab_json["colab_launcher_url"], (
        f"Expected repository '{expected_repo}' in Colab URL, got {colab_json['colab_launcher_url']}"
    )


def test_nasa_power_clamped_bbox_warning_recommends_merra2():
    """Verify that when a domain exceeding 10 degrees is requested from NASA POWER, the warning explicitly recommends MERRA-2."""
    power_adapter = NASAPowerAdapter()
    res = power_adapter.fetch(
        variable="T2M",
        start_year=2015,
        end_year=2020,
        bbox=[-120.0, 30.0, -90.0, 50.0],  # 30 deg lon x 20 deg lat
        prefer_live=False
    )
    prov = res.get("provenance", {})
    assert prov.get("bbox_clamped") is True
    assert "MERRA-2" in str(prov.get("warning"))


def test_solar_radiation_discontinuity_warning_and_provenance():
    """Verify that NASA POWER solar radiation carries variable-specific CERES/SRB/GEOS transition warnings."""
    power_adapter = NASAPowerAdapter()
    vars_dict = power_adapter.VARIABLES

    assert "ALLSKY_SFC_SW_DWN" in vars_dict
    solar_meta = vars_dict["ALLSKY_SFC_SW_DWN"]

    assert solar_meta["product_type"] == "satellite_retrieval_and_model_composite"
    assert "CERES" in solar_meta["mission_source"]
    assert "GEWEX SRB" in solar_meta["mission_source"]
    assert solar_meta["discontinuity_warning"] is not None
    assert "transition" in solar_meta["discontinuity_warning"].lower()

    # Discover query for solar
    solar_discover = power_adapter.discover(query="ALLSKY_SFC_SW_DWN")
    assert len(solar_discover) == 1
    assert solar_discover[0]["discontinuity_warning"] == solar_meta["discontinuity_warning"]


def test_variable_specific_mission_vs_model_attribution():
    """Verify that atmospheric variables accurately distinguish numerical assimilation from satellite sounders."""
    power_adapter = NASAPowerAdapter()
    t2m_power = power_adapter.VARIABLES["T2M"]
    assert t2m_power["product_type"] == "reanalysis_assimilation"
    assert "GEOS-5 FP-IT" in t2m_power["mission_source"]

    merra2_adapter = MERRA2Adapter()
    t2m_merra = merra2_adapter.VARIABLES["T2M"]
    assert "GEOS-5 ADAS" in t2m_merra["mission_source"]

    precip_merra = merra2_adapter.VARIABLES["PRECTOT"]
    assert "CPC gauge" in precip_merra["mission_source"]


def test_statistical_pipeline_monotonic_trends_and_null_noise():
    """Verify statistical behavior on increasing, decreasing, and null noise series."""
    t = np.arange(25, dtype=float)
    rng = np.random.default_rng(999)

    # 1. Monotonically increasing trend
    y_inc = 0.40 * t + rng.normal(0.0, 0.15, size=25)
    mk_inc = mann_kendall_test(y_inc, alpha=0.05)
    sen_inc = sens_slope(y_inc, time_steps=t)
    assert mk_inc["significant"] is True
    assert mk_inc["direction"] == "increasing"
    assert sen_inc["slope"] > 0.30

    # 2. Monotonically decreasing trend
    y_dec = -0.40 * t + rng.normal(0.0, 0.15, size=25)
    mk_dec = mann_kendall_test(y_dec, alpha=0.05)
    sen_dec = sens_slope(y_dec, time_steps=t)
    assert mk_dec["significant"] is True
    assert mk_dec["direction"] == "decreasing"
    assert sen_dec["slope"] < -0.30

    # 3. Approximately stable series (pure white noise)
    y_stable = rng.normal(15.0, 0.20, size=25)
    mk_stable = mann_kendall_test(y_stable, alpha=0.01)
    sen_stable = sens_slope(y_stable, time_steps=t)
    assert abs(sen_stable["slope"]) < 0.10
    assert mk_stable["direction"] in ("no_trend", "neutral")


def test_api_variables_endpoint_exposes_product_type_and_discontinuity_warning():
    """Verify that the /variables API catalog serves product_type and discontinuity_warning metadata."""
    client = TestClient(app)
    resp = client.get("/variables")
    assert resp.status_code == 200
    var_list = resp.json()

    # Find ALLSKY_SFC_SW_DWN
    solar_item = next((v for v in var_list if v["variable_id"] == "ALLSKY_SFC_SW_DWN"), None)
    assert solar_item is not None
    assert solar_item["product_type"] == "satellite_retrieval_and_model_composite"
    assert solar_item["discontinuity_warning"] is not None
    assert "CERES" in solar_item["mission_source"]


def test_prov_002_nasa_power_sub_2_degree_live_query_expansion(tmp_path):
    """RED Test: Verify that live regional queries clamp min delta to >= 2.0 degrees to prevent NASA HTTP 422."""
    import urllib.error
    import urllib.request

    adapter = NASAPowerAdapter(cache_dir=tmp_path)
    # Mock urllib.request.urlopen to inspect the URL sent
    requested_urls = []

    from email.message import Message

    def mock_urlopen(req, timeout=12.0):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        requested_urls.append(url)
        raise urllib.error.HTTPError(url, 500, "Mock Test Halt", Message(), None)

    orig_urlopen = urllib.request.urlopen
    urllib.request.urlopen = mock_urlopen
    try:
        # User provides 1.0 degree box (min_lat=30.0, max_lat=31.0, min_lon=-95.0, max_lon=-94.0)
        adapter.fetch_live_granule("T2M", 2020, 2021, [-95.0, 30.0, -94.0, 31.0])
    finally:
        urllib.request.urlopen = orig_urlopen

    assert len(requested_urls) > 0, "Expected at least one URL request but cache bypassed the mock"
    url = requested_urls[0]
    import urllib.parse
    parsed = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    min_lat = float(parsed["latitude-min"][0])
    max_lat = float(parsed["latitude-max"][0])
    min_lon = float(parsed["longitude-min"][0])
    max_lon = float(parsed["longitude-max"][0])

    assert (max_lat - min_lat) >= 2.0, f"Latitude range must be >= 2.0 deg, got {max_lat - min_lat}"
    assert (max_lon - min_lon) >= 2.0, f"Longitude range must be >= 2.0 deg, got {max_lon - min_lon}"


def test_prov_001_offline_fixture_variable_substitution_flag():
    """RED Test: When offline fallback substitutes T2M for missing solar/wind fixture, verify explicit transparency flag."""
    adapter = NASAPowerAdapter()
    # Force prefer_live=False to test offline fallback
    res = adapter.fetch("ALLSKY_SFC_SW_DWN", 2000, 2020, bbox=[-100.0, 32.0, -95.0, 37.0], prefer_live=False)
    prov = res["provenance"]
    assert "is_variable_substituted" in prov, "Provenance must include 'is_variable_substituted' flag"
    assert prov["is_variable_substituted"] is True, "When T2M is substituted for solar irradiance, flag must be True"
    assert "substituted" in prov["warning"].lower(), "Explicit warning must disclose variable substitution"


def test_clim_001_climatological_normal_qualification_flag():
    """RED Test: Verify that analysis windows < 20 years emit is_climatological_normal=False and caveat."""
    client = TestClient(app)
    # Short window: 2018-2023 (6 years)
    resp_short = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2018,
        "end_year": 2023,
        "bbox": [-102.0, 30.0, -94.0, 38.0]
    })
    assert resp_short.status_code == 200
    data_short = resp_short.json()
    assert "is_climatological_normal" in data_short["summary"]
    assert data_short["summary"]["is_climatological_normal"] is False, "Window < 20 yrs is not a 30-yr climatological normal"

    # Standard normal window: 2000-2023 (24 years >= 20)
    resp_long = client.post("/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-102.0, 30.0, -94.0, 38.0]
    })
    assert resp_long.status_code == 200
    data_long = resp_long.json()
    assert data_long["summary"]["is_climatological_normal"] is True



