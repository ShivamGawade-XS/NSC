"""
Tellura — Deep Scientific & Mathematical Fuzzing Harness
Probes core science modules for NaN leaks, division-by-zero, unhandled exceptions,
and boundary degradation under adversarial and degenerate inputs.
"""
import sys
import math
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import numpy as np
import traceback

from app.science.trend import (
    mann_kendall_test,
    sens_slope,
    benjamini_hochberg_fdr,
    pettitt_changepoint_test,
    compute_spatial_trends,
    hamed_rao_variance_correction,
)
from app.science.spatial import (
    compute_global_morans_i,
    compute_lisa_clusters,
)
from app.science.climate_velocity import compute_climate_velocity
from app.science.compound import compute_compound_hazard
from app.science.attribution import compute_event_attribution
from app.science.robustness import evaluate_trend_robustness

def run_fuzz_tests():
    failures = []
    tests_run = 0

    print("=" * 60)
    print("STARTING SCIENTIFIC EDGE-CASE FUZZING HARNESS")
    print("=" * 60)

    # -------------------------------------------------------------
    # 1. MANN-KENDALL TEST EDGE CASES
    # -------------------------------------------------------------
    mk_inputs = [
        ("Empty array", np.array([])),
        ("Single element", np.array([42.0])),
        ("Two elements", np.array([10.0, 20.0])),
        ("All identical (zero variance)", np.array([5.0] * 30)),
        ("All NaNs", np.array([np.nan] * 25)),
        ("Mixed NaNs and constant", np.array([np.nan, 3.0, 3.0, np.nan, 3.0, 3.0, 3.0])),
        ("Infinities", np.array([1.0, np.inf, 2.0, -np.inf, 3.0, 4.0, 5.0, 6.0])),
        ("Astronomical values", np.array([1e18, 2e18, 3e18, 4e18, 5e18, 6e18, 7e18])),
        ("Infinitesimal values", np.array([1e-25, 2e-25, 3e-25, 4e-25, 5e-25, 6e-25])),
        ("All ties pairs", np.repeat(np.arange(10), 3)),
    ]

    for name, arr in mk_inputs:
        tests_run += 1
        try:
            res = mann_kendall_test(arr)
            assert isinstance(res, dict)
            assert "p_value" in res and math.isfinite(res["p_value"])
            assert "z" in res and math.isfinite(res["z"])
            assert "tau" in res and math.isfinite(res["tau"])
            assert 0.0 <= res["p_value"] <= 1.0
            print(f"  [PASS] Mann-Kendall: {name}")
        except Exception as e:
            failures.append((f"Mann-Kendall: {name}", traceback.format_exc()))
            print(f"  [FAIL] Mann-Kendall: {name} -> {e}")

    # -------------------------------------------------------------
    # 2. SEN'S SLOPE EDGE CASES
    # -------------------------------------------------------------
    sen_inputs = [
        ("Empty array", np.array([])),
        ("Single element", np.array([10.0])),
        ("Constant array", np.array([7.5] * 25)),
        ("All NaNs", np.array([np.nan] * 20)),
        ("Negative step change", np.array([10.0] * 10 + [2.0] * 10)),
        ("Single finite value among NaNs", np.array([np.nan, np.nan, 42.0, np.nan])),
    ]

    for name, arr in sen_inputs:
        tests_run += 1
        try:
            res = sens_slope(arr)
            assert isinstance(res, dict)
            assert "slope" in res and math.isfinite(res["slope"])
            assert "intercept" in res and math.isfinite(res["intercept"])
            assert "ci_lower" in res and math.isfinite(res["ci_lower"])
            assert "ci_upper" in res and math.isfinite(res["ci_upper"])
            print(f"  [PASS] Sen's Slope: {name}")
        except Exception as e:
            failures.append((f"Sen's Slope: {name}", traceback.format_exc()))
            print(f"  [FAIL] Sen's Slope: {name} -> {e}")

    # -------------------------------------------------------------
    # 3. BENJAMINI-HOCHBERG FDR EDGE CASES
    # -------------------------------------------------------------
    fdr_inputs = [
        ("Empty p-values", np.array([])),
        ("All 1.0", np.ones(50)),
        ("All 0.0", np.zeros(50)),
        ("All NaNs", np.full(30, np.nan)),
        ("Mixed NaNs and p-values", np.array([np.nan, 0.01, 0.04, np.nan, 0.5, 0.9])),
        ("Single p-value", np.array([0.03])),
    ]

    for name, arr in fdr_inputs:
        tests_run += 1
        try:
            adj_p, sig = benjamini_hochberg_fdr(arr)
            assert len(adj_p) == len(arr)
            assert len(sig) == len(arr)
            valid = np.isfinite(adj_p)
            if np.any(valid):
                assert np.all(adj_p[valid] >= 0.0)
                assert np.all(adj_p[valid] <= 1.0)
            print(f"  [PASS] BH FDR: {name}")
        except Exception as e:
            failures.append((f"BH FDR: {name}", traceback.format_exc()))
            print(f"  [FAIL] BH FDR: {name} -> {e}")

    # -------------------------------------------------------------
    # 4. PETTITT CHANGEPOINT TEST EDGE CASES
    # -------------------------------------------------------------
    pettitt_inputs = [
        ("Empty array", np.array([])),
        ("Two points", np.array([1.0, 2.0])),
        ("Constant array", np.array([12.0] * 30)),
        ("Sharp step shift", np.array([5.0] * 15 + [25.0] * 15)),
        ("Monotonic ramp", np.linspace(0, 100, 30)),
        ("All NaNs", np.array([np.nan] * 20)),
    ]

    for name, arr in pettitt_inputs:
        tests_run += 1
        try:
            res = pettitt_changepoint_test(arr)
            assert isinstance(res, dict)
            assert "p_value" in res and math.isfinite(res["p_value"])
            assert 0.0 <= res["p_value"] <= 1.0
            print(f"  [PASS] Pettitt Changepoint: {name}")
        except Exception as e:
            failures.append((f"Pettitt Changepoint: {name}", traceback.format_exc()))
            print(f"  [FAIL] Pettitt Changepoint: {name} -> {e}")

    # -------------------------------------------------------------
    # 5. SPATIAL MORAN'S I & LISA EDGE CASES
    # -------------------------------------------------------------
    spatial_grids = [
        ("1x1 grid", np.array([[5.0]])),
        ("2x2 constant", np.full((2, 2), 10.0)),
        ("3x3 all NaNs", np.full((3, 3), np.nan)),
        ("5x5 checkerboard", np.indices((5, 5)).sum(axis=0) % 2 * 2.0 - 1.0),
        ("Isolated island cell", np.array([
            [np.nan, np.nan, np.nan],
            [np.nan, 42.0,   np.nan],
            [np.nan, np.nan, np.nan]
        ])),
        ("Two separated clusters", np.array([
            [1.0, 1.0, np.nan, np.nan, 9.0, 9.0],
            [1.0, 1.0, np.nan, np.nan, 9.0, 9.0],
        ])),
    ]

    for name, grid in spatial_grids:
        tests_run += 1
        try:
            moran = compute_global_morans_i(grid)
            assert isinstance(moran, dict)
            assert "moran_i" in moran and math.isfinite(moran["moran_i"])
            assert "p_value" in moran and math.isfinite(moran["p_value"])

            clusters, local_i = compute_lisa_clusters(grid)
            assert isinstance(clusters, np.ndarray)
            assert isinstance(local_i, np.ndarray)
            assert clusters.shape == grid.shape
            assert local_i.shape == grid.shape
            print(f"  [PASS] Spatial Autocorrelation & LISA: {name}")
        except Exception as e:
            failures.append((f"Spatial Autocorrelation: {name}", traceback.format_exc()))
            print(f"  [FAIL] Spatial Autocorrelation: {name} -> {e}")

    # -------------------------------------------------------------
    # 6. CLIMATE VELOCITY ENGINE EDGE CASES
    # -------------------------------------------------------------
    velocity_cases = [
        ("1x1 slopes", np.array([[0.5]]), np.array([30.0]), np.array([-95.0])),
        ("Flat zero slopes", np.zeros((4, 4)), np.linspace(30, 34, 4), np.linspace(-100, -96, 4)),
        ("Equatorial domain", np.ones((5, 5)) * 0.2, np.linspace(-2, 2, 5), np.linspace(-10, -6, 5)),
        ("High latitude polar domain", np.ones((4, 4)) * 0.8, np.linspace(80, 83, 4), np.linspace(-50, -46, 4)),
    ]

    for name, slopes, lats, lons in velocity_cases:
        tests_run += 1
        try:
            vel = compute_climate_velocity(slopes, lats, lons)
            assert isinstance(vel, dict)
            assert "velocity_magnitude" in vel
            assert "trajectory_bearing" in vel
            assert "vectors" in vel
            assert "summary" in vel
            print(f"  [PASS] Climate Velocity: {name}")
        except Exception as e:
            failures.append((f"Climate Velocity: {name}", traceback.format_exc()))
            print(f"  [FAIL] Climate Velocity: {name} -> {e}")

    # -------------------------------------------------------------
    # 7. COMPOUND HAZARD & ATTRIBUTION EDGE CASES
    # -------------------------------------------------------------
    compound_cases = [
        ("Identical temperature and precip grids", np.full((4, 4), 0.5), np.full((4, 4), 0.5)),
        ("Anti-correlated grids (hot-dry)", np.full((4, 4), 0.8), np.full((4, 4), -0.6)),
        ("Zero slopes everywhere", np.zeros((4, 4)), np.zeros((4, 4))),
        ("Degenerate 1x1 grid", np.array([[0.5]]), np.array([[-0.2]])),
        ("Mixed NaNs in grid", np.array([[0.5, np.nan], [np.nan, 0.2]]), np.array([[-0.3, np.nan], [np.nan, 0.1]])),
    ]

    for name, t_slopes, p_slopes in compound_cases:
        tests_run += 1
        try:
            res = compute_compound_hazard(t_slopes, p_slopes)
            assert isinstance(res, dict)
            assert "cai_map" in res
            assert "hazard_classification" in res
            print(f"  [PASS] Compound Hazard: {name}")
        except Exception as e:
            failures.append((f"Compound Hazard: {name}", traceback.format_exc()))
            print(f"  [FAIL] Compound Hazard: {name} -> {e}")

    attribution_cases = [
        ("Zero slope, 20yr normal series", 0.0, np.random.normal(15.0, 1.5, 24)),
        ("Rapid warming slope +1.5 C/dec", 1.5, np.linspace(12.0, 18.0, 24)),
        ("Rapid cooling slope -1.2 C/dec", -1.2, np.linspace(18.0, 13.0, 24)),
        ("Constant series", 0.0, np.full(20, 15.0)),
        ("Short 3-point series", 0.4, np.array([14.5, 15.0, 15.5])),
    ]

    for name, slope, series in attribution_cases:
        tests_run += 1
        try:
            res = compute_event_attribution(slope=slope, n_years=len(series), series=series, variable_id="T2M")
            assert isinstance(res, dict)
            assert "risk_ratio" in res and math.isfinite(res["risk_ratio"])
            assert "fraction_of_attributable_risk" in res and math.isfinite(res["fraction_of_attributable_risk"])
            assert "p1_factual_probability" in res and 0.0 <= res["p1_factual_probability"] <= 1.0
            assert "p0_counterfactual_probability" in res and 0.0 <= res["p0_counterfactual_probability"] <= 1.0
            print(f"  [PASS] Attribution: {name}")
        except Exception as e:
            failures.append((f"Attribution: {name}", traceback.format_exc()))
            print(f"  [FAIL] Attribution: {name} -> {e}")

    # -------------------------------------------------------------
    # 8. ROBUSTNESS EVALUATOR EDGE CASES
    # -------------------------------------------------------------
    robustness_cases = [
        ("Clean trend series", np.linspace(14.0, 18.0, 25), list(range(1995, 2020))),
        ("Noisy fluctuating series", np.random.normal(15.0, 2.0, 25), list(range(1995, 2020))),
        ("Short series (<5 points)", np.array([15.0, 16.0, 17.0]), [2010, 2011, 2012]),
    ]

    for name, series, years in robustness_cases:
        tests_run += 1
        try:
            res = evaluate_trend_robustness(years=years, observations=series)
            assert isinstance(res, dict)
            assert "stability_rating" in res
            assert "base_slope" in res
            assert "summary_narrative" in res
            print(f"  [PASS] Robustness Evaluator: {name}")
        except Exception as e:
            failures.append((f"Robustness Evaluator: {name}", traceback.format_exc()))
            print(f"  [FAIL] Robustness Evaluator: {name} -> {e}")

    print("=" * 60)
    print(f"SCIENTIFIC FUZZING COMPLETE: {tests_run - len(failures)}/{tests_run} PASSED")
    if failures:
        print(f"FAILED TESTS ({len(failures)}):")
        for f_name, f_err in failures:
            print(f"\n--- {f_name} ---\n{f_err}")
        sys.exit(1)
    else:
        print("ALL SCIENTIFIC EDGE CASES PASSED WITH 100% MATHEMATICAL STABILITY!")
        sys.exit(0)

if __name__ == "__main__":
    run_fuzz_tests()
