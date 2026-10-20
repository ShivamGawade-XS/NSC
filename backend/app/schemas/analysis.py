"""
EarthSift — Analysis Request & Response Schemas
Typed Pydantic schemas enforcing strict API contracts and evidence integrity.
"""

from typing import Any
from pydantic import BaseModel, Field, model_validator


class AnalysisRequest(BaseModel):
    """Payload to trigger a spatiotemporal trend analysis with strict boundary validation."""
    dataset_id: str = Field(default="merra2_reanalysis", min_length=2, max_length=64, description="NASA dataset identifier")
    variable_id: str = Field(default="T2M", min_length=1, max_length=64, description="Physical variable machine name")
    start_year: int = Field(default=2000, ge=1980, le=2026, description="Start year")
    end_year: int = Field(default=2023, ge=1980, le=2026, description="End year")
    bbox: list[float] | None = Field(
        default=None,
        description="[min_lon, min_lat, max_lon, max_lat] bounding box"
    )
    alpha: float = Field(default=0.05, ge=0.001, le=0.20, description="Significance threshold")
    prefer_live: bool = Field(default=True, description="Prefer authentic NASA NetCDF observations over synthetic fixture")
    use_fdr: bool = Field(default=True, description="Apply Benjamini-Hochberg False Discovery Rate control")

    @model_validator(mode="after")
    def validate_temporal_and_spatial_bounds(self) -> "AnalysisRequest":
        if self.start_year > self.end_year:
            raise ValueError(f"start_year ({self.start_year}) cannot be greater than end_year ({self.end_year}).")
        if self.bbox is not None:
            if len(self.bbox) != 4:
                raise ValueError("bbox must contain exactly 4 coordinates: [min_lon, min_lat, max_lon, max_lat].")
            min_lon, min_lat, max_lon, max_lat = self.bbox
            if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
                raise ValueError("Longitude must be within the range [-180.0, 180.0].")
            if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
                raise ValueError("Latitude must be within the range [-90.0, 90.0].")
            if min_lon >= max_lon:
                raise ValueError(f"min_lon ({min_lon}) must be strictly less than max_lon ({max_lon}).")
            if min_lat >= max_lat:
                raise ValueError(f"min_lat ({min_lat}) must be strictly less than max_lat ({max_lat}).")
        return self


class SpatialGridPoint(BaseModel):
    """Calculated trend and significance for a single coordinate."""
    lat: float
    lon: float
    slope: float
    ci_lower: float | None = None
    ci_upper: float | None = None
    p_value: float
    q_value: float
    is_significant_raw: bool
    is_significant_fdr: bool
    direction: str
    lisa_cluster: str | None = "NS"
    n_samples: int


class AnalysisSummary(BaseModel):
    """Aggregate statistics across the analyzed spatial region."""
    total_cells: int
    significant_cells_raw: int
    significant_cells_fdr: int
    mean_slope: float
    max_slope: float
    min_slope: float
    spatial_autocorrelation: dict[str, Any] | None = None


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
    grid: list[SpatialGridPoint]
    contrasts: list[dict[str, Any]]
    provenance: dict[str, Any]


class CellDetailResponse(BaseModel):
    """Deep inspection telemetry and time series for a single grid coordinate."""
    lat: float
    lon: float
    variable_name: str
    display_units: str
    slope_units: str
    years: list[int]
    observations: list[float]
    fitted_values: list[float]
    slope: float
    ci_lower: float | None = None
    ci_upper: float | None = None
    intercept: float
    p_value: float
    q_value: float
    tau: float
    significant: bool
    direction: str
    lisa_cluster: str | None = "NS"
    changepoint_year: int | None = None
    changepoint_p_value: float | None = None
    evidence_record: dict[str, Any]


class MapLayerResponse(BaseModel):
    """Spatial map field and layer boundaries."""
    analysis_id: str
    variable_id: str
    variable_name: str
    slope_units: str
    bounds: list[float]
    summary: AnalysisSummary
    grid: list[SpatialGridPoint]


class CandidateSignal(BaseModel):
    """Ranked high-confidence candidate discovery signal."""
    lat: float
    lon: float
    slope: float
    p_value: float
    q_value: float
    direction: str
    ranking_rationale: str
    discovery_score: float
    is_significant_fdr: bool | None = None
    is_significant_raw: bool | None = None
    spatial_coherence: float | None = None
    completeness: float | None = None


class SignalsResponse(BaseModel):
    """Payload returning candidate discovery signals from the ranking engine."""
    analysis_id: str
    variable_name: str
    method: str
    criteria: list[str]
    signals: list[CandidateSignal]


class ContrastPair(BaseModel):
    """Discovered geographical region pair with opposing trend signs."""
    pos_region: dict[str, Any]
    neg_region: dict[str, Any]
    variable: str
    time_span: str
    caveat: str


class ContrastsResponse(BaseModel):
    """Payload of discovered opposing regional contrasts with scientific caveats."""
    analysis_id: str
    variable_name: str | None = None
    contrasts_found: int | None = None
    contrasts: list[dict[str, Any]]


class ProvenanceResponse(BaseModel):
    """Dataset provenance and scientific reproducibility audit record."""
    analysis_id: str
    dataset_id: str
    provenance: dict[str, Any]


class VariableInfo(BaseModel):
    """Physical variable catalog schema."""
    variable_id: str
    name: str
    source_units: str
    display_units: str
    slope_units: str
    description: str
    dataset_id: str


class DatasetVariable(BaseModel):
    """Physical variable metadata schema."""
    id: str
    name: str
    source_units: str
    display_units: str
    slope_units: str
    description: str


class DatasetMetadata(BaseModel):
    """NASA dataset information, coverage, and citation schema."""
    id: str
    name: str
    description: str
    temporal_coverage: list[int]
    resolution_deg: float
    source: str
    doi: str
    variables: list[DatasetVariable]


class ExplainRequest(BaseModel):
    """Telemetry context payload for LLM explanation generation."""
    variable_name: str = Field(min_length=1, max_length=128)
    location: str = Field(min_length=1, max_length=128)
    time_span: str = Field(min_length=1, max_length=64)
    slope: float
    slope_units: str = Field(min_length=1, max_length=64)
    p_value: float = Field(ge=0.0, le=1.0)
    q_value: float = Field(ge=0.0, le=1.0)
    significant: bool
    direction: str = Field(min_length=1, max_length=32)
    sample_count: int = Field(ge=1, le=1000)
    source: str = Field(min_length=1, max_length=256)


class ExplainResponse(BaseModel):
    """Deterministic scientific interpretation with falsifiable physical hypotheses."""
    summary: str
    statistical_assessment: str
    limitations: str
    physical_hypotheses: list[dict[str, str]] | None = None
    bibtex_citations: list[str] | None = None


class CompoundHazardRequest(BaseModel):
    """Payload to trigger dual-variable compound hazard analysis with boundary validation."""
    dataset_id: str = Field(default="merra2_reanalysis", min_length=2, max_length=64, description="NASA dataset identifier")
    temp_variable_id: str = Field(default="T2M", min_length=1, max_length=64, description="Thermal variable machine name")
    precip_variable_id: str = Field(default="PRECTOT", min_length=1, max_length=64, description="Hydrological variable machine name")
    start_year: int = Field(default=2000, ge=1980, le=2026, description="Start year")
    end_year: int = Field(default=2023, ge=1980, le=2026, description="End year")
    bbox: list[float] | None = Field(default=None, description="[min_lon, min_lat, max_lon, max_lat] bounding box")
    alpha: float = Field(default=0.05, ge=0.001, le=0.20, description="Significance threshold")
    prefer_live: bool = Field(default=True, description="Prefer authentic NASA observations")

    @model_validator(mode="after")
    def validate_compound_bounds(self) -> "CompoundHazardRequest":
        if self.start_year > self.end_year:
            raise ValueError(f"start_year ({self.start_year}) cannot be greater than end_year ({self.end_year}).")
        if self.bbox is not None:
            if len(self.bbox) != 4:
                raise ValueError("bbox must contain exactly 4 coordinates: [min_lon, min_lat, max_lon, max_lat].")
            min_lon, min_lat, max_lon, max_lat = self.bbox
            if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
                raise ValueError("Longitude must be within the range [-180.0, 180.0].")
            if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
                raise ValueError("Latitude must be within the range [-90.0, 90.0].")
            if min_lon >= max_lon:
                raise ValueError(f"min_lon ({min_lon}) must be strictly less than max_lon ({max_lon}).")
            if min_lat >= max_lat:
                raise ValueError(f"min_lat ({min_lat}) must be strictly less than max_lat ({max_lat}).")
        return self


class CompoundHazardResponse(BaseModel):
    """Dual-variable compound divergence and aridification assessment with Archimedean Copulas."""
    analysis_id: str | None = None
    dataset_id: str
    time_span: str
    aridification_fraction: float
    intensification_fraction: float
    significant_compound_fraction: float | None = None
    summary: str
    hazard_distribution: dict[str, int]
    cells: list[dict[str, Any]]
    copula_model: dict[str, Any] | None = None
    max_return_period_years: float | None = None
    compound_extreme_cells: int | None = None


class VelocityVector(BaseModel):
    """Spatial climate velocity vector glyph."""
    lat: float
    lon: float
    velocity_km_decade: float
    bearing_deg: float
    cardinal: str
    u: float
    v: float
    spatial_gradient: float


class ClimateVelocityResponse(BaseModel):
    """Burrows et al. (Nature 2011) spatial climate velocity vector field."""
    analysis_id: str
    variable_id: str
    variable_name: str
    units: str = "km / decade"
    summary: dict[str, Any]
    vectors: list[VelocityVector]


class NLQParseRequest(BaseModel):
    """Natural Language Query command palette payload."""
    query: str = Field(min_length=3, max_length=500, description="Natural language scientific question")


class NLQParseResponse(BaseModel):
    """Parsed structured analysis configuration ready for execution."""
    raw_query: str
    interpreted_intent: str
    analysis_request: AnalysisRequest
    confidence: float
    matched_regions: list[str] = []


class CompareLocationsRequest(BaseModel):
    """Dual-coordinate comparative telemetry request (Pin A vs Pin B)."""
    analysis_id: str = Field(min_length=5, max_length=128)
    lat_a: float = Field(ge=-90.0, le=90.0)
    lon_a: float = Field(ge=-180.0, le=180.0)
    lat_b: float = Field(ge=-90.0, le=90.0)
    lon_b: float = Field(ge=-180.0, le=180.0)


class CompareLocationsResponse(BaseModel):
    """Dual-region differential analysis showing trend divergence, cross-correlation, and phase lag."""
    analysis_id: str
    variable_name: str
    slope_units: str
    loc_a: CellDetailResponse
    loc_b: CellDetailResponse
    delta_slope: float
    relative_divergence_pct: float
    cross_correlation_r: float
    p_value_difference: float
    regime_divergence_summary: str


class LatexExportResponse(BaseModel):
    """NASA Technical Memorandum (TM) LaTeX source with IEEE/AGU styling."""
    analysis_id: str
    variable_id: str
    latex_code: str
    hmac_sha256_hash: str
    qr_verification_url: str

