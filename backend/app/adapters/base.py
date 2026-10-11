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

    def fetch_subset(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: list[float] | None = None,
        prefer_live: bool = True
    ) -> dict[str, Any]:
        """
        Pipeline execution: validate -> fetch -> subset -> normalize.
        """
        self.validate(variable=variable, start_year=start_year, end_year=end_year, bbox=bbox)
        raw = self.fetch(variable=variable, start_year=start_year, end_year=end_year, bbox=bbox, prefer_live=prefer_live)
        sub = self.subset(raw, bbox=bbox)
        norm = self.normalize(sub)
        return norm
