import urllib.request
import urllib.error
import json

base_url = "http://127.0.0.1:8000/api/v1"

def post_json(endpoint, payload):
    req = urllib.request.Request(
        f"{base_url}{endpoint}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        res = urllib.request.urlopen(req)
        return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except:
            parsed = body
        return e.code, parsed

def test_failures():
    print("=== TESTING CONTROLLED FAILURE INJECTIONS ===")

    # 1. Unknown dataset
    code, res = post_json("/analysis", {
        "dataset_id": "invalid_dataset_xyz",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
    })
    print(f"[1] Unknown dataset: HTTP {code} -> {res}")
    assert code == 404, f"Expected 404, got {code}"

    # 2. Invalid coordinates (lat > 90)
    code, res = post_json("/analysis", {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-100.0, 95.0, -95.0, 100.0]
    })
    print(f"[2] Invalid coords (lat > 90): HTTP {code} -> {res}")
    assert code in (400, 422), f"Expected 400/422, got {code}"

    # 3. Reversed bbox (min_lat >= max_lat)
    code, res = post_json("/analysis", {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2000,
        "end_year": 2023,
        "bbox": [-95.0, 35.0, -100.0, 30.0]
    })
    print(f"[3] Reversed bbox: HTTP {code} -> {res}")
    assert code in (400, 422), f"Expected 400/422, got {code}"

    # 4. Start year > end year
    code, res = post_json("/analysis", {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2020,
        "end_year": 2010,
    })
    print(f"[4] start_year > end_year: HTTP {code} -> {res}")
    assert code in (400, 422), f"Expected 400/422, got {code}"

    # 5. Fewer than 3 years (n < 3)
    code, res = post_json("/analysis", {
        "dataset_id": "merra2_reanalysis",
        "variable_id": "T2M",
        "start_year": 2020,
        "end_year": 2021,
    })
    print(f"[5] n < 3 years: HTTP {code} -> {res}")
    assert code in (400, 422), f"Expected 400/422, got {code}"

    # 6. Solar irradiance instrument transition guard (1995-2010)
    code, res = post_json("/analysis", {
        "dataset_id": "nasa_power",
        "variable_id": "ALLSKY_SFC_SW_DWN",
        "start_year": 1995,
        "end_year": 2010,
        "bbox": [-100.0, 30.0, -95.0, 35.0]
    })
    print(f"[6] Solar transition boundary guard: HTTP {code} -> {res}")
    assert code == 422, f"Expected 422, got {code}"
    assert "transition boundary" in str(res) or "instrument transition" in str(res)

    # 7. Unmapped API route
    try:
        urllib.request.urlopen(f"{base_url}/nonexistent-route-xyz")
    except urllib.error.HTTPError as e:
        print(f"[7] Unmapped route: HTTP {e.code} -> {e.read().decode('utf-8')}")
        assert e.code == 404

    # 8. Body larger than 2MB
    huge_data = b"x" * (2 * 1024 * 1024 + 1024)
    req = urllib.request.Request(
        f"{base_url}/analysis",
        data=huge_data,
        headers={"Content-Type": "application/json", "Content-Length": str(len(huge_data))}
    )
    try:
        urllib.request.urlopen(req)
        print("[8] Huge body FAILED to trigger 413!")
    except urllib.error.HTTPError as e:
        print(f"[8] Huge body (>2MB): HTTP {e.code} -> {e.read().decode('utf-8')}")
        assert e.code == 413

    print("\nALL CONTROLLED FAILURE INJECTIONS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    test_failures()
