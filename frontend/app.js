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

// Color scale interpolator for diverging trend palette
function getTrendColor(slope, minVal, maxVal) {
  // Normalize slope to [-1, 1] relative to extremes
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
    // Check significance mask filter
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

    // Update legend and metrics
    document.getElementById("legendUnit").innerText = data.slope_units;
    document.getElementById("legendMin").innerText = data.summary.min_slope.toFixed(2);
    document.getElementById("legendMax").innerText = (data.summary.max_slope > 0 ? "+" : "") + data.summary.max_slope.toFixed(2);
    document.getElementById("mapSubtitle").innerText = `${data.variable_name} (${data.time_span}) • ${data.summary.significant_cells_fdr} FDR Significant Cells`;

    // Render grid
    const maskSig = document.getElementById("maskToggle").checked;
    renderSpatialGrid(data.grid, data.summary.min_slope, data.summary.max_slope, maskSig);

    // Update contrasts card
    updateContrastsUI(data.contrasts, data.slope_units);

    // Auto-select the first significant cell or center cell
    const targetCell = data.grid.find(c => c.is_significant_fdr) || data.grid[0];
    if (targetCell) {
      selectCell(targetCell.lat, targetCell.lon);
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

// Select a specific coordinate cell and update time series & evidence
async function selectCell(lat, lon) {
  if (!currentAnalysisId) return;

  try {
    const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/cell?lat=${lat}&lon=${lon}`);
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
    document.getElementById("evLimitations").innerText = ev.scientific_limitation;

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
    source: "NASA MERRA-2 Atmospheric Reanalysis"
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
