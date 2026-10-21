"""
EarthSift — DataProvider Abstract Base Adapter
Defines strict contract for all NASA and Earth-system dataset providers.
Interface adheres to:
- discover()
- metadata()
- validate()
- fetch()
- subset()
- normalize()
"""

from abc import ABC, abstractmethod
from typing import Any


import numpy as np


class BaseDatasetAdapter(ABC):
    """Abstract base class for Earth-system data providers."""

    @abstractmethod
    def discover(self, query: str | None = None) -> list[dict[str, Any]]:
        """Discover available collection granules, variables, or temporal bounds."""

    @abstractmethod
    def metadata(self) -> dict[str, Any]:
        """Return dataset metadata, variable definitions, and valid temporal/spatial bounds."""

    # Backwards-compatibility alias for metadata()
    def get_metadata(self) -> dict[str, Any]:
        """Alias for metadata()."""
        return self.metadata()

    @abstractmethod
    def validate(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: list[float] | None = None
    ) -> None:
        """
        Validate input parameters against dataset capabilities.
        Raises ValueError with clear explanation if invalid.
        """

    @abstractmethod
    def fetch(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: list[float] | None = None,
        prefer_live: bool = True
    ) -> dict[str, Any]:
        """
        Fetch raw data array from NASA Earthdata / CMR or local cached fixture.
        Must explicitly report 'is_synthetic' and 'data_source_label'.
        """

    @abstractmethod
    def subset(
        self,
        raw_data: dict[str, Any],
        bbox: list[float] | None = None
    ) -> dict[str, Any]:
        """
        Slice data along spatial coordinates [min_lon, min_lat, max_lon, max_lat].
        """

    @abstractmethod
    def normalize(
        self,
        subset_data: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Standardize physical units, ascending coordinate sorting, and metadata schema.
        """

    def verify_cf_contract(self, norm_data: dict[str, Any]) -> dict[str, Any]:
        """
        Enforce Climate and Forecast (CF) post-condition invariants on normalized dataset dictionary.

        Asserts:
        1. norm_data["data"].ndim == 3 and norm_data["data"].shape == (len(norm_data["years"]), len(norm_data["lat"]), len(norm_data["lon"]))
        2. lat and lon are 1D arrays in strictly ascending order (np.all(np.diff(lat) > 0) and np.all(np.diff(lon) > 0))
        3. is_synthetic (bool) and data_source_label (str) exist at both top-level and inside norm_data["provenance"]
        """
        # Ensure temporal coordinate key consistency between 'years' and legacy 'time'
        if "years" not in norm_data and "time" in norm_data:
            norm_data["years"] = norm_data["time"]
        if "time" not in norm_data and "years" in norm_data:
            norm_data["time"] = norm_data["years"]

        # 1. 3D shape contract
        assert "data" in norm_data, "norm_data must contain 'data' key"
        assert "years" in norm_data, "norm_data must contain 'years' coordinate"
        assert "lat" in norm_data, "norm_data must contain 'lat' coordinate"
        assert "lon" in norm_data, "norm_data must contain 'lon' coordinate"

        assert norm_data["data"].ndim == 3, f"Expected data.ndim == 3, got {norm_data['data'].ndim}"
        assert norm_data["data"].shape == (
            len(norm_data["years"]),
            len(norm_data["lat"]),
            len(norm_data["lon"]),
        ), (
            f"Data shape {norm_data['data'].shape} does not match "
            f"({len(norm_data['years'])}, {len(norm_data['lat'])}, {len(norm_data['lon'])})"
        )

        # 2. Ascending 1D spatial coordinates
        lat = norm_data["lat"]
        lon = norm_data["lon"]
        assert isinstance(lat, np.ndarray) and lat.ndim == 1, f"lat must be a 1D numpy array, got {type(lat)}"
        assert isinstance(lon, np.ndarray) and lon.ndim == 1, f"lon must be a 1D numpy array, got {type(lon)}"
        assert np.all(np.diff(lat) > 0), "lat coordinates must be strictly ascending"
        assert np.all(np.diff(lon) > 0), "lon coordinates must be strictly ascending"

        # 3. Provenance and synthetic data labeling invariants
        assert "is_synthetic" in norm_data and isinstance(norm_data["is_synthetic"], (bool, np.bool_)), (
            "is_synthetic must exist at top-level and be a boolean"
        )
        assert "data_source_label" in norm_data and isinstance(norm_data["data_source_label"], str), (
            "data_source_label must exist at top-level and be a string"
        )
        assert "provenance" in norm_data and isinstance(norm_data["provenance"], dict), (
            "norm_data must contain a dictionary under 'provenance'"
        )
        prov = norm_data["provenance"]
        assert "is_synthetic" in prov and isinstance(prov["is_synthetic"], (bool, np.bool_)), (
            "is_synthetic must exist in norm_data['provenance'] and be a boolean"
        )
        assert "data_source_label" in prov and isinstance(prov["data_source_label"], str), (
            "data_source_label must exist in norm_data['provenance'] and be a string"
        )

        return norm_data

    def fetch_subset(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: list[float] | None = None,
        prefer_live: bool = True
    ) -> dict[str, Any]:
        """
        Pipeline execution: validate -> fetch -> subset -> normalize -> verify_cf_contract.
        """
        self.validate(variable=variable, start_year=start_year, end_year=end_year, bbox=bbox)
        raw = self.fetch(variable=variable, start_year=start_year, end_year=end_year, bbox=bbox, prefer_live=prefer_live)
        sub = self.subset(raw, bbox=bbox)
        norm = self.normalize(sub)
        return self.verify_cf_contract(norm)
