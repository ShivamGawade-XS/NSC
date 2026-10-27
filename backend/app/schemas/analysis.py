"""
EarthSift — Analysis Request & Response Schemas
Typed Pydantic schemas enforcing strict API contracts and evidence integrity.
"""

import math
from typing import Any

from pydantic import BaseModel, Field, model_validator


def _sanitize_float(v: Any, default: float) -> Any:
    """Replace non-finite floats (NaN, +Inf, -Inf) with a safe default."""
    if v is None or isinstance(v, bool):
        return v
    try:
        if isinstance(v, (int, float)) or hasattr(v, "__float__"):
            if not isinstance(v, (str, bytes)):
                val = float(v)
                if not math.isfinite(val):
                    return default
    except (TypeError, ValueError):
        pass
    return v


def _sanitize_model_dict(data: Any) -> Any:
    """Recursively sanitize dictionary float fields converting NaNs/Infs to safe defaults."""
    if isinstance(data, dict):
        data = dict(data)
        for k, v in data.items():
            if "p_value" in k or "q_value" in k:
                data[k] = _sanitize_float(v, 1.0)
            elif isinstance(v, list):
                data[k] = [_sanitize_float(item, 0.0) for item in v]
            elif isinstance(v, dict):
                data[k] = _sanitize_model_dict(v)
            else:
                data[k] = _sanitize_float(v, 0.0)
    return data


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
        if not math.isfinite(self.alpha):
            raise ValueError("alpha must be a finite floating-point value.")
        if self.start_year > self.end_year:
            raise ValueError(f"start_year ({self.start_year}) cannot be greater than end_year ({self.end_year}).")
        if self.end_year - self.start_year < 2:
            raise ValueError(
                f"end_year ({self.end_year}) - start_year ({self.start_year}) must be at least 2 "
                f"to provide a minimum of 3 annual observation points."
            )
        if self.bbox is not None:
            if len(self.bbox) != 4:
                raise ValueError("bbox must contain exactly 4 coordinates: [min_lon, min_lat, max_lon, max_lat].")
            for c in self.bbox:
                if not math.isfinite(c):
                    raise ValueError(f"All bbox coordinates must be finite floating-point values, got {c}.")
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


class CustomCellInput(BaseModel):
    """Single cell input for user-uploaded custom datasets with strict physical coordinate guards."""
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude [-90.0, 90.0]")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude [-180.0, 180.0]")
    years: list[int] | None = Field(default=None, max_length=150, description="Observation year integers (max 150)")
    values: list[float] | None = Field(default=None, max_length=150, description="Observation values (max 150)")
    slope: float | None = Field(default=None, description="Precomputed decadal slope")
    p_value: float | None = Field(default=None, ge=0.0, le=1.0, description="Precomputed p-value [0.0, 1.0]")

    @model_validator(mode="after")
    def validate_cell_integrity(self) -> "CustomCellInput":
        if not (math.isfinite(self.lat) and math.isfinite(self.lon)):
            raise ValueError("Coordinates (lat, lon) must be finite floating-point numbers.")
        if self.slope is not None and not math.isfinite(self.slope):
            raise ValueError("Precomputed slope must be a finite floating-point number.")
        if self.p_value is not None and not math.isfinite(self.p_value):
            raise ValueError("Precomputed p_value must be a finite floating-point number.")
        if self.values is not None:
            if not all(math.isfinite(v) for v in self.values):
                raise ValueError("All observations in values array must be finite numbers.")
        if self.years is not None and self.values is not None:
            if len(self.years) != len(self.values):
                raise ValueError(
                    f"Mismatched array lengths: years has {len(self.years)} entries but values has {len(self.values)}."
                )
        return self


class CustomAnalysisRequest(BaseModel):
    """Request payload to analyze user-uploaded custom coordinate records with computational complexity bounds."""
    dataset_name: str = Field(..., min_length=1, max_length=128, description="Dataset identifier")
    variable_name: str = Field(default="Custom Variable", min_length=1, max_length=128, description="Variable display name")
    units: str = Field(default="units", min_length=1, max_length=64, description="Measurement units")
    alpha: float = Field(default=0.05, ge=0.001, le=0.20, description="Significance threshold [0.001, 0.20]")
    use_fdr: bool = Field(default=True, description="Apply Benjamini-Hochberg FDR control")
    cells: list[CustomCellInput] = Field(..., max_length=2500, description="List of coordinate records (max 2500)")

    @model_validator(mode="after")
    def validate_request_bounds(self) -> "CustomAnalysisRequest":
        if not math.isfinite(self.alpha):
            raise ValueError("alpha must be a finite floating-point number.")
        total_obs = sum(len(c.values) for c in self.cells if c.values is not None)
        if total_obs > 250000:
            raise ValueError(
                f"Total temporal observation points across all cells ({total_obs}) exceeds system safety threshold (250,000)."
            )
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
    tau: float | None = None
    is_significant_raw: bool
    is_significant_fdr: bool
    direction: str
    lisa_cluster: str | None = "NS"
    n_samples: int

    @model_validator(mode="before")
    @classmethod
    def sanitize_nan_inf(cls, data: Any) -> Any:
        return _sanitize_model_dict(data)


class AnalysisSummary(BaseModel):
    """Aggregate statistics across the analyzed spatial region."""
    total_cells: int
    significant_cells_raw: int
    significant_cells_fdr: int
    mean_slope: float
    max_slope: float
    min_slope: float
    spatial_autocorrelation: dict[str, Any] | None = None
    meets_climatological_duration_threshold: bool = Field(
        default=True,
        description="True if the analysis temporal window spans >= 20 years."
    )
    is_climatological_normal: bool = Field(
        default=True,
        description="Backward-compatible alias for meets_climatological_duration_threshold. Standard normals refer to 30-year reference baseline means per WMO-No. 1203."
    )
    climatological_qualification: str | None = Field(
        default=None,
        description="Scientific caveat when window is too short for climatological duration threshold."
    )
    temporal_aggregation: str = Field(
        default="annual_mean",
        description="Temporal aggregation mode of analyzed observations (e.g. 'annual_mean')."
    )

    @model_validator(mode="before")
    @classmethod
    def sanitize_nan_inf(cls, data: Any) -> Any:
        return _sanitize_model_dict(data)


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

    @model_validator(mode="before")
    @classmethod
    def sanitize_nan_inf(cls, data: Any) -> Any:
        return _sanitize_model_dict(data)


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
    tau: float | None = None


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
    """Physical variable catalog schema with domain categorization and scientific lineage."""
    variable_id: str
    name: str
    source_units: str
    display_units: str
    slope_units: str
    description: str
    dataset_id: str
    mission_source: str | None = None
    product_type: str | None = None
    discontinuity_warning: str | None = None
    physical_domain: str | None = "Atmospheric"
    earliest_year: int = 1981
    latest_year: int = 2024
    temporal_aggregation: str = "annual_mean"
    native_resolution: str | None = None
    suitable_analysis_types: list[str] = Field(default_factory=list)
    scientific_references: list[str] = Field(default_factory=list)


class DatasetVariable(BaseModel):
    """Physical variable metadata schema."""
    id: str
    name: str
    source_units: str
    display_units: str
    slope_units: str
    description: str
    mission_source: str | None = None
    product_type: str | None = None
    discontinuity_warning: str | None = None
    physical_domain: str | None = "Atmospheric"
    earliest_year: int = 1981
    latest_year: int = 2024
    temporal_aggregation: str = "annual_mean"
    native_resolution: str | None = None
    suitable_analysis_types: list[str] = Field(default_factory=list)
    scientific_references: list[str] = Field(default_factory=list)


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
    missions_and_models: str | None = None


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
        if not math.isfinite(self.alpha):
            raise ValueError("alpha must be a finite floating-point value.")
        if self.start_year > self.end_year:
            raise ValueError(f"start_year ({self.start_year}) cannot be greater than end_year ({self.end_year}).")
        if self.end_year - self.start_year < 2:
            raise ValueError(
                f"end_year ({self.end_year}) - start_year ({self.start_year}) must be at least 2 "
                f"to provide a minimum of 3 annual observation points."
            )
        if self.bbox is not None:
            if len(self.bbox) != 4:
                raise ValueError("bbox must contain exactly 4 coordinates: [min_lon, min_lat, max_lon, max_lat].")
            for c in self.bbox:
                if not math.isfinite(c):
                    raise ValueError(f"All bbox coordinates must be finite floating-point values, got {c}.")
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


# ==========================================
# EarthSift 2.0 Core Excellence & Intelligence Schemas
# ==========================================

class QualityGateRequest(BaseModel):
    """Pre-flight quality gate request to validate data suitability before running full analysis."""
    dataset_id: str = Field(default="nasa_power", min_length=2, max_length=64)
    variable_id: str = Field(default="T2M", min_length=1, max_length=64)
    start_year: int = Field(default=2000, ge=1980, le=2026)
    end_year: int = Field(default=2023, ge=1980, le=2026)
    bbox: list[float] | None = None
    alpha: float = Field(default=0.05, ge=0.001, le=0.20)


class QualityGateAssessment(BaseModel):
    """Pre-flight evaluation classifying analysis suitability and actionable guidance."""
    status: str = Field(description="SUPPORTED, SUPPORTED_WITH_LIMITATIONS, INSUFFICIENT_DATA, or UNSUPPORTED_FOR_THIS_METHOD")
    status_label: str
    can_execute: bool
    observation_count: int
    meets_climatological_threshold: bool
    grid_intersection_cells: int
    sensor_continuity: str
    limitations: list[str] = Field(default_factory=list)
    actionable_recommendations: list[str] = Field(default_factory=list)
    recommended_window: list[int] | None = None


class WindowSensitivityItem(BaseModel):
    """Single temporal perturbation window result in Trend Robustness Lab."""
    window: str
    start_year: int
    end_year: int
    n_years: int
    slope: float
    p_value: float
    direction: str
    significant: bool


class EstimatorComparisonItem(BaseModel):
    """Comparison of statistical trend estimators on the same time series."""
    estimator: str
    slope: float
    intercept: float
    se: float | None = None
    p_value: float | None = None
    details: str


class RobustnessRequest(BaseModel):
    """Request payload to test trend sensitivity to analytical choices in Robustness Lab."""
    analysis_id: str | None = Field(default=None, max_length=128)
    lat: float | None = None
    lon: float | None = None


class RobustnessResponse(BaseModel):
    """Comprehensive Trend Robustness Lab report quantifying sensitivity to analytical choices."""
    analysis_id: str
    coordinate: dict[str, float] | None = None
    stability_rating: str = Field(description="ROBUST, MODERATELY_SENSITIVE, or HIGHLY_SENSITIVE")
    sign_agreement_pct: float
    significance_retention_pct: float
    base_slope: float
    jackknife_slope_se: float
    window_sensitivity: list[WindowSensitivityItem]
    estimator_comparison: list[EstimatorComparisonItem]
    autocorrelation_sensitivity: dict[str, Any]
    summary_narrative: str


class RegionalComparisonRequest(BaseModel):
    """Request payload for comparing two geographic regions over a common time interval."""
    dataset_id: str = Field(default="nasa_power", min_length=2, max_length=64)
    variable_id: str = Field(default="T2M", min_length=1, max_length=64)
    start_year: int = Field(default=2000, ge=1980, le=2026)
    end_year: int = Field(default=2023, ge=1980, le=2026)
    region_a_bbox: list[float] = Field(description="[min_lon, min_lat, max_lon, max_lat] for Region A")
    region_a_name: str = Field(default="Region A", max_length=128)
    region_b_bbox: list[float] = Field(description="[min_lon, min_lat, max_lon, max_lat] for Region B")
    region_b_name: str = Field(default="Region B", max_length=128)
    alpha: float = Field(default=0.05, ge=0.001, le=0.20)


class RegionalComparisonResponse(BaseModel):
    """Side-by-side regional trend detective with formal two-sample slope divergence hypothesis test."""
    variable_id: str
    variable_name: str
    time_span: str
    slope_units: str
    region_a: dict[str, Any]
    region_b: dict[str, Any]
    slope_difference: float
    z_statistic: float
    p_value: float
    is_divergence_significant: bool
    divergence_interpretation: str
    spatial_compatibility_notes: list[str] = Field(default_factory=list)


class DiscoveryCandidate(BaseModel):
    """Ranked discovery finding across candidate variables in an exploratory search."""
    variable_id: str
    variable_name: str
    physical_domain: str
    lat: float
    lon: float
    slope: float
    slope_units: str
    p_value: float
    q_value: float
    tau: float
    direction: str
    morans_i: float | None = None
    discovery_score: float
    discovery_badge: str
    ranking_rationale: str


class DiscoveryScanRequest(BaseModel):
    """Request payload for autonomous exploratory trend discovery across variables in a region."""
    dataset_id: str = Field(default="nasa_power", min_length=2, max_length=64)
    bbox: list[float] = Field(description="[min_lon, min_lat, max_lon, max_lat]")
    start_year: int = Field(default=2000, ge=1980, le=2026)
    end_year: int = Field(default=2023, ge=1980, le=2026)
    variable_ids: list[str] | None = None
    alpha: float = Field(default=0.05, ge=0.001, le=0.20)


class DiscoveryScanResponse(BaseModel):
    """Autonomous discovery findings ranked with transparent multi-criteria and FDR multiplicity control."""
    scan_id: str
    bbox: list[float]
    time_span: str
    total_tests_conducted: int
    fdr_discovery_count: int
    ranked_candidates: list[DiscoveryCandidate]
    methodology_disclaimer: str


class DataQualityProfileResponse(BaseModel):
    """Data Quality and Source Continuity profile for an analysis."""
    analysis_id: str
    variable_id: str
    variable_name: str
    temporal_completeness_pct: float
    total_expected_records: int
    valid_records: int
    missing_intervals: list[int]
    outliers_detected: list[dict[str, Any]]
    outlier_handling_note: str
    sensor_lineage: str
    temporal_aggregation: str
    native_resolution: str
    metric_scale_km: dict[str, float]
    quality_rating: str


class ReproducibilityManifestResponse(BaseModel):
    """Cryptographic reproducibility record and Python replication recipe."""
    analysis_id: str
    sha256_fingerprint: str
    timestamp_utc: str
    software_version: str
    dataset: dict[str, Any]
    analysis_parameters: dict[str, Any]
    scientific_summary: dict[str, Any]
    python_replication_code: str
    bibtex_citations: list[str]


