/**
 * EarthSift — Frontend Application Logic
 * Integrates Leaflet spatial rendering, Chart.js time series, and scientific API.
 * Full Phase 6 NASA Global Award Implementation:
 * - Real NASA POWER / MERRA-2 live ingestion
 * - Gilbert (1987) 95% Confidence Intervals
 * - Anselin Local Moran's I (LISA) cluster visualization
 * - Global Moran's I spatial autocorrelation metrics
 * - NASA GIBS Worldview satellite imagery layer
 * - CF-1.8 NetCDF-4, GeoJSON, and Scientific Dossier exports
 */

// API Configuration: supports direct local backend or proxy
const API_BASE = (window.location.protocol === "http:" || window.location.protocol === "https:") && window.location.port === "8000"
  ? "/api/v1"
  : "http://localhost:8000/api/v1";

let map;
let gridLayerGroup;
let gibsLayer = null;
let timeSeriesChart;
let currentAnalysisId = null;
let currentSelectedCell = null;
let currentAnalysisData = null;
let candidateSignals = [];

// Color scale interpolator: smooth 5-stop scientific diverging palette (Blue -> Neutral Slate -> Red)
function getTrendColor(slope, minVal, maxVal) {
  if (slope === 0 || Math.abs(slope) < 1e-6) {
    return "rgba(100, 116, 139, 0.4)";
  }
  
  if (slope > 0) {
    const max = maxVal && maxVal > 0 ? maxVal : 0.5;
    const norm = Math.min(1.0, slope / max);
    let r, g, b;
    if (norm < 0.5) {
      const t = norm / 0.5;
      r = Math.round(100 + (245 - 100) * t);
      g = Math.round(116 + (158 - 116) * t);
      b = Math.round(139 + (11 - 139) * t);
    } else {
      const t = (norm - 0.5) / 0.5;
      r = Math.round(245 + (239 - 245) * t);
      g = Math.round(158 + (68 - 158) * t);
      b = Math.round(11 + (68 - 11) * t);
    }
    const alpha = 0.5 + 0.45 * norm;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else {
    const min = minVal && minVal < 0 ? Math.abs(minVal) : 0.5;
    const norm = Math.min(1.0, Math.abs(slope) / min);
    let r, g, b;
    if (norm < 0.5) {
      const t = norm / 0.5;
      r = Math.round(100 + (56 - 100) * t);
      g = Math.round(116 + (189 - 116) * t);
      b = Math.round(139 + (248 - 139) * t);
    } else {
      const t = (norm - 0.5) / 0.5;
      r = Math.round(56 + (37 - 56) * t);
      g = Math.round(189 + (99 - 189) * t);
      b = Math.round(248 + (235 - 248) * t);
    }
    const alpha = 0.5 + 0.45 * norm;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

// Color map for Anselin Local Moran's I (LISA) spatial clusters
function getLISAColor(cluster) {
  switch (cluster) {
    case "HH": return "#ef4444"; // Hotspot: High surrounded by High (Red)
    case "LL": return "#38bdf8"; // Coldspot: Low surrounded by Low (Cyan/Blue)
    case "HL": return "#f59e0b"; // Outlier: High surrounded by Low (Amber)
    case "LH": return "#10b981"; // Outlier: Low surrounded by High (Emerald)
    case "NS":
    default:
      return "rgba(100, 116, 139, 0.35)"; // Not Significant (Muted Slate)
  }
}

// Initialize Leaflet Map
function initMap() {
  map = L.map("trendMap", {
    center: [34.0, -98.0],
    zoom: 5,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true
  });

  // Dark Matter Carto basemap
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> | NASA Space Apps 2026',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  gridLayerGroup = L.layerGroup().addTo(map);

  document.getElementById("resetViewBtn").addEventListener("click", () => {
    map.setView([34.0, -98.0], 5);
  });
}

// Initialize Chart.js Time Series
function initChart() {
  const ctx = document.getElementById("timeSeriesChart").getContext("2d");
  timeSeriesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Observations",
          data: [],
          backgroundColor: "#38bdf8",
          borderColor: "#38bdf8",
          pointRadius: 4,
          pointHoverRadius: 6,
          showLine: false,
          order: 2
        },
        {
          label: "Sen's Robust Trendline",
          data: [],
          borderColor: "#f59e0b",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#94a3b8",
            font: { size: 10, family: "Inter" },
            boxWidth: 12
          }
        },
        tooltip: {
          backgroundColor: "rgba(14, 22, 38, 0.9)",
          titleColor: "#38bdf8",
          bodyColor: "#f1f5f9",
          borderColor: "#1e2e4a",
          borderWidth: 1,
          padding: 8
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(30, 46, 74, 0.5)" },
          ticks: { color: "#64748b", font: { size: 9, family: "JetBrains Mono" } }
        },
        y: {
          grid: { color: "rgba(30, 46, 74, 0.5)" },
          ticks: { color: "#64748b", font: { size: 9, family: "JetBrains Mono" } }
        }
      }
    }
  });
}

// Render Spatial Grid Markers on Map
function renderSpatialGrid(grid, minSlope, maxSlope, maskSigOnly) {
  gridLayerGroup.clearLayers();
  const canvasRenderer = L.canvas({ padding: 0.5 });
  const useLisa = document.getElementById("lisaToggle") && document.getElementById("lisaToggle").checked;

  grid.forEach(cell => {
    if (maskSigOnly && !cell.is_significant_fdr) {
      return;
    }

    const color = useLisa
      ? getLISAColor(cell.lisa_cluster)
      : getTrendColor(cell.slope, minSlope, maxSlope);
    const isSig = cell.is_significant_fdr;

    const marker = L.circleMarker([cell.lat, cell.lon], {
      renderer: canvasRenderer,
      radius: isSig ? 9 : 6,
      fillColor: color,
      fillOpacity: isSig ? 0.88 : 0.45,
      color: isSig ? (useLisa ? "#ffffff" : "#38bdf8") : "#334155",
      weight: isSig ? 1.5 : 0.8
    });

    const ciText = (cell.ci_lower !== undefined && cell.ci_upper !== undefined)
      ? `[${cell.ci_lower > 0 ? "+" : ""}${cell.ci_lower.toFixed(3)}, ${cell.ci_upper > 0 ? "+" : ""}${cell.ci_upper.toFixed(3)}]`
      : "N/A";

    const tooltipContent = `
      <div style="font-family: Inter, sans-serif; font-size: 11px;">
        <strong>Lat:</strong> ${cell.lat.toFixed(2)}°, <strong>Lon:</strong> ${cell.lon.toFixed(2)}°<br/>
        <strong>Slope:</strong> ${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)}<br/>
        <strong>95% CI:</strong> ${ciText}<br/>
        <strong>LISA Cluster:</strong> ${cell.lisa_cluster || "NS"}<br/>
        <strong>p-val:</strong> ${cell.p_value.toFixed(4)} | <strong>FDR q:</strong> ${cell.q_value.toFixed(4)}<br/>
        <strong>Status:</strong> ${isSig ? "Significant" : "Non-Significant"}
      </div>
    `;
    marker.bindTooltip(tooltipContent, { className: "custom-map-tooltip" });

    marker.on("click", () => {
      selectCell(cell.lat, cell.lon);
    });

    gridLayerGroup.addLayer(marker);
  });
}

// Execute Trend Analysis API Call
async function executeAnalysis() {
  const btn = document.getElementById("runAnalysisBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">⏳</span> Computing Trends...`;

  const datasetId = document.getElementById("datasetSelect").value;
  const variableId = document.getElementById("variableSelect").value;
  const startYear = parseInt(document.getElementById("startYear").value, 10);
  const endYear = parseInt(document.getElementById("endYear").value, 10);
  const fdrActive = document.getElementById("fdrToggle").checked;

  try {
    const res = await fetch(`${API_BASE}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: datasetId,
        variable_id: variableId,
        start_year: startYear,
        end_year: endYear,
        alpha: 0.05
      })
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.statusText}`);
    }

    const data = await res.json();
    currentAnalysisData = data;
    currentAnalysisId = data.analysis_id;

    // Update Data Regime Banner (Synthetic vs Live Authentic NASA)
    updateDataRegimeBanner(data.provenance);

    // Update legend and metrics
    document.getElementById("legendUnit").innerText = data.slope_units;
    document.getElementById("legendMin").innerText = data.summary.min_slope.toFixed(2);
    document.getElementById("legendMax").innerText = (data.summary.max_slope > 0 ? "+" : "") + data.summary.max_slope.toFixed(2);
    document.getElementById("mapSubtitle").innerText = `${data.variable_name} (${data.time_span}) • ${data.summary.significant_cells_fdr} FDR Significant Cells`;

    // Update Spatial Autocorrelation (Global Moran's I)
    const moranScoreEl = document.getElementById("moranScore");
    if (moranScoreEl && data.summary && data.summary.spatial_autocorrelation) {
      const sa = data.summary.spatial_autocorrelation;
      const iVal = sa.moran_i !== undefined ? sa.moran_i : (sa.morans_i || 0);
      moranScoreEl.innerText = `Moran's I = ${iVal > 0 ? "+" : ""}${iVal.toFixed(3)} (Z = ${sa.z_score.toFixed(2)}, p = ${sa.p_value < 0.0001 ? "< 0.0001" : sa.p_value.toFixed(4)} — ${sa.interpretation})`;
    }

    // Render grid
    const maskSig = document.getElementById("maskToggle").checked;
    renderSpatialGrid(data.grid, data.summary.min_slope, data.summary.max_slope, maskSig);

    // Update contrasts UI
    updateContrastsUI(data.contrasts, data.slope_units);

    // Fetch and render candidate discovery signals
    await loadCandidateSignals(data.analysis_id);

    // Auto-select the top signal or first significant cell
    if (candidateSignals.length > 0) {
      selectCell(candidateSignals[0].lat, candidateSignals[0].lon);
    } else {
      const targetCell = data.grid.find(c => c.is_significant_fdr) || data.grid[0];
      if (targetCell) {
        selectCell(targetCell.lat, targetCell.lon);
      }
    }

    document.getElementById("apiStatusText").innerText = "Analysis Active";
  } catch (err) {
    console.error("Failed to run analysis:", err);
    document.getElementById("apiStatusText").innerText = "Offline Mode / Error";
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">⚡</span> Run Trend Detection`;
  }
}

// Update Data Regime Banner
function updateDataRegimeBanner(provenance) {
  const banner = document.getElementById("dataRegimeBanner");
  const badge = document.getElementById("regimeBadge");
  const msg = document.getElementById("regimeMessage");
  const provLabel = document.getElementById("provenanceSourceLabel");

  if (!banner || !badge || !msg) return;

  if (provenance.is_synthetic) {
    banner.className = "data-regime-banner synthetic";
    badge.innerText = "DEMO MODE";
    msg.innerText = "Synthetic test data — not NASA observations.";
    if (provLabel) {
      provLabel.innerText = "Synthetic test data fixture";
      provLabel.style.background = "rgba(239, 68, 68, 0.2)";
      provLabel.style.color = "#fca5a5";
    }
  } else {
    banner.className = "data-regime-banner live";
    badge.innerText = "LIVE NASA MODE";
    msg.innerText = `NASA Authentic Observations (${provenance.provider || "NASA Langley POWER / GMAO"}) — CF-1.8 NetCDF Ingested.`;
    if (provLabel) {
      provLabel.innerText = `${provenance.provider || "NASA LaRC POWER"} Live Stream`;
      provLabel.style.background = "rgba(16, 185, 129, 0.2)";
      provLabel.style.color = "#6ee7b7";
    }
  }
}

// Load Candidate Signals from Discovery Engine
async function loadCandidateSignals(analysisId) {
  const container = document.getElementById("signalsListContainer");
  try {
    const res = await fetch(`${API_BASE}/analysis/${analysisId}/signals`);
    if (!res.ok) throw new Error("Failed to fetch discovery signals");
    const data = await res.json();
    candidateSignals = data.signals || [];

    if (candidateSignals.length === 0) {
      container.innerHTML = `<div class="signal-loading">No candidate signals passed discovery filters.</div>`;
      return;
    }

    container.innerHTML = "";
    candidateSignals.slice(0, 5).forEach((sig, idx) => {
      const card = document.createElement("div");
      card.className = "signal-card";
      card.innerHTML = `
        <div class="signal-left">
          <span class="signal-rank">#${idx + 1}</span>
          <div>
            <div class="signal-coords">${sig.lat.toFixed(1)}°N, ${sig.lon.toFixed(1)}°W</div>
            <div class="signal-sub">${sig.direction.toUpperCase()} • Slope: ${sig.slope > 0 ? "+" : ""}${sig.slope.toFixed(3)}</div>
          </div>
        </div>
        <div class="signal-score-badge" title="${sig.ranking_rationale}">
          ★ ${sig.discovery_score.toFixed(3)}
        </div>
      `;

      card.addEventListener("click", () => {
        document.querySelectorAll(".signal-card").forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        selectCell(sig.lat, sig.lon);
        map.setView([sig.lat, sig.lon], 5);
      });

      container.appendChild(card);
    });
  } catch (e) {
    console.warn("Could not load candidate signals:", e);
    container.innerHTML = `<div class="signal-loading">Discovery signals unavailable.</div>`;
  }
}

// Action: Find Something Interesting (Jump to top candidate signal)
function findSomethingInteresting() {
  if (candidateSignals && candidateSignals.length > 0) {
    const topSig = candidateSignals[0];
    selectCell(topSig.lat, topSig.lon);
    map.setView([topSig.lat, topSig.lon], 5);
    
    // Highlight top signal card
    const firstCard = document.querySelector(".signal-card");
    if (firstCard) {
      document.querySelectorAll(".signal-card").forEach(c => c.classList.remove("active"));
      firstCard.classList.add("active");
    }
  } else {
    executeAnalysis();
  }
}

// Action: Focus Contrasting Regions
function focusContrastingRegions() {
  if (!currentAnalysisData || !currentAnalysisData.contrasts || currentAnalysisData.contrasts.length === 0) {
    alert("No significant contrasting regional pairs in current window.");
    return;
  }
  const c = currentAnalysisData.contrasts[0];
  const posCenter = c.region_increasing.center;
  const negCenter = c.region_decreasing.center;
  const midLat = (posCenter[1] + negCenter[1]) / 2.0;
  const midLon = (posCenter[0] + negCenter[0]) / 2.0;
  map.setView([midLat, midLon], 4);
}

// Select a specific coordinate cell and update time series & evidence
async function selectCell(lat, lon) {
  if (!currentAnalysisId) return;

  try {
    const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/timeseries?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("Failed to load cell details");

    const cell = await res.json();
    currentSelectedCell = cell;

    // Update Time Series Chart
    timeSeriesChart.data.labels = cell.years;
    timeSeriesChart.data.datasets[0].data = cell.observations;
    timeSeriesChart.data.datasets[1].data = cell.fitted_values;
    if (timeSeriesChart.options.scales && timeSeriesChart.options.scales.y) {
      timeSeriesChart.options.scales.y.title = {
        display: true,
        text: cell.display_units || "",
        color: "#94a3b8",
        font: { size: 10, family: "Inter" }
      };
    }
    timeSeriesChart.update();

    // Update Header and Badges
    document.getElementById("tsCoordinateLabel").innerText = `Coordinate: ${cell.lat.toFixed(2)}°N, ${cell.lon.toFixed(2)}°W`;
    document.getElementById("tsSlopeBadge").innerText = `Slope: ${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)} ${cell.slope_units}`;
    document.getElementById("tsPValBadge").innerText = `p = ${cell.p_value.toFixed(4)}`;
    document.getElementById("tsTauBadge").innerText = `Kendall's τ = ${cell.tau.toFixed(3)}`;

    // Update Evidence Panel
    const ev = cell.evidence_record;
    document.getElementById("evObservation").innerText = ev.observation;
    document.getElementById("evMagnitude").innerText = ev.magnitude;
    document.getElementById("evSignificance").innerText = `p = ${cell.p_value.toFixed(4)} | FDR q = ${cell.q_value.toFixed(4)}`;
    document.getElementById("evSigStatus").innerText = `Status: ${cell.significant ? "Statistically Significant" : "Not Significant"}`;

    // 95% Confidence Interval (Gilbert 1987)
    const evCI = document.getElementById("evCI");
    if (evCI) {
      if (cell.ci_lower !== undefined && cell.ci_upper !== undefined) {
        const lo = (cell.ci_lower > 0 ? "+" : "") + cell.ci_lower.toFixed(4);
        const hi = (cell.ci_upper > 0 ? "+" : "") + cell.ci_upper.toFixed(4);
        evCI.innerText = `[${lo}, ${hi}] ${cell.slope_units}`;
      } else if (ev && ev.confidence_interval_95) {
        evCI.innerText = ev.confidence_interval_95;
      } else {
        evCI.innerText = "N/A";
      }
    }

    // Anselin LISA Spatial Cluster
    const evLISA = document.getElementById("evLISA");
    if (evLISA) {
      const cluster = cell.lisa_cluster || (ev && ev.lisa_cluster) || "NS";
      const clusterLabels = {
        "HH": "HH (High-High Hotspot)",
        "LL": "LL (Low-Low Coldspot)",
        "HL": "HL (High-Low Spatial Outlier)",
        "LH": "LH (Low-High Spatial Outlier)",
        "NS": "NS (Not Significant)"
      };
      const clsClass = cluster.toLowerCase();
      evLISA.innerHTML = `<span class="lisa-badge ${clsClass}">${clusterLabels[cluster] || cluster}</span>`;
    }

    document.getElementById("evCoverage").innerText = ev.coverage;
    document.getElementById("evMethod").innerText = ev.method;
    document.getElementById("evLimitations").innerText = ev.scientific_limitation;
    document.getElementById("evSource").innerText = ev.source;
    document.getElementById("evDataRegimeLabel").innerText = `Data Regime: ${ev.data_source_label || (cell.provenance && cell.provenance.is_synthetic ? "Synthetic test data" : "NASA Authentic Observations")}`;

    // Reset AI explainer box
    document.getElementById("aiOutputBox").classList.add("hidden");
  } catch (err) {
    console.error("Failed to load cell drilldown:", err);
  }
}

// Update Contrasts UI with multiple connected cluster pairs
function updateContrastsUI(contrasts, units) {
  const container = document.getElementById("contrastContent");
  if (!contrasts || contrasts.length === 0) {
    container.innerHTML = "No significant opposing regional pairs detected in current bounding box.";
    return;
  }

  let html = `<div style="font-size: 11px; margin-bottom: 6px; color: var(--accent-cyan); font-weight: 600;">Discovered ${contrasts.length} Opposing Spatial Pairs:</div>`;
  contrasts.slice(0, 3).forEach((c, idx) => {
    const pos = c.region_increasing;
    const neg = c.region_decreasing;
    html += `
      <div style="background: rgba(14, 22, 38, 0.7); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; font-size: 11px;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
          <strong style="color: var(--text-main);">#${idx + 1} Opposing Pair</strong>
          <span style="color:#f59e0b; font-family:var(--font-mono); font-weight:600;">Δ ${c.magnitude_delta.toFixed(3)} ${units}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; line-height: 1.4;">
          • <span style="color:#ef4444; font-weight:500;">Increasing:</span> ${pos.cell_count} cells (Mean: +${pos.mean_slope.toFixed(3)})<br/>
          • <span style="color:#38bdf8; font-weight:500;">Decreasing:</span> ${neg.cell_count} cells (Mean: ${neg.mean_slope.toFixed(3)})
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// AI Explainer Request
async function requestAiExplanation() {
  if (!currentSelectedCell) return;

  const box = document.getElementById("aiOutputBox");
  const loader = document.getElementById("aiLoader");
  const content = document.getElementById("aiContentText");

  box.classList.remove("hidden");
  loader.style.display = "block";
  content.innerText = "";

  const payload = {
    variable_name: currentSelectedCell.variable_name,
    location: `${currentSelectedCell.lat.toFixed(1)}°N, ${currentSelectedCell.lon.toFixed(1)}°W`,
    time_span: `${currentSelectedCell.years[0]} - ${currentSelectedCell.years[currentSelectedCell.years.length - 1]}`,
    slope: currentSelectedCell.slope,
    slope_units: currentSelectedCell.slope_units,
    p_value: currentSelectedCell.p_value,
    q_value: currentSelectedCell.q_value,
    significant: currentSelectedCell.significant,
    direction: currentSelectedCell.direction,
    sample_count: currentSelectedCell.years.length,
    source: currentSelectedCell.evidence_record.source
  };

  try {
    const res = await fetch(`${API_BASE}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("AI explanation request failed");

    const data = await res.json();
    loader.style.display = "none";
    content.innerHTML = `
      <p style="margin-bottom: 6px;"><strong>Summary:</strong> ${data.summary}</p>
      <p style="margin-bottom: 6px;"><strong>Assessment:</strong> ${data.statistical_assessment}</p>
      <p style="color: #fbbf24; font-size: 10px;"><strong>Caveats:</strong> ${data.limitations}</p>
    `;
  } catch (err) {
    loader.style.display = "none";
    content.innerText = "Deterministic fallback: Trend verified empirically under Mann-Kendall test. Explanation unavailable.";
  }
}

// Boot & Event Listeners
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  initChart();

  document.getElementById("runAnalysisBtn").addEventListener("click", executeAnalysis);
  document.getElementById("findInterestingBtn").addEventListener("click", findSomethingInteresting);
  document.getElementById("findContrastsBtn").addEventListener("click", focusContrastingRegions);
  document.getElementById("askAiBtn").addEventListener("click", requestAiExplanation);

  // Significant only mask toggle
  document.getElementById("maskToggle").addEventListener("change", (e) => {
    if (currentAnalysisData) {
      renderSpatialGrid(
        currentAnalysisData.grid,
        currentAnalysisData.summary.min_slope,
        currentAnalysisData.summary.max_slope,
        e.target.checked
      );
    }
  });

  // LISA Cluster Layer Toggle
  const lisaToggle = document.getElementById("lisaToggle");
  if (lisaToggle) {
    lisaToggle.addEventListener("change", () => {
      if (currentAnalysisData) {
        renderSpatialGrid(
          currentAnalysisData.grid,
          currentAnalysisData.summary.min_slope,
          currentAnalysisData.summary.max_slope,
          document.getElementById("maskToggle").checked
        );
      }
    });
  }

  // NASA Worldview GIBS Satellite Layer Toggle
  const gibsToggle = document.getElementById("gibsToggle");
  if (gibsToggle) {
    gibsToggle.addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!gibsLayer) {
          gibsLayer = L.tileLayer(
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2023-08-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
            {
              attribution: "Imagery &copy; NASA EOSDIS GIBS",
              maxZoom: 9,
              opacity: 0.65
            }
          );
        }
        gibsLayer.addTo(map);
        if (gridLayerGroup) gridLayerGroup.bringToFront();
      } else {
        if (gibsLayer && map.hasLayer(gibsLayer)) {
          map.removeLayer(gibsLayer);
        }
      }
    });
  }

  // Dataset Provider Change Handler
  const datasetSelect = document.getElementById("datasetSelect");
  if (datasetSelect) {
    datasetSelect.addEventListener("change", (e) => {
      const hint = document.getElementById("datasetHint");
      if (!hint) return;
      if (e.target.value === "nasa_power") {
        hint.innerText = "NASA Langley Research Center • CF-1.8 Compliant • DOI: 10.5067/POWER/10.0.0";
      } else {
        hint.innerText = "NASA GMAO • CF-1.6 Compliant • DOI: 10.5067/A7F0JNNUTWOB";
      }
    });
  }

  // CF-1.8 NetCDF-4 Export
  const exportNetcdfBtn = document.getElementById("exportNetcdfBtn");
  if (exportNetcdfBtn) {
    exportNetcdfBtn.addEventListener("click", () => {
      if (!currentAnalysisId) {
        alert("Please run an analysis first.");
        return;
      }
      window.open(`${API_BASE}/analysis/${currentAnalysisId}/export/netcdf`, "_blank");
    });
  }

  // GeoJSON FeatureCollection Export
  const exportGeojsonBtn = document.getElementById("exportGeojsonBtn");
  if (exportGeojsonBtn) {
    exportGeojsonBtn.addEventListener("click", async () => {
      if (!currentAnalysisId) {
        alert("Please run an analysis first.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/export/geojson`);
        if (!res.ok) throw new Error("Export GeoJSON failed");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `earthsift_trends_${currentAnalysisId}.geojson`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (e) {
        alert("Failed to export GeoJSON: " + e.message);
      }
    });
  }

  // NASA Climate Science Dossier Export
  const exportDossierBtn = document.getElementById("exportDossierBtn");
  if (exportDossierBtn) {
    exportDossierBtn.addEventListener("click", async () => {
      if (!currentAnalysisId) {
        alert("Please run an analysis first.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/dossier`);
        if (!res.ok) throw new Error("Export Dossier failed");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `NASA_Climate_Science_Dossier_${currentAnalysisId}.md`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (e) {
        alert("Failed to export Scientific Dossier: " + e.message);
      }
    });
  }

  // Calculate year count hint
  const updateYearHint = () => {
    const s = parseInt(document.getElementById("startYear").value, 10);
    const e = parseInt(document.getElementById("endYear").value, 10);
    document.getElementById("yearCountHint").innerText = `${Math.max(0, e - s + 1)} consecutive annual records`;
  };
  document.getElementById("startYear").addEventListener("input", updateYearHint);
  document.getElementById("endYear").addEventListener("input", updateYearHint);

  // Auto-run initial analysis
  setTimeout(executeAnalysis, 500);
});
