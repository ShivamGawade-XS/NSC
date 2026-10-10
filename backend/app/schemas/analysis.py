"""
EarthSift — Analysis Request & Response Schemas
Typed Pydantic schemas enforcing strict API contracts and evidence integrity.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    """Payload to trigger a spatiotemporal trend analysis."""
    dataset_id: str = Field(default="merra2_reanalysis", description="NASA dataset identifier")
    variable_id: str = Field(default="T2M", description="Physical variable machine name")
    start_year: int = Field(default=2000, ge=1980, le=2024, description="Start year")
    end_year: int = Field(default=2023, ge=1980, le=2024, description="End year")
    bbox: Optional[List[float]] = Field(
        default=None,
        description="[min_lon, min_lat, max_lon, max_lat] bounding box"
    )
    alpha: float = Field(default=0.05, gt=0.0, lt=0.5, description="Significance threshold")


class SpatialGridPoint(BaseModel):
    """Calculated trend and significance for a single coordinate."""
    lat: float
    lon: float
    slope: float
    p_value: float
    q_value: float
    is_significant_raw: bool
    is_significant_fdr: bool
    direction: str
    n_samples: int


class AnalysisSummary(BaseModel):
    """Aggregate statistics across the analyzed spatial region."""
    total_cells: int
    significant_cells_raw: int
    significant_cells_fdr: int
    mean_slope: float
    max_slope: float
    min_slope: float


class AnalysisResponse(BaseModel):
    """Full spatial analysis results, including grid and discovered contrasts."""
    analysis_id: str
    status: str
    dataset_id: str
    variable_id: str
    variable_name: str
    display_units: str
    slope_units: str
    time_span: str
    summary: AnalysisSummary
    grid: List[SpatialGridPoint]
    contrasts: List[Dict[str, Any]]
    provenance: Dict[str, Any]


class CellDetailResponse(BaseModel):
    """Drilldown time series and scientific evidence record for a specific cell."""
    lat: float
    lon: float
    variable_name: str
    display_units: str
    slope_units: str
    years: List[int]
    observations: List[float]
    fitted_values: List[float]
    slope: float
    intercept: float
    p_value: float
    q_value: float
    tau: float
    significant: bool
    direction: str
    evidence_record: Dict[str, Any]


class MapLayerResponse(BaseModel):
    """Spatial map field and layer boundaries."""
    analysis_id: str
    variable_id: str
    variable_name: str
    slope_units: str
    bounds: List[float]
    summary: AnalysisSummary
    grid: List[SpatialGridPoint]


class CandidateSignal(BaseModel):
    """Candidate trend signal surfaced by the Discovery Engine."""
    lat: float
    lon: float
    slope: float
    direction: str
    p_value: float
    q_value: float
    is_significant_fdr: bool
    is_significant_raw: bool
    spatial_coherence: float
    completeness: float
    discovery_score: float
    ranking_rationale: str


class SignalsResponse(BaseModel):
    """Ranked list of candidate signals worth investigating."""
    analysis_id: str
    variable_name: str
    method: str
    criteria: List[str]
    signals: List[CandidateSignal]


class ContrastsResponse(BaseModel):
    """Opposing regional trend pairs."""
    analysis_id: str
    variable_name: str
    contrasts_found: int
    contrasts: List[Dict[str, Any]]


class ProvenanceResponse(BaseModel):
    """Dataset provenance and scientific reproducibility audit record."""
    analysis_id: str
    dataset_id: str
    provenance: Dict[str, Any]


class VariableInfo(BaseModel):
    """Physical variable metadata."""
    variable_id: str
    name: str
    source_units: str
    display_units: str
    slope_units: str
    description: str
    dataset_id: str


class ExplainRequest(BaseModel):
    """Structured evidence record sent to the downstream AI explainer."""
    variable_name: str
    location: str
    time_span: str
    slope: float
    slope_units: str
    p_value: float
    q_value: float
    significant: bool
    direction: str
    sample_count: int
    source: str


class ExplainResponse(BaseModel):
    """Deterministic scientific interpretation."""
    summary: str
    statistical_assessment: str
    limitations: str
