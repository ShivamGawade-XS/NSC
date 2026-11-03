"""Memory measurement test for spatial chunking."""
import sys, os, time, tracemalloc
sys.path.insert(0, 'backend')
os.environ.setdefault("ENVIRONMENT", "test")
import numpy as np
from app.science.trend import compute_spatial_trends

# Test: 80x80 grid (6400 cells, 30 time steps)
np.random.seed(42)
t_len, h_len, w_len = 30, 80, 80
data = np.random.uniform(270, 310, (t_len, h_len, w_len))

tracemalloc.start()
t0 = time.time()
res = compute_spatial_trends(data, alpha=0.05, decadal_scale=10.0, chunk_size_cells=400)
elapsed = time.time() - t0
current, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()
print(f"80x80 grid (6400 cells, 30 steps) chunked:")
print(f"  Time: {elapsed:.2f}s")
print(f"  Peak RAM (delta): {peak/1024/1024:.1f}MB")
print(f"  Slopes shape: {res['slopes'].shape}")
print(f"  p_values shape: {res['p_values'].shape}")
print("  Status: PASS")
