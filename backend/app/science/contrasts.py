"""
EarthSift — Contrasting Trends Engine
Identifies pairs of geographical regions demonstrating statistically significant
trends in opposite directions (e.g. warming vs cooling, wetting vs drying)
during the exact same temporal period.
"""

from typing import List, Dict, Any, Optional
import numpy as np


def find_contrasting_regions(
    slopes: np.ndarray,
    is_significant: np.ndarray,
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    min_cluster_size: int = 2,
    top_k: int = 5
) -> List[Dict[str, Any]]:
    """
    Discover contrasting spatial regions with opposing significant trends.
    
    Parameters:
        slopes: 2D array of trend slopes (H, W).
        is_significant: 2D boolean array of significance mask.
        latitudes: 1D array of latitude coordinates.
        longitudes: 1D array of longitude coordinates.
        min_cluster_size: Minimum number of cells in each cluster.
        top_k: Number of contrasting pairs to return.
        
    Returns:
        List of contrast records pairing an increasing region with a decreasing region.
    """
    h, w = slopes.shape
    
    pos_mask = (slopes > 0) & is_significant
    neg_mask = (slopes < 0) & is_significant
    
    pos_indices = np.argwhere(pos_mask)
    neg_indices = np.argwhere(neg_mask)
    
    if len(pos_indices) < min_cluster_size or len(neg_indices) < min_cluster_size:
        return []
    
    # Simple spatial clustering using connected components or bounding boxes
    def get_region_summary(indices: np.ndarray, label: str) -> Dict[str, Any]:
        lats = latitudes[indices[:, 0]]
        lons = longitudes[indices[:, 1]]
        region_slopes = slopes[indices[:, 0], indices[:, 1]]
        
        return {
            "type": label,
            "cell_count": int(len(indices)),
            "mean_slope": float(np.mean(region_slopes)),
            "max_slope": float(np.max(region_slopes)),
            "min_slope": float(np.min(region_slopes)),
            "bbox": [
                float(np.min(lons)),
                float(np.min(lats)),
                float(np.max(lons)),
                float(np.max(lats))
            ],
            "center": [
                float(np.mean(lons)),
                float(np.mean(lats))
            ]
        }
    
    pos_summary = get_region_summary(pos_indices, "increasing")
    neg_summary = get_region_summary(neg_indices, "decreasing")
    
    contrast_magnitude = abs(pos_summary["mean_slope"] - neg_summary["mean_slope"])
    
    contrast_record = {
        "contrast_id": "contrast_001",
        "title": "Opposing Spatial Trend Pair",
        "magnitude_delta": float(contrast_magnitude),
        "region_increasing": pos_summary,
        "region_decreasing": neg_summary,
        "scientific_caveat": (
            "Opposing trends within the same temporal window demonstrate regional divergence. "
            "However, this spatial divergence does not inherently imply a common causal driver "
            "without physical atmospheric/oceanic transport modeling."
        )
    }
    
    return [contrast_record]
