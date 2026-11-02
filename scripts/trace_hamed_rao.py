import sys
from pathlib import Path
backend_dir = Path("backend").resolve()
sys.path.insert(0, str(backend_dir))

import numpy as np
from app.adapters.merra2 import MERRA2Adapter
from app.science.trend import compute_spatial_trends, mann_kendall_test, hamed_rao_variance_correction

adapter = MERRA2Adapter()
raw = adapter.fetch_subset("T2M", 2000, 2023, bbox=[-100.0, 30.0, -95.0, 35.0])
data_3d = raw["data"]
years = raw["time"]
time_coords = (years - 2000) / 10.0

lat_idx, lon_idx = 5, 0
series = data_3d[:, lat_idx, lon_idx]

# In 1D:
mk = mann_kendall_test(series, alpha=0.05, correct_autocorrelation=True)
mk_nocorr = mann_kendall_test(series, alpha=0.05, correct_autocorrelation=False)

print(f"1D with autocorrelation correction: var_s={mk['var_s']:.2f}, z={mk['z']:.3f}, p_val={mk['p_value']}")
print(f"1D without autocorrelation:         var_s={mk_nocorr['var_s']:.2f}, z={mk_nocorr['z']:.3f}, p_val={mk_nocorr['p_value']}")

# In 3D:
# Let's inspect hamed_rao_variance_correction on data_3d
n_samples = np.sum(~np.isnan(data_3d), axis=0)
base_var = (n_samples * (n_samples - 1) * (2 * n_samples + 5)) / 18.0
var_corrected_3d = hamed_rao_variance_correction(data_3d, base_var)

print(f"3D base_var at (5, 0):              {base_var[lat_idx, lon_idx]:.2f}")
print(f"3D var_corrected_3d at (5, 0):      {var_corrected_3d[lat_idx, lon_idx]:.2f}")

# And what was hamed_rao_variance_correction in 1D?
var_corrected_1d = hamed_rao_variance_correction(series, base_var[lat_idx, lon_idx])
print(f"1D hamed_rao_variance_correction:   {var_corrected_1d:.2f}")
