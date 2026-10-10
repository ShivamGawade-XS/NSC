"""Data ingestion adapters for NASA Earth observation and reanalysis products."""

from app.adapters.base import BaseDatasetAdapter
from app.adapters.merra2 import MERRA2Adapter
from app.adapters.nasa_power import NASAPowerAdapter

__all__ = ["BaseDatasetAdapter", "MERRA2Adapter", "NASAPowerAdapter"]
