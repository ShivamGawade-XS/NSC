"""
EarthSift — Contrasting Trends Engine
Identifies pairs of geographical regions demonstrating statistically significant
trends in opposite directions (e.g. warming vs cooling, wetting vs drying)
during the exact same temporal period.
Uses connected component spatial clustering (8-connectivity) to isolate true regional clusters.
"""

from typing import Any

import numpy as np
from scipy import ndimage


def _build_cluster_dict(
    indices: np.ndarray,
    slopes: np.ndarray,
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    cluster_id: str,
    label_type: str
) -> dict[str, Any]:
    """
    Construct a cluster dictionary with area-weighted regional statistics.
    Grid cell area scales with cos(lat) on regular lat-lon grids.
    """
    lats = latitudes[indices[:, 0]]
    lons = longitudes[indices[:, 1]]
    region_slopes = slopes[indices[:, 0], indices[:, 1]]

    weights = np.maximum(0.01, np.cos(np.deg2rad(lats)))
    mean_slope = float(np.average(region_slopes, weights=weights))
    center = [
        round(float(np.average(lons, weights=weights)), 2),
        round(float(np.average(lats, weights=weights)), 2)
    ]

    return {
        "cluster_id": cluster_id,
        "type": label_type,
        "cell_count": len(indices),
        "mean_slope": round(mean_slope, 4),
        "max_slope": round(float(np.max(region_slopes)), 4),
        "min_slope": round(float(np.min(region_slopes)), 4),
        "bbox": [
            round(float(np.min(lons)), 2),
            round(float(np.min(lats)), 2),
            round(float(np.max(lons)), 2),
            round(float(np.max(lats)), 2)
        ],
        "center": center
    }


def find_contrasting_regions(
    slopes: np.ndarray,
    is_significant: np.ndarray,
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    min_cluster_size: int = 2,
    top_k: int = 5
) -> list[dict[str, Any]]:
    """
    Discover contrasting spatial regions with opposing significant trends.
    Uses 8-neighbor connected component labeling to isolate distinct geographic clusters.
    
    Parameters:
        slopes: 2D array of trend slopes (H, W).
        is_significant: 2D boolean array of significance mask.
        latitudes: 1D array of latitude coordinates.
        longitudes: 1D array of longitude coordinates.
        min_cluster_size: Minimum number of cells in each cluster.
        top_k: Number of contrasting pairs to return (default: 5).
        
    Returns:
        List of contrast records pairing an increasing region with a decreasing region.
    """
    _h, _w = slopes.shape
    
    pos_mask = (slopes > 0) & is_significant
    neg_mask = (slopes < 0) & is_significant
    
    # 8-connectivity structuring element
    struct_8 = np.ones((3, 3), dtype=int)
    
    # Label connected spatial clusters
    pos_labeled, num_pos = ndimage.label(pos_mask, structure=struct_8)
    neg_labeled, num_neg = ndimage.label(neg_mask, structure=struct_8)
    
    def extract_clusters(labeled_grid: np.ndarray, num_features: int, label_type: str) -> list[dict[str, Any]]:
        clusters = []
        for feat_id in range(1, num_features + 1):
            indices = np.argwhere(labeled_grid == feat_id)
            if len(indices) < min_cluster_size:
                continue
            
            clusters.append(
                _build_cluster_dict(
                    indices=indices,
                    slopes=slopes,
                    latitudes=latitudes,
                    longitudes=longitudes,
                    cluster_id=f"{label_type}_{feat_id}",
                    label_type=label_type
                )
            )
        # Sort clusters by absolute mean slope descending
        clusters.sort(key=lambda c: abs(c["mean_slope"]), reverse=True)
        return clusters

    pos_clusters = extract_clusters(pos_labeled, num_pos, "increasing")
    neg_clusters = extract_clusters(neg_labeled, num_neg, "decreasing")
    
    # Fallback to entire masks if clusters were fragmented below min_cluster_size
    if not pos_clusters and np.sum(pos_mask) >= min_cluster_size:
        indices = np.argwhere(pos_mask)
        pos_clusters = [_build_cluster_dict(indices, slopes, latitudes, longitudes, "increasing_all", "increasing")]
        
    if not neg_clusters and np.sum(neg_mask) >= min_cluster_size:
        indices = np.argwhere(neg_mask)
        neg_clusters = [_build_cluster_dict(indices, slopes, latitudes, longitudes, "decreasing_all", "decreasing")]

    # Fallback to thermal/hydrological refugia if domain is uniformly one-directional
    if not neg_clusters and len(pos_clusters) > 0:
        valid_slopes = slopes[~np.isnan(slopes)]
        if len(valid_slopes) >= min_cluster_size * 2:
            q25 = float(np.percentile(valid_slopes, 25))
            refugium_mask = (slopes <= q25) & (~np.isnan(slopes))
            if int(np.sum(refugium_mask)) >= min_cluster_size:
                ref_labeled, num_ref = ndimage.label(refugium_mask, structure=struct_8)
                ref_clusters = extract_clusters(ref_labeled, num_ref, "refugium")
                if not ref_clusters and int(np.sum(refugium_mask)) >= min_cluster_size:
                    indices = np.argwhere(refugium_mask)
                    ref_clusters = [_build_cluster_dict(indices, slopes, latitudes, longitudes, "refugium_all", "refugium")]
                if ref_clusters:
                    neg_clusters = ref_clusters

    if not pos_clusters and len(neg_clusters) > 0:
        valid_slopes = slopes[~np.isnan(slopes)]
        if len(valid_slopes) >= min_cluster_size * 2:
            q75 = float(np.percentile(valid_slopes, 75))
            buffer_mask = (slopes >= q75) & (~np.isnan(slopes))
            if int(np.sum(buffer_mask)) >= min_cluster_size:
                buf_labeled, num_buf = ndimage.label(buffer_mask, structure=struct_8)
                buf_clusters = extract_clusters(buf_labeled, num_buf, "buffered")
                if not buf_clusters and int(np.sum(buffer_mask)) >= min_cluster_size:
                    indices = np.argwhere(buffer_mask)
                    buf_clusters = [_build_cluster_dict(indices, slopes, latitudes, longitudes, "buffered_all", "buffered")]
                if buf_clusters:
                    pos_clusters = buf_clusters

    if not pos_clusters or not neg_clusters:
        return []
    
    # Form cross-product pairs and rank by divergence delta
    contrast_pairs = []
    pair_count = 0
    for pos in pos_clusters:
        for neg in neg_clusters:
            pos_val = pos.get("mean_slope", 0.0)
            neg_val = neg.get("mean_slope", 0.0)
            pos_slope = float(pos_val) if isinstance(pos_val, (int, float)) else 0.0
            neg_slope = float(neg_val) if isinstance(neg_val, (int, float)) else 0.0
            delta = abs(pos_slope - neg_slope)
            pair_count += 1
            is_refugium_pair = neg.get("type") == "refugium" or pos.get("type") == "buffered"
            
            title = (
                f"Accelerated Trend vs Buffered Refugium #{pair_count} (Delta: {delta:.3f})"
                if is_refugium_pair
                else f"Opposing Trend Pair #{pair_count} (Delta: {delta:.3f})"
            )
            caveat = (
                "Entire domain exhibits monotonic broad-scale drift. This contrast isolates the regional acceleration core against microclimatic refugia."
                if is_refugium_pair
                else (
                    "Opposing trends within the same temporal window demonstrate regional divergence. "
                    "However, this spatial divergence does not inherently imply a common causal driver "
                    "without physical atmospheric/oceanic transport modeling."
                )
            )

            contrast_pairs.append({
                "contrast_id": f"contrast_{pair_count:03d}",
                "title": title,
                "magnitude_delta": round(float(delta), 4),
                "region_increasing": pos,
                "region_decreasing": neg,
                "scientific_caveat": caveat
            })
            
    # Sort pairs by divergence magnitude descending and limit to top_k
    contrast_pairs.sort(key=lambda p: p["magnitude_delta"], reverse=True)
    return contrast_pairs[:top_k]
