"""
Verification script for React 19 + Vite 8 SPA and FastAPI full-stack integration.
Asserts:
  1. GET / -> HTTP 200 (text/html)
  2. GET /dashboard -> HTTP 200 (text/html)
  3. GET /api/v1/health -> HTTP 200 (application/json)
  4. GET /api/v1/does-not-exist -> HTTP 404 (application/json, NOT HTML)
"""
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

def verify_integration():
    client = TestClient(app)

    print("--- [1] GET / ---")
    res_root = client.get("/")
    print(f"Status: {res_root.status_code}")
    print(f"Content-Type: {res_root.headers.get('content-type')}")
    assert res_root.status_code == 200, f"Expected 200, got {res_root.status_code}"
    assert "text/html" in res_root.headers.get("content-type", ""), f"Expected text/html, got {res_root.headers.get('content-type')}"
    assert "<!doctype html>" in res_root.text.lower(), "Expected HTML doctype in response"
    print("[PASS] GET / returned HTTP 200 text/html with valid HTML doctype.")

    print("\n--- [2] GET /dashboard ---")
    res_dash = client.get("/dashboard")
    print(f"Status: {res_dash.status_code}")
    print(f"Content-Type: {res_dash.headers.get('content-type')}")
    assert res_dash.status_code == 200, f"Expected 200, got {res_dash.status_code}"
    assert "text/html" in res_dash.headers.get("content-type", ""), f"Expected text/html, got {res_dash.headers.get('content-type')}"
    assert "<!doctype html>" in res_dash.text.lower(), "Expected HTML doctype in response"
    print("[PASS] GET /dashboard returned HTTP 200 text/html with valid HTML doctype.")

    print("\n--- [3] GET /api/v1/health ---")
    res_health = client.get("/api/v1/health")
    print(f"Status: {res_health.status_code}")
    print(f"Content-Type: {res_health.headers.get('content-type')}")
    print(f"Body: {res_health.text}")
    assert res_health.status_code == 200, f"Expected 200, got {res_health.status_code}"
    assert "application/json" in res_health.headers.get("content-type", ""), f"Expected application/json, got {res_health.headers.get('content-type')}"
    health_json = res_health.json()
    assert health_json.get("status") == "healthy", f"Expected status=='healthy', got {health_json}"
    print("[PASS] GET /api/v1/health returned HTTP 200 application/json.")

    print("\n--- [4] GET /api/v1/does-not-exist ---")
    res_404 = client.get("/api/v1/does-not-exist")
    print(f"Status: {res_404.status_code}")
    print(f"Content-Type: {res_404.headers.get('content-type')}")
    print(f"Body: {res_404.text}")
    assert res_404.status_code == 404, f"Expected 404, got {res_404.status_code}"
    assert "application/json" in res_404.headers.get("content-type", ""), f"Expected application/json, got {res_404.headers.get('content-type')}"
    assert "text/html" not in res_404.headers.get("content-type", ""), "Error: Received text/html for unmapped API endpoint!"
    assert "<!doctype html>" not in res_404.text.lower(), "Error: HTML doctype detected in 404 response!"
    assert res_404.json() == {"detail": "API endpoint not found"}, f"Unexpected error body: {res_404.json()}"
    print("[PASS] GET /api/v1/does-not-exist returned HTTP 404 application/json (NOT HTML).")

    print("\n==========================================")
    print("ALL FULL-STACK INTEGRATION CHECKS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    verify_integration()
