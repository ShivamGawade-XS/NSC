"""
EarthSift — NASA MERRA-2 Reanalysis Adapter
Provides access to NASA Global Modeling and Assimilation Office (GMAO)
MERRA-2 atmospheric variables:
- T2M: 2-meter Air Temperature (Kelvin / Celsius)
- PRECTOT: Total Precipitation (kg m-2 s-1 / mm/day)

Implements the strict BaseDatasetAdapter contract:
- discover()
- metadata()
- validate()
- fetch()
- subset()
- normalize()
"""

import os
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

from app.adapters.base import BaseDatasetAdapter

logger = logging.getLogger("earthsift.merra2")

# Optional earthaccess import for live NASA CMR querying
try:
    import earthaccess
    HAS_EARTHACCESS = True
except ImportError:
    HAS_EARTHACCESS = False


class MERRA2Adapter(BaseDatasetAdapter):
    """Adapter for NASA MERRA-2 atmospheric reanalysis data."""

    DATASET_ID = "merra2_reanalysis"
    NAME = "NASA MERRA-2 Atmospheric Reanalysis"
    PROVIDER = "NASA GMAO (Global Modeling and Assimilation Office)"
    DOI = "10.5067/A7F0JNNUTWOB"
    SHORT_NAMES = {
        "T2M": "M2TMNXSLV",     # 2-meter Air Temperature in 2D monthly reanalysis
        "PRECTOT": "M2TMNXFLX"  # Total Precipitation in monthly surface flux
    }
    NATIVE_RESOLUTION = "0.5° latitude x 0.625° longitude"
    TEMPORAL_RANGE = [1980, 2024]
    DEFAULT_BBOX = [-125.0, 25.0, -65.0, 50.0]
    COVERAGE_BBOX = [-170.0, 15.0, -50.0, 75.0]

    VARIABLES = {
        "T2M": {
            "name": "2-Meter Air Temperature",
            "source_units": "K",
            "display_units": "°C",
            "slope_units": "°C / decade",
            "description": "Surface air temperature at 2 meters above displacement height."
        },
        "PRECTOT": {
            "name": "Total Precipitation Rate",
            "source_units": "kg m-2 s-1",
            "display_units": "mm / day",
            "slope_units": "mm / day / decade",
            "description": "Surface total precipitation flux including convective and large-scale rain/snow."
        }
    }

    def discover(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Discover collections or granules via NASA CMR.
        If live connection / earthaccess is available, queries CMR directly;
        otherwise returns verified collection catalog metadata.
        """
        results = []
        if HAS_EARTHACCESS:
            try:
                for var, short_name in self.SHORT_NAMES.items():
                    if query and query.upper() not in var and query.upper() not in short_name:
                        continue
                    granules = earthaccess.search_data(
                        short_name=short_name,
                        temporal=("2020-01-01", "2020-01-31"),
                        count=1
                    )
                    count = len(granules)
                    results.append({
                        "variable": var,
                        "short_name": short_name,
                        "cmr_status": "accessible" if count > 0 else "not_found",
                        "granules_found_sample": count,
                        "doi": self.DOI
                    })
                if results:
                    return results
            except Exception as e:
                logger.warning("NASA CMR query failed, falling back to local catalog: %s", e)

        # Fallback to catalog discovery
        for var, info in self.VARIABLES.items():
            if query and query.upper() not in var and query.upper() not in info["name"].upper():
                continue
            results.append({
                "variable": var,
                "short_name": self.SHORT_NAMES.get(var, "UNKNOWN"),
                "name": info["name"],
                "units": info["display_units"],
                "cmr_status": "offline_catalog",
                "doi": self.DOI
            })
        return results

    def metadata(self) -> Dict[str, Any]:
        """Return dataset description and available variable catalog."""
        return {
            "dataset_id": self.DATASET_ID,
            "name": self.NAME,
            "provider": self.PROVIDER,
            "doi": self.DOI,
            "resolution": self.NATIVE_RESOLUTION,
            "temporal_range": self.TEMPORAL_RANGE,
            "variables": self.VARIABLES,
            "default_bbox": self.DEFAULT_BBOX,
            "live_access_available": HAS_EARTHACCESS,
            "citation": "Gelaro et al., 2017: The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). J. Climate, 30, 5419-5454."
        }

    def validate(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: Optional[List[float]] = None
    ) -> None:
        """
        Validate inputs against MERRA-2 specifications.
        Raises ValueError with clear explanation if invalid.
        """
        if variable not in self.VARIABLES:
            raise ValueError(f"Unsupported variable '{variable}'. Available: {list(self.VARIABLES.keys())}")

        if start_year < self.TEMPORAL_RANGE[0] or end_year > self.TEMPORAL_RANGE[1]:
            raise ValueError(
                f"Requested year range [{start_year}, {end_year}] exceeds available bounds "
                f"[{self.TEMPORAL_RANGE[0]}, {self.TEMPORAL_RANGE[1]}]."
            )

        if end_year <= start_year:
            raise ValueError(f"End year ({end_year}) must be strictly greater than start year ({start_year}).")

        # Minimum recommended sample count for meaningful trend detection
        if (end_year - start_year + 1) < 5:
            raise ValueError(
                f"Insufficient sample window ({end_year - start_year + 1} years). "
                "Minimum required for trend analysis is 5 years."
            )

        if bbox is not None:
            if len(bbox) != 4:
                raise ValueError(f"Bounding box must contain 4 elements [min_lon, min_lat, max_lon, max_lat], got {len(bbox)}.")
            min_lon, min_lat, max_lon, max_lat = bbox
            if min_lat >= max_lat:
                raise ValueError(f"Invalid latitude bounds: min_lat ({min_lat}) >= max_lat ({max_lat}).")
            if min_lon >= max_lon:
                raise ValueError(f"Invalid longitude bounds: min_lon ({min_lon}) >= max_lon ({max_lon}).")
            if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
                raise ValueError("Latitude bounds must be within [-90, 90].")
            if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
                raise ValueError("Longitude bounds must be within [-180, 180].")
            c_min_lon, c_min_lat, c_max_lon, c_max_lat = self.COVERAGE_BBOX
            if max_lon < c_min_lon or min_lon > c_max_lon or max_lat < c_min_lat or min_lat > c_max_lat:
                raise ValueError(
                    f"Requested bounding box {bbox} yields empty slice outside dataset coverage {self.COVERAGE_BBOX}."
                )

    def fetch(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: Optional[List[float]] = None,
        prefer_live: bool = True
    ) -> Dict[str, Any]:
        """
        Fetch raw data array from NASA Earthdata stream or reproducible physical fixture.
        Must explicitly report 'is_synthetic' and 'data_source_label'.
        """
        if bbox is None:
            bbox = self.DEFAULT_BBOX

        min_lon, min_lat, max_lon, max_lat = bbox

        # Check for Earthdata credentials
        has_auth = (
            bool(os.environ.get("EARTHDATA_USERNAME") and os.environ.get("EARTHDATA_PASSWORD")) or
            os.path.exists(os.path.expanduser("~/.netrc"))
        )

        # Check for local real NetCDF observations if preferred and available
        if prefer_live or os.environ.get("PREFER_LIVE_DATA") == "1":
            data_dir = Path(os.environ.get("MERRA2_DATA_DIR", Path(__file__).resolve().parent.parent.parent / "data"))
            candidate_paths = [
                data_dir / "fixtures" / f"nasa_merra2_{variable.lower()}_na.nc",
                data_dir / "fixtures" / "nasa_merra2_t2m_na.nc",
                data_dir / "fixtures" / "nasa_merra2_precip_na.nc",
                data_dir / f"{variable}.nc",
                data_dir / "merra2_reanalysis.nc",
                data_dir / "fixtures" / f"{variable}.nc",
                data_dir / "fixtures" / "merra2_reanalysis.nc"
            ]
            nc_file = next((p for p in candidate_paths if p.exists()), None)

            if nc_file:
                try:
                    import xarray as xr
                    with xr.open_dataset(nc_file) as ds:
                        var_key = variable if variable in ds else self.SHORT_NAMES.get(variable)
                        if var_key and var_key in ds:
                            da = ds[var_key]
                            # Handle coordinate names and bounds
                            time_coord = "time" if "time" in da.coords else list(da.coords.keys())[0]
                            lat_coord = "lat" if "lat" in da.coords else "latitude"
                            lon_coord = "lon" if "lon" in da.coords else "longitude"

                            # Subsetting spatially and temporally
                            sub_da = da.sel(
                                {
                                    time_coord: slice(int(start_year), int(end_year)),
                                    lat_coord: slice(float(min_lat), float(max_lat)),
                                    lon_coord: slice(float(min_lon), float(max_lon))
                                }
                            )

                            if sub_da.sizes[time_coord] >= 5 and sub_da.sizes[lat_coord] > 0 and sub_da.sizes[lon_coord] > 0:
                                time_vals = sub_da[time_coord].values
                                if hasattr(sub_da[time_coord], "dt"):
                                    years_arr = np.array(sub_da[time_coord].dt.year, dtype=int)
                                else:
                                    years_arr = np.array(time_vals, dtype=int)

                                var_info = self.VARIABLES[variable]
                                raw_vals = np.asarray(sub_da.values, dtype=float)

                                return {
                                    "dataset_id": self.DATASET_ID,
                                    "variable_id": variable,
                                    "variable_name": var_info["name"],
                                    "data": raw_vals,
                                    "time": years_arr,
                                    "lat": np.asarray(sub_da[lat_coord].values, dtype=float),
                                    "lon": np.asarray(sub_da[lon_coord].values, dtype=float),
                                    "source_units": var_info["source_units"],
                                    "display_units": var_info["display_units"],
                                    "slope_units": var_info["slope_units"],
                                    "is_synthetic": False,
                                    "data_source_label": "NASA GMAO MERRA-2 Reanalysis (Verified NetCDF Observations).",
                                    "provenance": {
                                        "source": self.NAME,
                                        "provider": self.PROVIDER,
                                        "doi": self.DOI,
                                        "resolution": self.NATIVE_RESOLUTION,
                                        "time_span": f"{start_year} - {end_year}",
                                        "grid_shape": list(raw_vals.shape[1:]),
                                        "sample_count": len(years_arr),
                                        "is_synthetic": False,
                                        "data_source_label": "NASA GMAO MERRA-2 Reanalysis (Verified NetCDF Observations)."
                                    }
                                }
                except Exception as e:
                    logger.warning("Failed to open NetCDF %s (%s); falling back to physical fixture.", nc_file, e)

        # DEMO / FIXTURE MODE
        # Generates deterministic, physically grounded atmospheric field
        lats = np.arange(min_lat, max_lat + 1.0, 2.0, dtype=float)
        lons = np.arange(min_lon, max_lon + 1.0, 2.0, dtype=float)
        years = np.arange(start_year, end_year + 1, dtype=int)

        t_len = len(years)
        h_len = len(lats)
        w_len = len(lons)

        rng = np.random.RandomState(42 if variable == "T2M" else 99)
        data = np.zeros((t_len, h_len, w_len), dtype=float)
        time_norm = (years - start_year) / 10.0  # Decades

        if variable == "T2M":
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    base_temp = 28.0 - 0.7 * abs(lat)
                    if lon > -80.0 and lat > 45.0:
                        trend_slope = -0.22  # Regional cooling anomaly in subpolar North Atlantic
                    else:
                        trend_slope = 0.28 + 0.015 * abs(lat - 25.0)  # Warming amplified at high latitudes
                    interannual_var = rng.normal(0.0, 0.45, size=t_len)
                    data[:, i, j] = base_temp + (trend_slope * time_norm) + interannual_var

        elif variable == "PRECTOT":
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    base_precip = 2.5 + 0.8 * np.sin(np.radians(lat))
                    if lon < -100.0 and lat < 38.0:
                        trend_slope = -0.18  # Drying trend in southwest
                    else:
                        trend_slope = 0.14  # Wetting trend in midwest/northeast
                    interannual_var = rng.normal(0.0, 0.25, size=t_len)
                    data[:, i, j] = np.clip(base_precip + (trend_slope * time_norm) + interannual_var, 0.1, None)

        var_info = self.VARIABLES[variable]

        return {
            "dataset_id": self.DATASET_ID,
            "variable_id": variable,
            "variable_name": var_info["name"],
            "data": data,
            "time": years,
            "lat": lats,
            "lon": lons,
            "source_units": var_info["source_units"],
            "display_units": var_info["display_units"],
            "slope_units": var_info["slope_units"],
            "is_synthetic": True,
            "data_source_label": "Synthetic test data — not NASA observations.",
            "provenance": {
                "source": self.NAME,
                "provider": self.PROVIDER,
                "doi": self.DOI,
                "resolution": self.NATIVE_RESOLUTION,
                "time_span": f"{start_year} - {end_year}",
                "grid_shape": [h_len, w_len],
                "sample_count": t_len,
                "is_synthetic": True,
                "data_source_label": "Synthetic test data — not NASA observations."
            }
        }

    def subset(
        self,
        raw_data: Dict[str, Any],
        bbox: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Slice data array along spatial coordinates if bbox is specified and differs.
        """
        if bbox is None:
            return raw_data

        min_lon, min_lat, max_lon, max_lat = bbox
        lats = raw_data["lat"]
        lons = raw_data["lon"]

        lat_mask = (lats >= min_lat) & (lats <= max_lat)
        lon_mask = (lons >= min_lon) & (lons <= max_lon)

        if not np.any(lat_mask) or not np.any(lon_mask):
            raise ValueError(f"Requested bounding box {bbox} yields empty slice of available grid.")

        lat_idx = np.where(lat_mask)[0]
        lon_idx = np.where(lon_mask)[0]

        subset_data = raw_data.copy()
        subset_data["lat"] = lats[lat_idx]
        subset_data["lon"] = lons[lon_idx]
        # Slice data: (time, lat, lon)
        subset_data["data"] = raw_data["data"][:, lat_idx[0]:lat_idx[-1]+1, lon_idx[0]:lon_idx[-1]+1]
        
        # Update provenance grid_shape
        prov = subset_data["provenance"].copy()
        prov["grid_shape"] = [len(subset_data["lat"]), len(subset_data["lon"])]
        subset_data["provenance"] = prov

        return subset_data

    def normalize(
        self,
        subset_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Ensure uniform ascending coordinate sorting (South to North, West to East),
        floating-point arrays, and consistency of unit labels.
        """
        normalized = subset_data.copy()
        lats = normalized["lat"]
        lons = normalized["lon"]
        data = normalized["data"]

        # Ensure latitude is strictly ascending
        if len(lats) > 1 and lats[1] < lats[0]:
            lats = np.flip(lats)
            data = np.flip(data, axis=1)

        # Ensure longitude is strictly ascending
        if len(lons) > 1 and lons[1] < lons[0]:
            lons = np.flip(lons)
            data = np.flip(data, axis=2)

        normalized["lat"] = lats
        normalized["lon"] = lons
        normalized["data"] = data.astype(float)
        return normalized
