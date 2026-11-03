import urllib.request
import json

def run_export_verification():
    # First get an analysis_id
    payload = {
        'dataset_id': 'nasa_power',
        'variable_id': 'T2M',
        'start_year': 2000,
        'end_year': 2023,
        'bbox': [-100.0, 30.0, -95.0, 35.0]
    }
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/analysis',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read())
    aid = data['analysis_id']
    print(f"Analysis created: {aid}")

    endpoints = [
        ("/export/netcdf", "application/x-netcdf", "NetCDF-4"),
        ("/export/geojson", "application/geo+json", "GeoJSON"),
        ("/export/dossier", "text/markdown", "Science Dossier"),
        ("/export/notebook", "application/x-ipynb+json", "Jupyter Notebook"),
        ("/export/latex", "application/x-latex", "LaTeX Technical Memo"),
        ("/export/colab", "application/json", "Google Colab Launcher"),
    ]

    for sub, expected_type, name in endpoints:
        url = f"http://127.0.0.1:8000/api/v1/analysis/{aid}{sub}"
        try:
            r = urllib.request.urlopen(url)
            content_type = r.headers.get("content-type", "")
            content = r.read()
            print(f"[{name}] HTTP {r.status} | Content-Type: {content_type} | Size: {len(content)} bytes")
            # Validation checks
            if "geojson" in sub:
                gj = json.loads(content)
                assert gj.get("type") == "FeatureCollection", f"Invalid GeoJSON: {gj.keys()}"
                print(f"   -> Valid GeoJSON FeatureCollection with {len(gj.get('features', []))} features")
            elif "notebook" in sub:
                nb = json.loads(content)
                assert "cells" in nb, f"Invalid Jupyter Notebook: {nb.keys()}"
                print(f"   -> Valid Jupyter Notebook with {len(nb.get('cells', []))} cells")
            elif "dossier" in sub:
                text = content.decode("utf-8")
                assert "# " in text, "Invalid Dossier Markdown"
                print(f"   -> Valid Markdown Dossier with {len(text.splitlines())} lines")
            elif "latex" in sub:
                text = content.decode("utf-8")
                assert "\\documentclass" in text or "\\begin" in text or "table" in text, "Invalid LaTeX"
                print(f"   -> Valid LaTeX document with {len(text.splitlines())} lines")
            elif "colab" in sub:
                colab = json.loads(content)
                assert "colab_launcher_url" in colab, "Missing colab_launcher_url"
                print(f"   -> Valid Colab launcher URL: {colab['colab_launcher_url'][:60]}...")
        except Exception as e:
            print(f"[{name}] FAILED: {e}")

if __name__ == "__main__":
    run_export_verification()

