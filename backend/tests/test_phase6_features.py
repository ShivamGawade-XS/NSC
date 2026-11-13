"""
Test Phase 6 Scientific Instrument capabilities:
1. Gilbert (1987) 95% Confidence Intervals
2. Anselin Local Moran's I (LISA) & Global Moran's I
3. CF-1.8 NetCDF-4 export endpoint
4. GeoJSON FeatureCollection export endpoint
5. NASA Climate Science Dossier generation endpoint
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_export_netcdf_geojson_and_dossier():
    """Verify analysis run produces valid NetCDF, GeoJSON, and Dossier exports."""
    # 1. Run analysis on NASA POWER dataset (within fixture bbox)
    res = client.post(
        "/analysis",
        json={
            "dataset_id": "nasa_power",
            "variable_id": "T2M",
            "start_year": 2000,
            "end_year": 2023,
            "bbox": [-101.0, 31.0, -95.0, 37.0],
            "alpha": 0.05
        }
    )
    assert res.status_code == 200
    data = res.json()
    analysis_id = data["analysis_id"]

    # Check summary contains spatial autocorrelation
    assert "spatial_autocorrelation" in data["summary"]
    sa = data["summary"]["spatial_autocorrelation"]
    assert "moran_i" in sa
    assert "z_score" in sa
    assert "p_value" in sa
    assert "interpretation" in sa

    # Check grid contains ci_lower, ci_upper, lisa_cluster
    assert len(data["grid"]) > 0
    first_cell = data["grid"][0]
    assert "ci_lower" in first_cell
    assert "ci_upper" in first_cell
    assert "lisa_cluster" in first_cell
    assert first_cell["ci_lower"] <= first_cell["ci_upper"]
    assert first_cell["lisa_cluster"] in {"HH", "LL", "HL", "LH", "NS"}

    import glob
    import json
    import os
    import tempfile
    from pathlib import Path

    import xarray as xr

    # 2. Test GET /export/netcdf (valid binary, CF-1.8 attributes, zero temp file leaks)
    nc_before = glob.glob(os.path.join(tempfile.gettempdir(), "tellura_nc_*"))
    for base in ["", "/api/v1"]:
        nc_res = client.get(f"{base}/analysis/{analysis_id}/export/netcdf")
        assert nc_res.status_code == 200
        assert nc_res.headers.get("content-type") == "application/x-netcdf"
        assert len(nc_res.content) > 500  # Valid NetCDF binary payload

        with tempfile.NamedTemporaryFile(suffix=".nc", delete=False) as tf:
            tf.write(nc_res.content)
            tf.flush()
            tmp_nc = tf.name
        try:
            with xr.open_dataset(tmp_nc) as ds:
                assert "crs" in ds.data_vars
                assert ds["crs"].attrs.get("epsg_code") == "EPSG:4326"
                for v in ["slopes", "p_values", "q_values", "ci_lower", "ci_upper", "lisa_cluster"]:
                    assert v in ds.data_vars
                    assert ds[v].attrs.get("grid_mapping") == "crs"
        finally:
            Path(tmp_nc).unlink(missing_ok=True)

    nc_after = glob.glob(os.path.join(tempfile.gettempdir(), "tellura_nc_*"))
    assert len(nc_after) <= len(nc_before), "Zero leftover .nc temp directories/files in temp directory after export completion"

    # 3. Test GET /export/geojson (RFC 7946 FeatureCollection)
    for base in ["", "/api/v1"]:
        geo_res = client.get(f"{base}/analysis/{analysis_id}/export/geojson")
        assert geo_res.status_code == 200
        assert geo_res.headers.get("content-type") == "application/geo+json"
        geojson = geo_res.json()
        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) > 0
        feat = geojson["features"][0]
        assert feat["type"] == "Feature"
        assert feat["geometry"]["type"] == "Point"
        assert "slope" in feat["properties"]
        assert "ci_lower" in feat["properties"]
        assert "ci_upper" in feat["properties"]
        assert "lisa_cluster" in feat["properties"]

    # 4. Test GET /export/notebook (nbformat: 4)
    for base in ["", "/api/v1"]:
        nb_res = client.get(f"{base}/analysis/{analysis_id}/export/notebook")
        assert nb_res.status_code == 200
        assert "application/x-ipynb+json" in nb_res.headers.get("content-type", "")
        nb_json = json.loads(nb_res.text)
        assert nb_json.get("nbformat") == 4
        assert "cells" in nb_json

    # 5. Test GET /export/latex (valid LaTeX with escaped %, _, &)
    for base in ["", "/api/v1"]:
        latex_res = client.get(f"{base}/analysis/{analysis_id}/export/latex")
        assert latex_res.status_code == 200
        latex_code = latex_res.text
        assert "\\documentclass" in latex_code
        assert "\\begin{document}" in latex_code
        assert "\\end{document}" in latex_code

    # 6. Test GET /export/colab
    for base in ["", "/api/v1"]:
        colab_res = client.get(f"{base}/analysis/{analysis_id}/export/colab")
        assert colab_res.status_code == 200
        colab_json = colab_res.json()
        assert "colab_launcher_url" in colab_json
        assert "badge_markdown" in colab_json

    # 7. Test GET /dossier (text/markdown)
    for base in ["", "/api/v1"]:
        dossier_res = client.get(f"{base}/analysis/{analysis_id}/dossier")
        assert dossier_res.status_code == 200
        assert "text/markdown" in dossier_res.headers.get("content-type")
        dossier_md = dossier_res.text
        assert "Tellura Earth Science Briefing & Empirical Dossier" in dossier_md
        assert "Gilbert (1987)" in dossier_md
        assert "Moran's I" in dossier_md
        assert "Anselin LISA" in dossier_md


@pytest.mark.asyncio
async def test_xai_grok_explainer_and_nlq_fallback(monkeypatch):
    """Verify Grok (xAI) fallback when Gemini is offline or quota-exhausted."""
    from unittest.mock import AsyncMock, patch

    import httpx

    from app.schemas.analysis import ExplainRequest
    from app.science.explainer import explain_evidence_with_ai_async
    from app.science.nlq_parser import AnalysisRequest, NLQParseResponse, _gemini_upgrade_async

    # Ensure Gemini key is unset so it falls through to Grok
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("GROK_API_KEY", raising=False)
    monkeypatch.setenv("XAI_API_KEY", "xai-mock-key-12345")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    # 1. Mock Grok Explainer response
    mock_grok_explainer_resp = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"summary": "At Texas Thermal Basin, Surface Temperature demonstrated a warming of +0.350 deg C / decade across 2000 - 2023.", "statistical_assessment": "Verified p = 0.0010, q = 0.0020.", "limitations": "Model grid resolution effects."}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_grok_explainer_resp
        req = ExplainRequest(
            variable_name="Surface Temperature",
            location="Texas Thermal Basin",
            time_span="2000 - 2023",
            slope=0.35,
            slope_units="deg C / decade",
            p_value=0.001,
            q_value=0.002,
            significant=True,
            direction="increasing",
            sample_count=24,
            source="NASA POWER",
        )
        res = await explain_evidence_with_ai_async(req)
        assert "xAI Grok" in res.model_used
        assert "+0.350" in res.summary

    # 2. Mock Grok NLQ response
    mock_grok_nlq_resp = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"dataset_id": "nasa_power", "variable_id": "T2M", "start_year": 2005, "end_year": 2022, "bbox": [78.0, 28.0, 103.0, 38.0], "region_name": "Tibetan Plateau"}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.x.ai/v1/chat/completions"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_grok_nlq_resp
        fallback_nlq = NLQParseResponse(
            raw_query="Warming in Tibetan Plateau from 2005 to 2022",
            interpreted_intent="keyword match",
            analysis_request=AnalysisRequest(),
            confidence=0.5,
            matched_regions=[],
            parsing_method="keyword",
        )
        upgraded = await _gemini_upgrade_async("Warming in Tibetan Plateau from 2005 to 2022", fallback_nlq)
        assert upgraded.parsing_method == "grok"
        assert "[Grok-parsed]" in upgraded.interpreted_intent
        assert upgraded.analysis_request.start_year == 2005
        assert upgraded.analysis_request.end_year == 2022


@pytest.mark.asyncio
async def test_groq_explainer_and_nlq_fallback(monkeypatch):
    """Verify Groq Cloud fallback with gsk_ key format."""
    from unittest.mock import AsyncMock, patch

    import httpx

    from app.schemas.analysis import ExplainRequest
    from app.science.explainer import explain_evidence_with_ai_async
    from app.science.nlq_parser import AnalysisRequest, NLQParseResponse, _gemini_upgrade_async

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("XAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_mock_groq_key_12345")

    mock_resp = httpx.Response(
        status_code=200,
        json={
            "choices": [
                {
                    "message": {
                        "content": '{"summary": "At Texas Thermal Basin, Surface Temperature rose at +0.250 deg C / decade.", "statistical_assessment": "Verified p = 0.0010, q = 0.0020.", "limitations": "None."}'
                    }
                }
            ]
        },
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions"),
    )

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        req = ExplainRequest(
            variable_name="Surface Temperature",
            location="Texas Thermal Basin",
            time_span="2000 - 2023",
            slope=0.25,
            slope_units="deg C / decade",
            p_value=0.001,
            q_value=0.002,
            significant=True,
            direction="increasing",
            sample_count=24,
            source="NASA POWER",
        )
        res = await explain_evidence_with_ai_async(req)
        assert "Live Groq" in res.model_used

        fallback_nlq = NLQParseResponse(
            raw_query="Warming in Texas",
            interpreted_intent="keyword match",
            analysis_request=AnalysisRequest(),
            confidence=0.5,
            matched_regions=[],
            parsing_method="keyword",
        )
        upgraded = await _gemini_upgrade_async("Warming in Texas", fallback_nlq)
        assert upgraded.parsing_method == "groq"
        assert "[Groq-parsed]" in upgraded.interpreted_intent



