"""
Tests for Championship Production Features:
1. Pettitt (1979) non-parametric regime changepoint test
2. Self-contained reproducible Jupyter Notebook (.ipynb) export
3. System telemetry (/metrics) and readiness (/ready) probes
4. NASA Earthdata auth status and configuration
"""

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.science.export import _escape_latex, generate_jupyter_notebook, generate_nasa_latex_memorandum
from app.science.trend import compute_spatial_pettitt, pettitt_changepoint_test

client = TestClient(app)


def test_pettitt_changepoint_step_increase():
    """Verify Pettitt test correctly identifies an abrupt regime shift."""
    # Create a series with a clear regime shift from mean 10 to mean 25 at index 12 (year 2012)
    years = np.arange(2000, 2024)
    series = np.concatenate([
        np.full(12, 10.0) + np.random.normal(0, 0.2, 12),
        np.full(12, 25.0) + np.random.normal(0, 0.2, 12)
    ])

    res = pettitt_changepoint_test(series, time_coords=years)
    assert res["significant"] is True
    assert res["p_value"] < 0.05
    assert res["changepoint_time"] in (2011, 2012)
    assert res["k_statistic"] > 50


def test_pettitt_changepoint_constant_or_small():
    """Verify Pettitt test behavior on small samples or flat data."""
    # Under 6 samples
    res_small = pettitt_changepoint_test(np.array([1.0, 2.0, 3.0]))
    assert res_small["significant"] is False

    # Flat line without changepoint
    flat = np.full(20, 15.0)
    res_flat = pettitt_changepoint_test(flat)
    assert res_flat["significant"] is False


def test_compute_spatial_pettitt_vectorized():
    """Verify 3D grid vectorized Pettitt test computes changepoint year and p-value correctly."""
    years = np.arange(2000, 2024)
    t_len = len(years)
    # Shape: (24, 2, 2)
    data = np.zeros((t_len, 2, 2))
    # Cell (0, 0): regime shift at index 10 (2010)
    data[:, 0, 0] = np.concatenate([np.full(10, 5.0), np.full(14, 20.0)])
    # Cell (0, 1): regime shift at index 16 (2016)
    data[:, 0, 1] = np.concatenate([np.full(16, 5.0), np.full(8, 20.0)])
    # Cell (1, 0): flat constant line (ptp < 1e-12)
    data[:, 1, 0] = np.full(t_len, 7.0)
    # Cell (1, 1): all-NaN mask
    data[:, 1, 1] = np.nan

    res = compute_spatial_pettitt(data, time_coords=years)

    # Dictionary access
    cp_year = res["changepoint_year"]
    cp_pval = res["changepoint_p_value"]
    sig = res["significant"]

    assert cp_year.shape == (2, 2)
    assert cp_pval.shape == (2, 2)

    # Valid changepoints
    assert cp_year[0, 0] in (2009, 2010)
    assert cp_pval[0, 0] < 0.01
    assert bool(sig[0, 0]) is True

    assert cp_year[0, 1] in (2015, 2016)
    assert cp_pval[0, 1] < 0.01
    assert bool(sig[0, 1]) is True

    # Flat and NaN cells
    assert np.isnan(cp_year[1, 0])
    assert cp_pval[1, 0] == 1.0
    assert bool(sig[1, 0]) is False

    assert np.isnan(cp_year[1, 1])
    assert cp_pval[1, 1] == 1.0
    assert bool(sig[1, 1]) is False

    # 2-tuple unpacking
    unpacked_year, unpacked_pval = compute_spatial_pettitt(data, time_coords=years)
    np.testing.assert_array_equal(unpacked_year, cp_year)
    np.testing.assert_array_equal(unpacked_pval, cp_pval)


def test_compute_spatial_pettitt_insufficient_samples():
    """Verify compute_spatial_pettitt returns safe defaults when T < 6."""
    small_data = np.random.randn(4, 3, 3)
    res = compute_spatial_pettitt(small_data)
    assert res["changepoint_p_value"].shape == (3, 3)
    assert np.all(res["changepoint_p_value"] == 1.0)
    assert np.all(np.isnan(res["changepoint_year"]))
    assert np.all(~res["significant"])


def test_jupyter_notebook_generation():
    """Verify self-contained Jupyter Notebook generation matches nbformat 4 and executes standalone."""
    analysis_record = {
        "variable": "T2M",
        "units": "°C",
        "provenance": {
            "source": "NASA POWER Project",
            "doi": "10.5067/POWER/10.0.0"
        },
        "results": {
            "cells": [
                {
                    "lat": 32.0,
                    "lon": -98.0,
                    "slope": 0.45,
                    "p_value": 0.002,
                    "q_value": 0.005,
                    "significant": True
                }
            ]
        }
    }

    nb = generate_jupyter_notebook(analysis_record)
    assert nb["nbformat"] == 4
    assert len(nb["cells"]) >= 6

    # Verify presence of all required scientific methodology components
    all_code_sources = ["".join(cell.get("source", [])) for cell in nb["cells"]]
    combined_source = "\n".join(all_code_sources)

    assert "mann_kendall_test" in combined_source
    assert "theil_sen_and_gilbert_ci" in combined_source
    assert "pettitt_changepoint" in combined_source
    assert "benjamini_hochberg_fdr" in combined_source
    assert "years = np.array(" in combined_source
    assert "time_series = np.array(" in combined_source
    assert "grid_cells = [" in combined_source

    # Verify standalone execution of all code cells in an isolated Python scope
    import matplotlib
    matplotlib.use("Agg")
    scope = {}
    for cell in nb["cells"]:
        if cell["cell_type"] == "code":
            code = "".join(cell["source"])
            exec(code, scope)

    assert "mk_result" in scope
    assert "ts_result" in scope
    assert "pettitt_result" in scope
    assert "q_vals" in scope
    assert "sig_flags" in scope


def test_latex_escaping_and_memorandum():
    """Verify LaTeX special character escaping and NASA Technical Memorandum output."""
    # 1. Test helper function _escape_latex directly
    raw_str = "T2M_AIR & SURFACE #1 %_test with $50 {curly}"
    escaped = _escape_latex(raw_str)
    assert r"\%" in escaped
    assert r"\_" in escaped
    assert r"\&" in escaped
    assert r"\#" in escaped
    assert r"\$" in escaped
    assert r"\{" in escaped
    assert r"\}" in escaped
    assert escaped == r"T2M\_AIR \& SURFACE \#1 \%\_test with \$50 \{curly\}"

    # 2. Test preservation of intentional math mode expressions
    math_str = r"Variable $\Delta T_{max}$ with 50%_error"
    math_escaped = _escape_latex(math_str)
    assert r"$\Delta T_{max}$" in math_escaped
    assert r"50\%" in math_escaped

    # 3. Test generate_nasa_latex_memorandum with dynamic special characters
    record = {
        "variable_name": "T2M_AIR & PRECIP#1",
        "dataset_id": "merra2_reanalysis_2026",
        "units": "°C_%",
        "provenance": {
            "source": "NASA & Langley Research Center",
            "doi": "10.5067/POWER/{10.0.0}_doi"
        },
        "results": {
            "cells": [
                {"lat": 32.0, "lon": -98.0, "slope": 0.45, "significant": True}
            ]
        }
    }
    latex = generate_nasa_latex_memorandum(record, hmac_signature="HMAC_TEST#123_456")

    # Dynamic fields must be escaped
    assert r"T2M\_AIR \& PRECIP\#1" in latex
    assert r"merra2\_reanalysis\_2026" in latex
    assert r"NASA \& Langley Research Center" in latex
    assert r"10.5067/POWER/\{10.0.0\}\_doi" in latex
    assert r"HMAC\_TEST\#123\_456" in latex

    # Static template math equations and formulas must remain preserved
    assert r"\documentclass[10pt,journal,compsoc]{IEEEtran}" in latex
    assert r"\begin{equation}" in latex
    assert r"\end{equation}" in latex
    assert r"$\alpha = 0.05$" in latex
    assert r"\text{Var}^*(S)" in latex
    assert r"\|\vec{V}\|" in latex


def test_system_metrics_and_readiness():
    """Verify /metrics, /api/v1/ready, and /api/v1/auth/status endpoints."""
    m_res = client.get("/metrics")
    assert m_res.status_code == 200
    m_data = m_res.json()
    assert m_data["service"] == "EarthSift Scientific API"
    assert "uptime_seconds" in m_data
    assert "memory_rss_mb" in m_data

    r_res = client.get("/api/v1/ready")
    assert r_res.status_code == 200
    assert r_res.json()["ready"] is True

    a_res = client.get("/api/v1/auth/status")
    assert a_res.status_code == 200
    assert "auth_type" in a_res.json()


def test_notebook_export_endpoint():
    """Verify GET /api/v1/analysis/{id}/export/notebook returns valid .ipynb JSON."""
    # 1. Run an analysis first
    run_res = client.post("/api/v1/analysis", json={
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "alpha": 0.05,
        "use_fdr": True,
        "bbox": [-102.0, 30.0, -94.0, 38.0]
    })
    assert run_res.status_code == 200
    ana_id = run_res.json()["analysis_id"]

    # 2. Query cell detail and verify changepoint fields
    cell_res = client.get(f"/api/v1/analysis/{ana_id}/timeseries?lat=32.0&lon=-98.0")
    assert cell_res.status_code == 200
    cell_data = cell_res.json()
    assert "changepoint_year" in cell_data
    assert "changepoint_p_value" in cell_data
    assert "changepoint" in cell_data["evidence_record"]

    # 3. Export Jupyter Notebook
    nb_res = client.get(f"/api/v1/analysis/{ana_id}/export/notebook")
    assert nb_res.status_code == 200
    assert "application/x-ipynb+json" in nb_res.headers.get("content-type", "")
    assert "nbformat" in nb_res.text
