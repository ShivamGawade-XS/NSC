import sys
from pathlib import Path
backend_dir = Path("backend").resolve()
sys.path.insert(0, str(backend_dir))

import numpy as np
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import compute_spatial_trends, mann_kendall_test

adapter = MERRA2Adapter()
raw = adapter.fetch_subset("T2M", 2000, 2023, bbox=[-100.0, 30.0, -95.0, 35.0])
data_3d = raw["data"]
years = raw["time"]
time_coords = (years - 2000) / 10.0

trend_results = compute_spatial_trends(data_3d, time_coords=time_coords, alpha=0.05)
p_2d = trend_results["p_values"]

lat_idx, lon_idx = 5, 0 # lat=35.0, lon=-96.0
series = data_3d[:, lat_idx, lon_idx]
mk = mann_kendall_test(series, alpha=0.05)

print(f"Cell lat_idx={lat_idx}, lon_idx={lon_idx}")
print(f"Series: {series}")
print(f"compute_spatial_trends p-value: {p_2d[lat_idx, lon_idx]}")
print(f"mann_kendall_test p-value:      {mk['p_value']}")
print(f"mk S={mk['s']}, var_s={mk['var_s']}")
