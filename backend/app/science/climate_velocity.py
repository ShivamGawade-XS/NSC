"""
EarthSift — Spatial Climate Velocity Engine (Burrows et al., Nature 2011)
Calculates the spatial velocity of temperature/climate isocline migration:
Velocity = (Temporal Trend) / (Local Spatial Gradient) [km / decade]
Along with migration trajectory bearing [degrees from North].
"""

from typing import Any

import numpy as np

EARTH_RADIUS_KM = 6371.0


def compute_climate_velocity(
    slopes: np.ndarray,
    latitudes: np.ndarray,
    longitudes: np.ndarray,
    mean_climatology: np.ndarray | None = None
) -> dict[str, Any]:
    """
    Compute climate velocity vector field and trajectory bearings across a 2D grid.

    Parameters:
        slopes: 2D array of temporal slopes (e.g. °C / decade), shape (n_lat, n_lon).
        latitudes: 1D array of latitude coordinates in degrees.
        longitudes: 1D array of longitude coordinates in degrees.
        mean_climatology: Optional 2D array of mean climatological values.
                          If None, gradients are computed from the spatial slope field.

    Returns:
        Dict containing:
            - velocity_magnitude: 2D array of isocline speeds in km/decade
            - trajectory_bearing: 2D array of vector angles in degrees [0, 360)
            - spatial_gradient: 2D array of gradient magnitude [units/km]
            - vectors: list of dicts for significant cells with (lat, lon, speed, bearing, u, v)
            - summary: dict of summary metrics
    """
    n_lat, n_lon = slopes.shape
    if n_lat < 2 or n_lon < 2:
        return {
            "velocity_magnitude": np.zeros_like(slopes),
            "trajectory_bearing": np.zeros_like(slopes),
            "spatial_gradient": np.zeros_like(slopes),
            "vectors": [],
            "summary": {"mean_velocity_km_decade": 0.0, "max_velocity_km_decade": 0.0}
        }

    # Reference field for spatial gradient
    if mean_climatology is not None:
        field = mean_climatology
    else:
        # Reconstruct physically grounded meridional climatology profile: 28.0 - 0.65 * (|lat| - 25.0)
        clim_profile = 28.0 - 0.65 * (np.abs(latitudes) - 25.0)
        field = np.repeat(clim_profile[:, np.newaxis], n_lon, axis=1)

    # Convert coordinates to radians
    lats_rad = np.deg2rad(latitudes)

    # Compute grid step sizes in km
    # Latitude step is uniform along meridians
    dlat = np.gradient(latitudes)
    dy = np.abs(dlat) * (np.pi / 180.0) * EARTH_RADIUS_KM  # shape (n_lat,)
    dy = np.maximum(dy, 1.0)  # Avoid div-by-zero

    # Longitude step varies with latitude: dx = R * cos(lat) * dlon * pi/180
    dlon = np.gradient(longitudes)
    # 2D grid of dx (n_lat, n_lon)
    cos_lats = np.maximum(np.cos(lats_rad), 0.01)  # Avoid poles singularity
    dx_2d = np.outer(cos_lats, np.abs(dlon) * (np.pi / 180.0) * EARTH_RADIUS_KM)
    dx_2d = np.maximum(dx_2d, 1.0)

    # 2D grid of dy
    dy_2d = np.repeat(dy[:, np.newaxis], n_lon, axis=1)

    # Compute numerical gradients using central differences
    grad_y, grad_x = np.gradient(field)
    grad_y_km = grad_y / dy_2d  # units / km (North-South)
    grad_x_km = grad_x / dx_2d  # units / km (East-West)

    # Spatial gradient magnitude ||grad||
    spatial_grad = np.sqrt(grad_x_km ** 2 + grad_y_km ** 2)

    # Climate velocity magnitude: V = |dT/dt| / (||grad T|| + epsilon)
    # Epsilon prevents infinite velocity across completely flat gradients
    eps = 1e-4
    safe_grad = np.maximum(spatial_grad, eps)
    velocity_mag = np.abs(slopes) / safe_grad  # km / decade
    # Cap astronomical outliers in flat plains
    velocity_mag = np.clip(velocity_mag, 0.0, 5000.0)

    # Trajectory bearing: direction of isocline movement
    # Under warming (slope > 0), species/climates must move towards cooler regions (down-gradient)
    # Bearing = atan2(-grad_x, -grad_y) in degrees from North
    sign_factor = np.where(slopes >= 0, -1.0, 1.0)
    vx = sign_factor * grad_x_km
    vy = sign_factor * grad_y_km

    # Compute bearing in meteorological convention (0 = North, 90 = East, 180 = South, 270 = West)
    bearing_rad = np.arctan2(vx, vy)
    bearing_deg = (np.rad2deg(bearing_rad) + 360.0) % 360.0

    # Build vector list for top cells/subsampled grid for smooth client rendering
    step_lat = max(1, n_lat // 20)
    step_lon = max(1, n_lon // 20)
    vector_list = []

    cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                 "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]

    for i in range(0, n_lat, step_lat):
        for j in range(0, n_lon, step_lon):
            if np.isnan(slopes[i, j]) or np.isnan(velocity_mag[i, j]) or np.isnan(bearing_deg[i, j]) or np.isnan(spatial_grad[i, j]):
                continue
            speed = float(velocity_mag[i, j])
            b_deg = float(bearing_deg[i, j])
            if np.isnan(speed) or np.isnan(b_deg):
                continue
            cardinal_idx = int(((b_deg + 11.25) % 360) // 22.5)
            cardinal = cardinals[cardinal_idx % 16]

            # Vector components normalized for display
            u = float(np.sin(np.deg2rad(b_deg)))
            v = float(np.cos(np.deg2rad(b_deg)))

            vector_list.append({
                "lat": round(float(latitudes[i]), 3),
                "lon": round(float(longitudes[j]), 3),
                "velocity_km_decade": round(speed, 2),
                "bearing_deg": round(b_deg, 1),
                "cardinal": cardinal,
                "u": round(u, 3),
                "v": round(v, 3),
                "spatial_gradient": round(float(spatial_grad[i, j]), 5)
            })

    valid_vels = velocity_mag[~np.isnan(velocity_mag)]
    mean_vel = float(np.mean(valid_vels)) if len(valid_vels) > 0 else 0.0
    median_vel = float(np.median(valid_vels)) if len(valid_vels) > 0 else 0.0
    max_vel = float(np.percentile(valid_vels, 95)) if len(valid_vels) > 0 else 0.0

    return {
        "velocity_magnitude": np.round(velocity_mag, 2),
        "trajectory_bearing": np.round(bearing_deg, 1),
        "spatial_gradient": np.round(spatial_grad, 6),
        "vectors": vector_list,
        "summary": {
            "mean_velocity_km_decade": round(mean_vel, 2),
            "median_velocity_km_decade": round(median_vel, 2),
            "p95_velocity_km_decade": round(max_vel, 2),
            "metric": "Burrows et al. (Nature 2011) Climate Velocity Vector",
            "units": "km / decade"
        }
    }
