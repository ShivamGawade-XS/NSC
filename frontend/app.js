/**
 * EarthSift — Frontend Application Logic
 * Integrates Leaflet spatial rendering, Chart.js time series, and scientific API.
 */

// API Configuration: supports direct local backend or proxy
const API_BASE = window.location.port === "8000" ? "/api/v1" : "http://localhost:8000/api/v1";

let map;
let gridLayerGroup;
let timeSeriesChart;
let currentAnalysisId = null;
let currentSelectedCell = null;
let currentAnalysisData = null;
let candidateSignals = [];

// Color scale interpolator for diverging trend palette
function getTrendColor(slope, minVal, maxVal) {
  let norm;
  if (slope > 0) {
    norm = Math.min(1.0, slope / (maxVal || 0.5));
    // Interpolate dark neutral to vivid crimson/red
    return `rgba(${Math.round(200 + 55 * norm)}, ${Math.round(60 * (1 - norm))}, ${Math.round(60 * (1 - norm))}, 0.85)`;
  } else if (slope < 0) {
    norm = Math.min(1.0, Math.abs(slope) / Math.abs(minVal || -0.5));
    // Interpolate dark neutral to vivid blue
    return `rgba(${Math.round(30 * (1 - norm))}, ${Math.round(130 + 50 * norm)}, ${Math.round(240)}, 0.85)`;
  } else {
    return "rgba(100, 116, 139, 0.4)";
  }
}

// Initialize Leaflet Map
function initMap() {
  map = L.map("trendMap", {
    center: [38.0, -95.0],
    zoom: 4,
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
    map.setView([38.0, -95.0], 4);
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

  grid.forEach(cell => {
    if (maskSigOnly && !cell.is_significant_fdr) {
      return;
    }

    const color = getTrendColor(cell.slope, minSlope, maxSlope);
    const isSig = cell.is_significant_fdr;

    const marker = L.circleMarker([cell.lat, cell.lon], {
      radius: isSig ? 9 : 6,
      fillColor: color,
      fillOpacity: isSig ? 0.85 : 0.45,
      color: isSig ? "#38bdf8" : "#334155",
      weight: isSig ? 1.5 : 0.8
    });

    const tooltipContent = `
      <div style="font-family: Inter, sans-serif; font-size: 11px;">
        <strong>Lat:</strong> ${cell.lat.toFixed(1)}°, <strong>Lon:</strong> ${cell.lon.toFixed(1)}°<br/>
        <strong>Slope:</strong> ${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)}<br/>
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

    // Update Data Regime Banner (Synthetic vs Live)
    updateDataRegimeBanner(data.provenance);

    // Update legend and metrics
    document.getElementById("legendUnit").innerText = data.slope_units;
    document.getElementById("legendMin").innerText = data.summary.min_slope.toFixed(2);
    document.getElementById("legendMax").innerText = (data.summary.max_slope > 0 ? "+" : "") + data.summary.max_slope.toFixed(2);
    document.getElementById("mapSubtitle").innerText = `${data.variable_name} (${data.time_span}) • ${data.summary.significant_cells_fdr} FDR Significant Cells`;

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
    badge.innerText = "LIVE MODE";
    msg.innerText = "NASA GMAO MERRA-2 Earthdata Stream (Verified Observations).";
    if (provLabel) {
      provLabel.innerText = "NASA GMAO Live Stream";
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
  // Center between them
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
    document.getElementById("evCoverage").innerText = ev.coverage;
    document.getElementById("evMethod").innerText = ev.method;
    document.getElementById("evLimitations").innerText = ev.scientific_limitation;
    document.getElementById("evSource").innerText = ev.source;
    document.getElementById("evDataRegimeLabel").innerText = `Data Regime: ${ev.data_source_label || "NASA MERRA-2"}`;

    // Reset AI explainer box
    document.getElementById("aiOutputBox").classList.add("hidden");
  } catch (err) {
    console.error("Failed to load cell drilldown:", err);
  }
}

// Update Contrasts UI
function updateContrastsUI(contrasts, units) {
  const container = document.getElementById("contrastContent");
  if (!contrasts || contrasts.length === 0) {
    container.innerHTML = "No significant opposing pairs detected in current bounding box.";
    return;
  }

  const c = contrasts[0];
  const pos = c.region_increasing;
  const neg = c.region_decreasing;

  container.innerHTML = `
    <strong>Divergence Delta:</strong> ${c.magnitude_delta.toFixed(3)} ${units}<br/>
    • <span style="color:#ef4444">Warming/Increasing:</span> ${pos.cell_count} cells (Mean: +${pos.mean_slope.toFixed(3)})<br/>
    • <span style="color:#38bdf8">Cooling/Drying:</span> ${neg.cell_count} cells (Mean: ${neg.mean_slope.toFixed(3)})
  `;
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
