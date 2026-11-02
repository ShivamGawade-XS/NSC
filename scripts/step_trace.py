import sys
from pathlib import Path
backend_dir = Path("backend").resolve()
sys.path.insert(0, str(backend_dir))

import numpy as np
from scipy import stats
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import hamed_rao_variance_correction

adapter = MERRA2Adapter()
raw = adapter.fetch_subset("T2M", 2000, 2023, bbox=[-100.0, 30.0, -95.0, 35.0])
data_3d = raw["data"]
t_len, h_len, w_len = data_3d.shape
t_coords = (raw["time"] - 2000) / 10.0
decadal_scale = 1.0

idx_i, idx_j = np.triu_indices(t_len, k=1)
dy = data_3d[idx_j] - data_3d[idx_i]
dt = (t_coords[idx_j] - t_coords[idx_i])[:, None, None]

pairwise_slopes = (dy / dt) * decadal_scale
slopes = np.nanmedian(pairwise_slopes, axis=0)

n_samples = np.sum(~np.isnan(data_3d), axis=0)
s_2d = np.nansum(np.sign(dy), axis=0)

base_var = (n_samples * (n_samples - 1) * (2 * n_samples + 5)) / 18.0

print(f"Before hamed_rao_variance_correction:")
print(f"base_var[5, 4]: {base_var[5, 4]}")

var_s_2d = hamed_rao_variance_correction(data_3d, base_var, slope=slopes)

print(f"After hamed_rao_variance_correction:")
print(f"var_s_2d[5, 4]: {var_s_2d[5, 4]}")

std_s = np.sqrt(np.where(var_s_2d > 0, var_s_2d, 1.0))
z_2d = (s_2d - 1.0) / std_s
print(f"s_2d[5, 4]: {s_2d[5, 4]}")
print(f"std_s[5, 4]: {std_s[5, 4]}")
print(f"z_2d[5, 4]: {z_2d[5, 4]}")

p_values = 2.0 * stats.norm.sf(np.abs(z_2d))
print(f"p_values[5, 4]: {p_values[5, 4]}")
