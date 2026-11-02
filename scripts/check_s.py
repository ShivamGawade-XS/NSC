import sys
from pathlib import Path
backend_dir = Path("backend").resolve()
sys.path.insert(0, str(backend_dir))

import numpy as np
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import compute_spatial_trends

adapter = MERRA2Adapter()
raw = adapter.fetch_subset("T2M", 2000, 2023, bbox=[-100.0, 30.0, -95.0, 35.0])
data_3d = raw["data"]
years = raw["time"]
time_coords = (years - 2000) / 10.0

trend_results = compute_spatial_trends(data_3d, time_coords=time_coords, alpha=0.05)

lat_idx, lon_idx = 5, 0
series = data_3d[:, lat_idx, lon_idx]

# Let's inspect step by step in compute_spatial_trends
t_len = len(years)
idx_i, idx_j = np.triu_indices(t_len, k=1)
dy = data_3d[idx_j] - data_3d[idx_i]
s_2d = np.nansum(np.sign(dy), axis=0)

print(f"s_2d at ({lat_idx}, {lon_idx}): {s_2d[lat_idx, lon_idx]}")

# 1D S
diff_1d = series[None, :] - series[:, None]
iu = np.triu_indices(t_len, k=1)
s_1d = np.sum(np.sign(diff_1d[iu]))
print(f"s_1d at ({lat_idx}, {lon_idx}): {s_1d}")
print(f"diff_1d[iu] vs dy[:, lat_idx, lon_idx]:")
print(f"diff_1d shape: {diff_1d[iu].shape}, dy shape: {dy[:, lat_idx, lon_idx].shape}")
print(f"Are they equal? {np.array_equal(diff_1d[iu], dy[:, lat_idx, lon_idx])}")
print(f"diff_1d[iu][:10]: {diff_1d[iu][:10]}")
print(f"dy[:10, lat_idx, lon_idx]: {dy[:10, lat_idx, lon_idx]}")
