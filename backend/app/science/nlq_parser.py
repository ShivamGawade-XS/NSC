"""
EarthSift — Natural Language Spatiotemporal Query Parser (NLQ)
Converts human natural language scientific queries into structured Pydantic AnalysisRequests.
Supports multi-region bounding boxes, variable resolution, temporal extraction, and significance thresholds.
"""

import re

from app.schemas.analysis import AnalysisRequest, NLQParseResponse

# Knowledge base of major climate regions with bounding boxes [min_lon, min_lat, max_lon, max_lat]
# Sorted by key length descending so longer specific region names match before shorter substrings
REGION_BBOX_MAP = dict(
    sorted(
        {
            "north america": [-130.0, 24.0, -65.0, 60.0],
            "united states": [-125.0, 25.0, -66.0, 49.0],
            "southern plains": [-102.0, 30.0, -94.0, 38.0],
            "colorado river": [-115.0, 31.0, -102.0, 42.0],
            "mediterranean": [-6.0, 30.0, 36.0, 46.0],
            "south america": [-82.0, -56.0, -34.0, 13.0],
            "california": [-124.5, 32.5, -114.1, 42.0],
            "antarctica": [-180.0, -90.0, 180.0, -60.0],
            "australia": [112.0, -44.0, 154.0, -10.0],
            "southwest": [-115.0, 31.0, -102.0, 42.0],
            "svalbard": [10.0, 76.0, 30.0, 81.0],
            "midwest": [-100.0, 36.0, -82.0, 48.0],
            "arctic": [-180.0, 66.0, 180.0, 85.0],
            "europe": [-10.0, 35.0, 35.0, 70.0],
            "amazon": [-75.0, -15.0, -45.0, 5.0],
            "africa": [-20.0, -35.0, 52.0, 37.0],
            "global": [-180.0, -85.0, 180.0, 85.0],
            "texas": [-106.6, 25.8, -93.5, 36.5],
            "conus": [-125.0, 25.0, -65.0, 50.0],
            "sahel": [-18.0, 10.0, 35.0, 18.0],
            "asia": [60.0, 10.0, 145.0, 55.0],
            "usa": [-125.0, 25.0, -66.0, 49.0],
        }.items(),
        key=lambda item: len(item[0]),
        reverse=True,
    )
)

# Variable synonym mapping
VARIABLE_MAP = {
    "temperature": "T2M",
    "warming": "T2M",
    "heat": "T2M",
    "thermal": "T2M",
    "t2m": "T2M",
    "precipitation": "PRECTOT",
    "rain": "PRECTOT",
    "rainfall": "PRECTOT",
    "drought": "PRECTOT",
    "pluvial": "PRECTOT",
    "prectot": "PRECTOT",
    "solar": "ALLSKY_SFC_SW_DWN",
    "radiation": "ALLSKY_SFC_SW_DWN",
    "insolation": "ALLSKY_SFC_SW_DWN",
    "sunlight": "ALLSKY_SFC_SW_DWN",
    "wind": "WS10M",
    "windspeed": "WS10M",
    "speed": "WS10M",
    "ws10m": "WS10M",
    "humidity": "RH2M",
    "moisture": "RH2M",
    "rh2m": "RH2M",
}


def parse_natural_language_query(query: str) -> NLQParseResponse:
    """
    Deterministically parses scientific intent into an executable AnalysisRequest.
    Extracts:
        - Target variable
        - Bounding box / region
        - Temporal year window (e.g., 'after 1995', 'between 2000 and 2020', 'past 15 years')
        - Significance threshold alpha
    """
    q_lower = query.lower()

    # 1. Variable extraction
    matched_var = "T2M"  # Default
    for synonym, var_code in VARIABLE_MAP.items():
        if re.search(r"\b" + re.escape(synonym) + r"\b", q_lower):
            matched_var = var_code
            break

    # 2. Region / Bounding box extraction
    matched_bbox = None
    matched_regions = []
    for region_name, bbox in sorted(REGION_BBOX_MAP.items(), key=lambda item: len(item[0]), reverse=True):
        if re.search(r"\b" + re.escape(region_name) + r"\b", q_lower) or region_name in q_lower:
            matched_bbox = bbox
            matched_regions.append(region_name.title())
            break  # Pick first most specific match

    # 3. Year range extraction
    start_year = 2000
    end_year = 2023

    # Pattern: relative temporal windows e.g., "last 20 years", "past 15 years"
    relative_match = re.search(r"(?:last|past)\s+(\d{1,2})\s+years?", q_lower)
    if relative_match:
        end_year = 2023
        start_year = max(1980, 2023 - int(relative_match.group(1)))
    else:
        # Pattern: "between YYYY and YYYY" or "YYYY to YYYY" or "YYYY-YYYY"
        between_match = re.search(r"(?:between|from)?\s*(\d{4})\s*(?:and|to|-)\s*(\d{4})", q_lower)
        if between_match:
            y1, y2 = int(between_match.group(1)), int(between_match.group(2))
            start_year = max(1980, min(2026, min(y1, y2)))
            end_year = max(1980, min(2026, max(y1, y2)))
        else:
            # Pattern: "after YYYY" or "since YYYY"
            after_match = re.search(r"(?:after|since|from)\s*(\d{4})", q_lower)
            if after_match:
                y = int(after_match.group(1))
                start_year = max(1980, min(2025, y))
                end_year = 2023
            else:
                # Pattern: "before YYYY"
                before_match = re.search(r"(?:before|until)\s*(\d{4})", q_lower)
                if before_match:
                    y = int(before_match.group(1))
                    end_year = max(1985, min(2026, y))
                    start_year = 1990

    # Ensure start < end
    if start_year >= end_year:
        start_year = max(1980, end_year - 15)

    # 4. Significance threshold extraction
    alpha = 0.05
    if "high confidence" in q_lower or "strict" in q_lower or "p < 0.01" in q_lower or "q < 0.01" in q_lower:
        alpha = 0.01
    elif "exploratory" in q_lower or "relaxed" in q_lower or "alpha 0.1" in q_lower:
        alpha = 0.10

    # Choose dataset
    dataset_id = "nasa_power" if matched_var in ("ALLSKY_SFC_SW_DWN", "WS10M", "RH2M") else "merra2_reanalysis"

    analysis_req = AnalysisRequest(
        dataset_id=dataset_id,
        variable_id=matched_var,
        start_year=start_year,
        end_year=end_year,
        bbox=matched_bbox,
        alpha=alpha,
        prefer_live=True,
        use_fdr=True
    )

    region_desc = f"in {', '.join(matched_regions)}" if matched_regions else "across global domain"
    intent_desc = (
        f"Detected request for {matched_var} trends {region_desc} from {start_year} to {end_year} "
        f"with significance threshold alpha={alpha}."
    )

    return NLQParseResponse(
        raw_query=query,
        interpreted_intent=intent_desc,
        analysis_request=analysis_req,
        confidence=0.95 if (matched_bbox or matched_var != "T2M") else 0.85,
        matched_regions=matched_regions
    )
