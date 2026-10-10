# EarthSift — Comprehensive Test Plan

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/TEST_PLAN.md`  

---

## 1. Test Strategy Overview
The EarthSift test suite guarantees complete verification across three decoupled tiers:
1. **Scientific Computing Core (`backend/tests/test_trend.py`):** Mathematical fidelity of Mann-Kendall, Hamed-Rao autocorrelation correction, Sen's slope estimator, and Benjamini-Hochberg FDR multiplicity control.
2. **Dataset Adapter Layer (`backend/tests/test_adapter.py`):** Abstract adapter contract validation, coordinate sorting, bbox slicing, physical unit normalization, and unmistakable synthetic data labeling.
3. **Application & API Layer (`backend/tests/test_api.py` and `test_application.py`):** REST endpoint contracts, error handling, cache idempotency, out-of-bounds boundary requests, and deterministic downstream explainer fallback.

---

## 2. Test Execution Commands

```powershell
# Set Python path to backend directory
$env:PYTHONPATH="backend"

# Run complete test suite with verbose output
pytest backend/tests -v

# Run only scientific tests
pytest backend/tests/test_trend.py -v

# Run only API and application integration tests
pytest backend/tests/test_api.py backend/tests/test_application.py -v
```

---

## 3. Test Coverage Matrix

| Category | Test Case Name | File | Description / Pass Criteria |
|---|---|---|---|
| **Science** | `test_mann_kendall_increasing` | `test_trend.py` | Strictly increasing series yields $S > 0$, $p < 0.001$, `direction="increasing"`. |
| **Science** | `test_mann_kendall_decreasing` | `test_trend.py` | Strictly decreasing series yields $S < 0$, $p < 0.001$, `direction="decreasing"`. |
| **Science** | `test_mann_kendall_no_trend` | `test_trend.py` | Flat constant series yields $S=0$, $\tau=0.0$, `significant=False`. |
| **Science** | `test_mann_kendall_random_noise` | `test_trend.py` | Gaussian white noise without drift produces non-significant result ($p > 0.05$). |
| **Science** | `test_mann_kendall_ties_handling` | `test_trend.py` | Verified tie correction term suppresses inflated variance when tied values exist. |
| **Science** | `test_mann_kendall_nan_handling` | `test_trend.py` | Missing data / NaNs are properly filtered; valid count reported accurately. |
| **Science** | `test_mann_kendall_insufficient_samples` | `test_trend.py` | Sample count $< 5$ returns $p=1.0$, `significant=False`, preventing crashes. |
| **Science** | `test_sens_slope_accuracy` | `test_trend.py` | Sen's median estimator recovers ground truth linear slope despite extreme outlier. |
| **Science** | `test_seasonal_series` | `test_trend.py` | Stationary harmonic seasonal cycles do not falsely trigger monotonic trend. |
| **Science** | `test_autocorrelated_series` | `test_trend.py` | $AR(1)$ red noise persistence is corrected via Hamed-Rao (1998) without false positive. |
| **Science** | `test_threshold_edge_p_values` | `test_trend.py` | Exact threshold boundary verified for single ($p=0.0499$ vs $0.0501$) and multiple tests. |
| **Science** | `test_benjamini_hochberg_fdr` | `test_trend.py` | Benjamini-Hochberg correctly controls FDR, enforcing monotonic adjusted $q$-values. |
| **Science** | `test_compute_spatial_trends` | `test_trend.py` | 3D array $(T, H, W)$ vectorized processing outputs correct 2D slope and FDR fields. |
| **Science** | `test_unit_conversion_decadal_rate` | `test_trend.py` | Annual rate accurately scales to decadal rate ($\beta_{\text{decadal}} = 10 \cdot \beta_{\text{annual}}$). |
| **Adapter** | `test_merra2_metadata` | `test_adapter.py` | Metadata reports DOI, resolution, variables, and temporal bounds. |
| **Adapter** | `test_merra2_discover` | `test_adapter.py` | CMR discovery queries return accessible collection metadata. |
| **Adapter** | `test_merra2_validation_invalid_variable` | `test_adapter.py` | Rejects unknown variable with explicit descriptive ValueError. |
| **Adapter** | `test_merra2_validation_inverted_years` | `test_adapter.py` | Rejects start year $\ge$ end year with ValueError. |
| **Adapter** | `test_merra2_validation_insufficient_sample` | `test_adapter.py` | Rejects windows $< 5$ years. |
| **Adapter** | `test_merra2_validation_invalid_bbox` | `test_adapter.py` | Rejects inverted or out-of-range coordinates. |
| **Adapter** | `test_merra2_fetch_and_synthetic_labeling` | `test_adapter.py` | Validates `is_synthetic: True` and explicit label in output dictionary. |
| **Adapter** | `test_merra2_subset_and_normalize` | `test_adapter.py` | Enforces strictly ascending latitude and longitude coordinates. |
| **Adapter** | `test_merra2_fetch_subset_pipeline` | `test_adapter.py` | Full pipeline execution (validate $\to$ fetch $\to$ subset $\to$ normalize). |
| **API** | `test_health_check_endpoints` | `test_api.py` | Both `/health` and `/api/v1/health` respond with 200 and engine details. |
| **API** | `test_list_datasets_and_single_dataset` | `test_api.py` | Lists catalog and handles 404 for invalid dataset ID. |
| **API** | `test_list_variables` | `test_api.py` | Returns catalog of physical variables across datasets. |
| **API** | `test_analysis_validation_errors` | `test_api.py` | Rejects invalid parameters with 400 Bad Request. |
| **API** | `test_full_analysis_workflow_and_sub_endpoints` | `test_api.py` | Tests `/analysis`, `/map`, `/timeseries`, `/signals`, `/contrasts`, `/provenance`. |
| **API** | `test_explain_endpoint` | `test_api.py` | Deterministic evidence explainer translates validated metrics without hallucinations. |
| **API** | `test_404_for_unknown_analysis` | `test_api.py` | All sub-endpoints return 404 for non-existent analysis IDs. |
| **Resilience** | `test_invalid_analysis_request_body` | `test_application.py` | Rejects malformed JSON with 422 Unprocessable Entity. |
| **Resilience** | `test_cache_reuse_and_idempotency` | `test_application.py` | Identical requests reuse cached computation cleanly. |
| **Resilience** | `test_empty_result_out_of_bounds_bbox` | `test_application.py` | Out-of-bounds geographic bounding box cleanly caught and rejected with 400. |
| **Resilience** | `test_offline_demo_mode_data_provenance` | `test_application.py` | Offline demo mode embeds unmistakable synthetic labels in provenance record. |
| **Resilience** | `test_ai_explainer_fallback_and_validation` | `test_application.py` | Fallback interpretation functions deterministically when external AI is offline. |
| **Resilience** | `test_malformed_ai_request` | `test_application.py` | Missing statistical fields in explain request rejected with 422. |

**Current Status:** **36 / 36 tests PASSING (100% green)**
