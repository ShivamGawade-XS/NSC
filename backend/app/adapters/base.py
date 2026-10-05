"""
EarthSift — DataProvider Abstract Base Adapter
Defines contract for all NASA and Earth-system dataset providers.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
import numpy as np


class BaseDatasetAdapter(ABC):
    """Abstract base class for Earth-system data providers."""

    @abstractmethod
    def get_metadata(self) -> Dict[str, Any]:
        """Return dataset metadata, variable definitions, and valid temporal bounds."""
        pass

    @abstractmethod
    def fetch_subset(
        self,
        variable: str,
        start_year: int,
        end_year: int,
        bbox: Optional[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Fetch a 3D spatiotemporal slice.
        
        Returns:
            Dict containing:
                'data': 3D numpy array [time, lat, lon]
                'time': 1D array of timestamps/years
                'lat': 1D array of latitude coordinates
                'lon': 1D array of longitude coordinates
                'units': physical measurement units
                'slope_units': trend slope rate units
                'provenance': citation and DOI information
        """
        pass
