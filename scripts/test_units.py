import sys
from pathlib import Path
backend_dir = Path("backend").resolve()
sys.path.insert(0, str(backend_dir))

import numpy as np
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import hamed_rao_variance_correction, mann_kendall_test

adapter = MERRA2Adapter()
raw = adapter.fetch_subset("T2M", 2000, 2023, bbox=[-100.0, 30.0, -95.0, 35.0])
data_3d = raw["data"]
t_len = data_3d.shape[0]

# Compute annual slope per step
idx_i, idx_j = np.triu_indices(t_len, k=1)
dy = data_3d[idx_j] - data_3d[idx_i]
dt_years = (idx_j - idx_i)[:, None, None]
annual_slopes = np.nanmedian(dy / dt_years, axis=0)
decadal_slopes = annual_slopes * 10.0

base_var = np.full((6, 6), 1625.333)

# 1. With annual_slopes (correct unit matching t_3d = arange(t_len)):
var_annual = hamed_rao_variance_correction(data_3d, base_var, slope=annual_slopes)

# 2. With slope=None (recomputes annual slope inside):
var_none = hamed_rao_variance_correction(data_3d, base_var, slope=None)

# 3. With decadal_slopes (the old bug):
var_buggy = hamed_rao_variance_correction(data_3d, base_var, slope=decadal_slopes)

# 4. 1D mann_kendall_test for cell (5, 4):
mk_1d = mann_kendall_test(data_3d[:, 5, 4], 0.05)

print(f"Cell (5, 4):")
print(f"1D mann_kendall_test var_s:    {mk_1d['var_s']:.3f}, p_value: {mk_1d['p_value']}")
print(f"3D with annual_slopes:          {var_annual[5, 4]:.3f}")
print(f"3D with slope=None:             {var_none[5, 4]:.3f}")
print(f"3D with decadal_slopes (BUG):   {var_buggy[5, 4]:.3f}")
