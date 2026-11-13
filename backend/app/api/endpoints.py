"""
Tellura — API Endpoints Façade & Router Aggregator.
Consolidates modular sub-routers across system, datasets, analysis, copilot,
export, and attribution domains while maintaining 100% backwards compatibility.
"""
import logging

from app.api.routers import (
    analysis_router,
    api_router,
    attribution_router,
    copilot_router,
    datasets_router,
    export_router,
    system_router,
)
from app.api.routers.analysis import (
    assess_analysis_quality_gate,
    compare_analysis_locations,
    compare_distinct_regions,
    get_analysis,
    get_analysis_contrasts,
    get_analysis_map,
    get_analysis_provenance,
    get_candidate_signals,
    get_cell_timeseries,
    get_climate_velocity,
    get_data_quality_profile,
    get_reproducibility_manifest,
    run_analysis,
    run_autonomous_trend_discovery,
    run_compound_hazard_analysis,
    run_custom_analysis,
    run_trend_robustness_lab,
)
from app.api.routers.attribution import run_attribution_analysis
from app.api.routers.copilot import (
    explain_evidence,
    parse_natural_language_scientific_query,
)
from app.api.routers.datasets import (
    get_dataset,
    list_datasets,
    list_variables,
)
from app.api.routers.export import (
    export_analysis_geojson,
    export_analysis_latex,
    export_analysis_netcdf,
    export_analysis_notebook,
    get_colab_launcher_link,
    get_scientific_dossier,
)
from app.api.routers.system import (
    health_check,
    record_telemetry,
    submit_contact,
)
from app.api.shared import (
    ADAPTERS,
    ANALYSIS_CACHE,
    CACHE_LOCK,
    COMPUTE_SEMAPHORE,
    _compute_cell_detail,
    _generate_analysis_id,
    get_cached_analysis,
    sanitize_attachment_filename,
    set_cached_analysis,
)

logger = logging.getLogger("Tellura.api")

# The unified API router containing all sub-router definitions
router = api_router

__all__ = [
    # Shared state and constants
    "ADAPTERS",
    "ANALYSIS_CACHE",
    "CACHE_LOCK",
    "COMPUTE_SEMAPHORE",
    "_compute_cell_detail",
    "_generate_analysis_id",
    "analysis_router",
    "api_router",
    "assess_analysis_quality_gate",
    "attribution_router",
    "compare_analysis_locations",
    "compare_distinct_regions",
    "copilot_router",
    "datasets_router",
    "explain_evidence",
    "export_analysis_geojson",
    "export_analysis_latex",
    "export_analysis_netcdf",
    "export_analysis_notebook",
    "export_router",
    "get_analysis",
    "get_analysis_contrasts",
    "get_analysis_map",
    "get_analysis_provenance",
    "get_cached_analysis",
    "get_candidate_signals",
    "get_cell_timeseries",
    "get_climate_velocity",
    "get_colab_launcher_link",
    "get_data_quality_profile",
    "get_dataset",
    "get_reproducibility_manifest",
    "get_scientific_dossier",
    "health_check",
    "list_datasets",
    "list_variables",
    "logger",
    "parse_natural_language_scientific_query",
    "record_telemetry",
    "router",
    "run_analysis",
    "run_attribution_analysis",
    "run_autonomous_trend_discovery",
    "run_compound_hazard_analysis",
    "run_custom_analysis",
    "run_trend_robustness_lab",
    "sanitize_attachment_filename",
    "set_cached_analysis",
    "submit_contact",
    "system_router",
]
