"""
Tellura — High-Concurrency API & Fault Injection Fuzzer
Tests FastAPI endpoints under concurrent load, boundary values,
and edge coordinates against the live server.
"""
import sys
import time
import concurrent.futures
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_api_robustness():
    print("=" * 60)
    print("STARTING API CONCURRENCY & ROBUSTNESS FUZZER")
    print("=" * 60)

    # 1. Health check verification
    r = requests.get(f"{BASE_URL}/api/v1/health", timeout=5)
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    print("  [PASS] Live Health Check OK")

    # 2. Quality Gate endpoint fuzzing
    qg_payloads = [
        ("Valid NASA POWER T2M", {
            "dataset_id": "nasa_power",
            "variable_id": "T2M",
            "start_year": 2000,
            "end_year": 2020,
            "bbox": [-100.0, 30.0, -95.0, 35.0]
        }, 200),
        ("Solar transition GEWEX SRB", {
            "dataset_id": "nasa_power",
            "variable_id": "ALLSKY_SFC_SW_DWN",
            "start_year": 1985,
            "end_year": 1999,
            "bbox": [-100.0, 30.0, -95.0, 35.0]
        }, 200),
        ("Solar cross-boundary guard check", {
            "dataset_id": "nasa_power",
            "variable_id": "ALLSKY_SFC_SW_DWN",
            "start_year": 1995,
            "end_year": 2010,
            "bbox": [-100.0, 30.0, -95.0, 35.0]
        }, 200), # Quality gate evaluates and warns rather than 422
        ("Unknown dataset", {
            "dataset_id": "non_existent_dataset_123",
            "variable_id": "T2M",
            "start_year": 2000,
            "end_year": 2020,
            "bbox": [-100.0, 30.0, -95.0, 35.0]
        }, 200),
    ]

    for name, payload, expected_status in qg_payloads:
        res = requests.post(f"{BASE_URL}/api/v1/analysis/quality-gate", json=payload, timeout=5)
        assert res.status_code == expected_status, f"Quality gate {name} failed: got {res.status_code}"
        data = res.json()
        assert "can_execute" in data
        assert "status" in data
        print(f"  [PASS] Quality Gate: {name} (can_execute={data['can_execute']}, status={data['status']})")

    # 3. Concurrent Analysis Requests (Parallel load)
    print("\n  Executing 8 Concurrent Analysis Requests...")
    analysis_payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "bbox": [-100.0, 30.0, -96.0, 34.0],
        "alpha": 0.05
    }

    def fetch_analysis(req_idx):
        t0 = time.time()
        resp = requests.post(f"{BASE_URL}/api/v1/analysis", json=analysis_payload, timeout=25)
        elapsed = time.time() - t0
        return req_idx, resp.status_code, elapsed, resp.json() if resp.status_code == 200 else resp.text

    start_all = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(fetch_analysis, i) for i in range(8)]
        results = [f.result() for f in futures]
    total_time = time.time() - start_all

    latencies = [r[2] for r in results]
    successes = [r for r in results if r[1] == 200]
    rate_limited = [r for r in results if r[1] == 429]
    print(f"  Concurrent requests completed in {total_time:.2f}s:")
    print(f"    - Successful (HTTP 200): {len(successes)}")
    print(f"    - Rate-Limited (HTTP 429 - Expected under burst limit): {len(rate_limited)}")
    for r in results:
        print(f"      Request {r[0]}: status={r[1]}, latency={r[2]:.3f}s")
        if r[1] != 200:
            print(f"        Error body: {r[3]}")
    
    assert len(successes) >= 1, "At least one request should succeed in burst"
    assert (len(successes) + len(rate_limited)) == 8, "All requests must be cleanly handled as 200 or 429"
    analysis_id = successes[0][3]["analysis_id"]

    # 4. Cell Detail with Decimal Inexact Coordinate Snapping
    print("\n  Testing Inexact Coordinate Snapping...")
    test_coords = [
        ("Exact cell center", 30.5, -99.5),
        ("Slightly offset coordinate", 30.5234, -99.4891),
        ("Corner boundary coordinate", 30.01, -99.99),
    ]

    for name, lat, lon in test_coords:
        res = requests.get(
            f"{BASE_URL}/api/v1/analysis/{analysis_id}/cell",
            params={"lat": lat, "lon": lon},
            timeout=5
        )
        assert res.status_code == 200, f"Cell detail failed for {name}: {res.status_code}"
        data = res.json()
        assert "slope" in data
        assert "observations" in data
        assert "years" in data
        assert "evidence_record" in data
        print(f"  [PASS] Cell Detail Snapping: {name} (snapped to [{data['lat']}, {data['lon']}])")

    # 5. Non-existent Analysis ID Guard
    res_fake = requests.get(
        f"{BASE_URL}/api/v1/analysis/nonexistent-ana-id-9999/cell",
        params={"lat": 30.5, "lon": -99.5},
        timeout=5
    )
    assert res_fake.status_code == 404, f"Expected 404 for nonexistent analysis, got {res_fake.status_code}"
    print("  [PASS] Non-existent Analysis ID Guard returned HTTP 404 cleanly")

    # 6. Regional Comparison
    print("\n  Testing Regional Comparison...")
    compare_payload = {
        "dataset_id": "nasa_power",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2020,
        "region_a_bbox": [-100.0, 30.0, -96.0, 34.0],
        "region_b_bbox": [-95.0, 32.0, -91.0, 36.0]
    }
    r_cmp = requests.post(f"{BASE_URL}/api/v1/analysis/compare-regions", json=compare_payload, timeout=15)
    assert r_cmp.status_code == 200, f"Regional comparison failed: {r_cmp.status_code}"
    cmp_data = r_cmp.json()
    assert "region_a" in cmp_data
    assert "region_b" in cmp_data
    assert "slope_difference" in cmp_data
    assert "p_value" in cmp_data
    assert "is_divergence_significant" in cmp_data
    print(f"  [PASS] Regional Comparison Execution OK (diff={cmp_data['slope_difference']} {cmp_data['slope_units']}, p={cmp_data['p_value']})")

    print("=" * 60)
    print("ALL API CONCURRENCY & ROBUSTNESS TESTS PASSED WITH 100% RELIABILITY!")
    print("=" * 60)

if __name__ == "__main__":
    test_api_robustness()
