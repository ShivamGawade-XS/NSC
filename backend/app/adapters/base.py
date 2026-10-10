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
from typing import Dict, Any, List, Optional
import numpy as np


class BaseDatasetAdapter(ABC):
    """Abstract base class for Earth-system data providers."""

    @abstractmethod
    def discover(self, query: Optional[str] = None) -> List[Dict[str, Any]]:
        """Discover available collection granules, variables, or temporal bounds."""
        pass

    @abstractmethod
    def metadata(self) -> Dict[str, Any]:
        """Return dataset metadata, variable definitions, and valid temporal/spatial bounds."""
        pass

    # Backwards-compatibility alias for metadata()
    def get_metadata(self) -> Dict[str, Any]:
        """Alias for metadata()."""
        return self.metadata()

    @abstractmethod
    def validate(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: Optional[List[float]] = None
    ) -> None:
        """
        Validate input parameters against dataset capabilities.
        Raises ValueError with clear explanation if invalid.
        """
        pass

    @abstractmethod
    def fetch(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: Optional[List[float]] = None,
        prefer_live: bool = True
    ) -> Dict[str, Any]:
        """
        Fetch raw data array from NASA Earthdata / CMR or local cached fixture.
        Must explicitly report 'is_synthetic' and 'data_source_label'.
        """
        pass

    @abstractmethod
    def subset(
        self,
        raw_data: Dict[str, Any],
        bbox: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Slice data along spatial coordinates [min_lon, min_lat, max_lon, max_lat].
        """
        pass

    @abstractmethod
    def normalize(
        self,
        subset_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Standardize physical units, ascending coordinate sorting, and metadata schema.
        """
        pass

    def fetch_subset(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: Optional[List[float]] = None,
        prefer_live: bool = True
    ) -> Dict[str, Any]:
        """
        Pipeline execution: validate -> fetch -> subset -> normalize.
        """
        self.validate(variable=variable, start_year=start_year, end_year=end_year, bbox=bbox)
        raw = self.fetch(variable=variable, start_year=start_year, end_year=end_year, bbox=bbox, prefer_live=prefer_live)
        sub = self.subset(raw, bbox=bbox)
        norm = self.normalize(sub)
        return norm
