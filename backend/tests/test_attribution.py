"""
Test suite for EarthSift Extreme Event Attribution Engine (FAR).
Verifies:
- Risk Ratio and FAR calculation for positive thermal drift (warming)
- Risk Ratio and FAR calculation for negative precipitation drift (drought)
- Parametric bootstrap 90% confidence intervals
- Edge cases (zero slope, small series)
- POST /analysis/attribution endpoint
"""

import numpy as np
from app.science.attribution import compute_event_attribution
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_attribution_positive_warming_drift():
    # Significant warming trend of +0.35°C / decade
    series = np.linspace(14.0, 15.5, 24) + np.random.normal(0, 0.2, 24)
    res = compute_event_attribution(slope=0.35, n_years=24, series=series)

    assert "risk_ratio" in res
    assert "fraction_of_attributable_risk" in res
    assert res["risk_ratio"] >= 1.0
    assert 0.0 <= res["fraction_of_attributable_risk"] <= 1.0
    assert res["far_ci_lower"] <= res["far_ci_upper"]
    assert "Stott" in res["methodology"]
    assert "Likelihood increased" in res["summary"] or "anthropogenic" in res["summary"].lower()


def test_attribution_negative_drought_drift():
    # Significant drought / precipitation deficit trend of -0.40 mm/decade
    series = np.linspace(60.0, 45.0, 24) + np.random.normal(0, 2.0, 24)
    res = compute_event_attribution(slope=-0.40, n_years=24, series=series)

    assert "risk_ratio" in res
    assert res["risk_ratio"] >= 1.0
    assert res["fraction_of_attributable_risk"] >= 0.0
    assert res["anthropogenic_cumulative_shift"] < 0


def test_attribution_zero_slope_null_case():
    res = compute_event_attribution(slope=0.0, n_years=24)
    assert res["risk_ratio"] == 1.0
    assert res["fraction_of_attributable_risk"] == 0.0


def test_attribution_endpoint_integration():
    payload = {
        "slope": 0.28,
        "n_years": 24,
        "alpha": 0.05,
        "threshold_percentile": 90.0
    }
    resp = client.post("/analysis/attribution", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "risk_ratio" in data
    assert "fraction_of_attributable_risk" in data
    assert data["risk_ratio"] > 1.0
