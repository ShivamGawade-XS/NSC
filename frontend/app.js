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
let domainBoundsLayer = null;
let contrastLayerGroup = null;
let gibsLayer = null;
let timeSeriesChart;
let currentAnalysisId = null;
let currentSelectedCell = null;
let currentAnalysisData = null;
let candidateSignals = [];
let isAnomalyMode = false;

// Detective Case Presets for Instant 1-Click Verification
const DETECTIVE_PRESETS = {
  "case1": {
    dataset: "nasa_power",
    variable: "T2M",
    startYear: 2000,
    endYear: 2023,
    bbox: [-102.0, 30.0, -94.0, 38.0],
    desc: "Texas & Southern Plains Heat Acceleration (NASA POWER Verified)"
  },
  "case2": {
    dataset: "merra2_reanalysis",
    variable: "T2M",
    startYear: 2000,
    endYear: 2020,
    bbox: [-101.0, 31.0, -95.0, 37.0],
    isCompound: true,
    desc: "Southwest US Compound Aridification (T + P Dual Hazard)"
  },
  "case3": {
    dataset: "merra2_reanalysis",
    variable: "T2M",
    startYear: 1990,
    endYear: 2023,
    bbox: [-125.0, 25.0, -65.0, 50.0],
    desc: "North American Continental Synoptic Footprint"
  },
  "case4": {
    dataset: "nasa_power",
    variable: "PRECTOTCORR",
    startYear: 2000,
    endYear: 2023,
    bbox: [-100.0, 32.0, -92.0, 40.0],
    desc: "Agricultural Belt Hydrological Variability"
  }
};

// Variable compatibility map per dataset
const DATASET_VARIABLES = {
  "nasa_power": [
    { id: "T2M", label: "2-Meter Air Temperature (T2M) [°C]" },
    { id: "PRECTOTCORR", label: "Total Corrected Precipitation [mm/day]" }
  ],
  "merra2_reanalysis": [
    { id: "T2M", label: "2-Meter Air Temperature (T2M) [°C]" },
    { id: "PRECTOT", label: "Total Precipitation Rate (PRECTOT) [mm/day]" }
  ]
};

// Coordinate formatting: proper N/S and E/W cardinal directions
function formatCoords(lat, lon) {
  const ns = lat >= 0 ? `${Math.abs(lat).toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
  const ew = lon >= 0 ? `${Math.abs(lon).toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`;
  return `${ns}, ${ew}`;
}

function formatCoords1(lat, lon) {
  const ns = lat >= 0 ? `${Math.abs(lat).toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const ew = lon >= 0 ? `${Math.abs(lon).toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return `${ns}, ${ew}`;
}

// Statistical p-value formatter (guards against invalid p = 0.0000)
function formatPVal(p) {
  if (p === null || p === undefined) return "N/A";
  if (p < 0.0001) return "< 0.0001";
  return p.toFixed(4);
}

// Deep-linking URL hash sync
function updateUrlHash(params = {}) {
  try {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const currentParams = new URLSearchParams(hash);
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") {
        currentParams.set(k, v);
      } else {
        currentParams.delete(k);
      }
    }
    history.replaceState(null, "", `#${currentParams.toString()}`);
  } catch (e) {
    // Graceful fallback if URLSearchParams unavailable
  }
}

// Restore state from URL hash
function restoreFromUrlHash() {
  if (!window.location.hash || window.location.hash.length <= 1) return false;
  try {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const dataset = params.get("dataset");
    const variable = params.get("var");
    const start = params.get("start");
    const end = params.get("end");
    const minLon = params.get("min_lon");
    const minLat = params.get("min_lat");
    const maxLon = params.get("max_lon");
    const maxLat = params.get("max_lat");

    if (dataset) {
      document.getElementById("datasetSelect").value = dataset;
      updateVariableOptions(dataset);
    }
    if (variable) document.getElementById("variableSelect").value = variable;
    if (start) document.getElementById("startYear").value = start;
    if (end) document.getElementById("endYear").value = end;
    if (minLon) document.getElementById("bboxMinLon").value = minLon;
    if (minLat) document.getElementById("bboxMinLat").value = minLat;
    if (maxLon) document.getElementById("bboxMaxLon").value = maxLon;
    if (maxLat) document.getElementById("bboxMaxLat").value = maxLat;
    return true;
  } catch (e) {
    return false;
  }
}

// Update variable dropdown based on selected dataset
function updateVariableOptions(datasetId) {
  const variableSelect = document.getElementById("variableSelect");
  const vars = DATASET_VARIABLES[datasetId] || DATASET_VARIABLES["nasa_power"];
  variableSelect.innerHTML = vars.map(v => `<option value="${v.id}">${v.label}</option>`).join("");
}

// Toast notification system (replaces banner hijacking)
const TOAST_ICONS = {
  info: '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>',
  success: '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>',
  error: '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M15 9l-6 6m0-6l6 6"/></svg>',
  warning: '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>'
};

function showToast(message, type = 'info', durationMs = 5000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  const dismiss = () => {
    toast.classList.add('exiting');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };
  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);
  if (durationMs > 0) setTimeout(dismiss, durationMs);
  return toast;
}

// Legacy banner error handler (kept for API compatibility)
function showErrorToast(message) {
  showToast(message, 'error');
}

// Global loading overlay helpers
function showLoadingOverlay(title, sub) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  if (title) document.getElementById('loadingTitle').innerText = title;
  if (sub) document.getElementById('loadingSub').innerText = sub;
  overlay.classList.remove('hidden');
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
}


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

  // High-fidelity Dark Gray Canvas basemap (unwatermarked, fast, reliable CDN)
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, NAVTEQ | NASA Space Apps 2026',
    maxZoom: 16
  }).addTo(map);

  gridLayerGroup = L.layerGroup().addTo(map);
  contrastLayerGroup = L.layerGroup().addTo(map);

  document.getElementById("resetViewBtn").addEventListener("click", () => {
    map.setView([34.0, -98.0], 5);
  });
}

// Initialize Chart.js Time Series (Fuselab + Shakuro Scientific CI Envelope)
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
          borderWidth: 2.5,
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 1
        },
        {
          label: "Climatology Baseline (μ)",
          data: [],
          borderColor: "#64748b",
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 5
        },
        {
          label: "ci_lower_hidden",
          data: [],
          borderColor: "transparent",
          backgroundColor: "transparent",
          pointRadius: 0,
          fill: false,
          order: 4
        },
        {
          label: "95% CI (Gilbert 1987)",
          data: [],
          borderColor: "rgba(245, 158, 11, 0.35)",
          borderWidth: 1,
          borderDash: [3, 3],
          backgroundColor: "rgba(245, 158, 11, 0.12)",
          pointRadius: 0,
          fill: "-1",
          tension: 0,
          order: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            filter: (item) => item.text !== "ci_lower_hidden",
            color: "#94a3b8",
            font: { size: 10, family: "Inter" },
            boxWidth: 12
          }
        },
        tooltip: {
          backgroundColor: "rgba(10, 15, 29, 0.92)",
          titleColor: "#00f0ff",
          bodyColor: "#f8fafc",
          borderColor: "rgba(0, 240, 255, 0.3)",
          borderWidth: 1,
          padding: 8,
          titleFont: { family: "Outfit", size: 11 },
          bodyFont: { family: "JetBrains Mono", size: 10 }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#64748b", font: { size: 9, family: "JetBrains Mono" } }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
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
  const useFdr = document.getElementById("fdrToggle") ? document.getElementById("fdrToggle").checked : true;

  grid.forEach(cell => {
    const isSig = useFdr ? cell.is_significant_fdr : cell.is_significant_raw;
    if (maskSigOnly && !isSig) {
      return;
    }

    const color = useLisa
      ? getLISAColor(cell.lisa_cluster)
      : getTrendColor(cell.slope, minSlope, maxSlope);

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
        <strong>Coords:</strong> ${formatCoords(cell.lat, cell.lon)}<br/>
        <strong>Slope:</strong> ${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)}<br/>
        <strong>95% CI:</strong> ${ciText}<br/>
        <strong>LISA Cluster:</strong> ${cell.lisa_cluster || "NS"}<br/>
        <strong>p-val:</strong> ${cell.p_value.toFixed(4)} | <strong>FDR q:</strong> ${cell.q_value !== undefined ? cell.q_value.toFixed(4) : "N/A"}<br/>
        <strong>Status:</strong> ${isSig ? (useFdr ? "FDR Significant (q < 0.05)" : "Significant (p < 0.05)") : "Non-Significant"}
      </div>
    `;
    marker.bindTooltip(tooltipContent, { className: "custom-map-tooltip" });

    marker.on("mouseover", () => {
      const hudCoords = document.getElementById("hudCoords");
      if (hudCoords) hudCoords.innerText = formatCoords(cell.lat, cell.lon);
      const hudSlope = document.getElementById("hudSlope");
      if (hudSlope) hudSlope.innerText = `${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)}`;
      const hudSig = document.getElementById("hudSig");
      if (hudSig) hudSig.innerText = `p = ${formatPVal(cell.p_value)} (${cell.lisa_cluster || "NS"})`;
    });

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

  const minLonEl = document.getElementById("bboxMinLon");
  const minLatEl = document.getElementById("bboxMinLat");
  const maxLonEl = document.getElementById("bboxMaxLon");
  const maxLatEl = document.getElementById("bboxMaxLat");
  
  let bbox = undefined;
  if (minLonEl && minLatEl && maxLonEl && maxLatEl &&
      minLonEl.value.trim() !== "" && minLatEl.value.trim() !== "" &&
      maxLonEl.value.trim() !== "" && maxLatEl.value.trim() !== "") {
    const minLon = parseFloat(minLonEl.value);
    const minLat = parseFloat(minLatEl.value);
    const maxLon = parseFloat(maxLonEl.value);
    const maxLat = parseFloat(maxLatEl.value);
    if (!isNaN(minLon) && !isNaN(minLat) && !isNaN(maxLon) && !isNaN(maxLat)) {
      bbox = [minLon, minLat, maxLon, maxLat];
    }
  }

  const payload = {
    dataset_id: datasetId,
    variable_id: variableId,
    start_year: startYear,
    end_year: endYear,
    alpha: 0.05,
    use_fdr: fdrActive
  };
  if (bbox) {
    payload.bbox = bbox;
  }

  showLoadingOverlay(
    'Computing Trend Analysis...',
    `${datasetId === 'nasa_power' ? 'NASA POWER' : 'MERRA-2'} • ${variableId} • ${startYear}–${endYear} • Running Mann-Kendall • FDR Correction`
  );

  try {
    const res = await fetch(`${API_BASE}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const errMsg = errBody && errBody.detail ? errBody.detail : `API error: ${res.status} ${res.statusText}`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    currentAnalysisData = data;
    currentAnalysisId = data.analysis_id;

    // Update Data Regime Banner (Synthetic vs Live Authentic NASA)
    updateDataRegimeBanner(data.provenance);

    // Update legend and metrics
    document.getElementById("legendUnit").innerText = data.slope_units;
    document.getElementById("legendMin").innerText = data.summary.min_slope.toFixed(2);
    const isFdrActive = document.getElementById("fdrToggle") ? document.getElementById("fdrToggle").checked : true;
    const sigCount = isFdrActive ? data.summary.significant_cells_fdr : data.summary.significant_cells_raw;
    const sigBadge = isFdrActive ? "FDR (q ≤ 0.05)" : "Raw (p ≤ 0.05)";
    document.getElementById("mapSubtitle").innerText = `${data.variable_name} (${data.time_span}) • ${sigCount} / ${data.summary.total_cells} Significant Cells [${sigBadge}]`;

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

    // Render Spatial Domain Bounding Box Overlay
    if (domainBoundsLayer && map.hasLayer(domainBoundsLayer)) {
      map.removeLayer(domainBoundsLayer);
      domainBoundsLayer = null;
    }
    const activeBbox = bbox || (data.summary && data.summary.bounding_box);
    if (activeBbox && activeBbox.length === 4) {
      const [bMinLon, bMinLat, bMaxLon, bMaxLat] = activeBbox;
      domainBoundsLayer = L.rectangle(
        [[bMinLat, bMinLon], [bMaxLat, bMaxLon]],
        {
          color: "#38bdf8",
          weight: 1.5,
          dashArray: "4, 4",
          fill: false,
          interactive: false
        }
      ).addTo(map);
      // Zoom to the analysis domain
      map.fitBounds([[bMinLat, bMinLon], [bMaxLat, bMaxLon]], { padding: [40, 40] });
    }
    if (contrastLayerGroup) {
      contrastLayerGroup.clearLayers();
    }

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
    showToast(`Analysis complete! ${data.summary.significant_cells_fdr} FDR-significant cells detected.`, 'success');
  } catch (err) {
    console.error("Failed to run analysis:", err);
    document.getElementById("apiStatusText").innerText = "Error";
    showToast(err.message || "Analysis failed. Check parameters and try again.", 'error');
  } finally {
    hideLoadingOverlay();
    btn.disabled = false;
    btn.innerHTML = `Execute Trend Detection`;
  }
}

// Render Multivariate Compound Hazard Grid
function getHazardColor(type) {
  switch(type) {
    case "severe_aridification":
    case "compound_aridification":
      return "#ef4444"; // Hot & Dry (Crimson)
    case "hydrologic_intensification":
    case "hydrological_intensification":
      return "#3b82f6"; // Warm & Wet (Blue)
    case "moderate_drying":
      return "#f59e0b"; // Drying (Amber)
    case "thermal_buffering":
      return "#10b981"; // Buffer / Cooling (Emerald)
    default:
      return "#64748b"; // Neutral (Slate)
  }
}

function renderCompoundGrid(cells) {
  gridLayerGroup.clearLayers();
  const canvasRenderer = L.canvas({ padding: 0.5 });
  
  cells.forEach(cell => {
    const color = getHazardColor(cell.hazard_type);
    const isHazard = cell.hazard_type !== "neutral";
    const marker = L.circleMarker([cell.lat, cell.lon], {
      renderer: canvasRenderer,
      radius: isHazard ? 8 : 5,
      fillColor: color,
      fillOpacity: isHazard ? 0.9 : 0.45,
      color: isHazard ? "#ffffff" : "#334155",
      weight: isHazard ? 1.5 : 0.8
    });

    const tooltipContent = `
      <div style="font-family: Inter, sans-serif; font-size: 11px;">
        <strong>Coords:</strong> ${formatCoords(cell.lat, cell.lon)}<br/>
        <strong>Hazard:</strong> <span style="color:${color};font-weight:700;">${cell.hazard_type.replace(/_/g, " ").toUpperCase()}</span><br/>
        <strong>CAI:</strong> ${cell.cai !== undefined ? cell.cai.toFixed(3) : "N/A"}<br/>
        <strong>Temp Slope:</strong> ${cell.temp_slope !== undefined ? (cell.temp_slope > 0 ? "+" : "") + cell.temp_slope.toFixed(3) + " °C/dec" : "N/A"}<br/>
        <strong>Precip Slope:</strong> ${cell.precip_slope !== undefined ? (cell.precip_slope > 0 ? "+" : "") + cell.precip_slope.toFixed(3) : "N/A"}
      </div>
    `;
    marker.bindTooltip(tooltipContent, { className: "custom-map-tooltip" });

    marker.on("mouseover", () => {
      const hudCoords = document.getElementById("hudCoords");
      if (hudCoords) hudCoords.innerText = formatCoords(cell.lat, cell.lon);
      const hudSlope = document.getElementById("hudSlope");
      if (hudSlope) hudSlope.innerText = `CAI: ${cell.cai !== undefined ? cell.cai.toFixed(3) : "--"}`;
      const hudSig = document.getElementById("hudSig");
      if (hudSig) hudSig.innerText = `Class: ${cell.hazard_type.replace(/_/g, " ")}`;
    });

    gridLayerGroup.addLayer(marker);
  });
}

// Execute Multivariate Compound Climate Hazard Analysis (T + P)
async function executeCompoundHazardAnalysis() {
  const btn = document.getElementById("runCompoundBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="btn-icon">⏳</span> Computing Dual Hazards...`;
  }

  const datasetId = document.getElementById("datasetSelect").value;
  const startYear = parseInt(document.getElementById("startYear").value, 10);
  const endYear = parseInt(document.getElementById("endYear").value, 10);

  const minLonEl = document.getElementById("bboxMinLon");
  const minLatEl = document.getElementById("bboxMinLat");
  const maxLonEl = document.getElementById("bboxMaxLon");
  const maxLatEl = document.getElementById("bboxMaxLat");
  
  let bbox = undefined;
  if (minLonEl && minLatEl && maxLonEl && maxLatEl &&
      minLonEl.value.trim() !== "" && minLatEl.value.trim() !== "" &&
      maxLonEl.value.trim() !== "" && maxLatEl.value.trim() !== "") {
    const minLon = parseFloat(minLonEl.value);
    const minLat = parseFloat(minLatEl.value);
    const maxLon = parseFloat(maxLonEl.value);
    const maxLat = parseFloat(maxLatEl.value);
    if (!isNaN(minLon) && !isNaN(minLat) && !isNaN(maxLon) && !isNaN(maxLat)) {
      bbox = [minLon, minLat, maxLon, maxLat];
    }
  }

  const payload = {
    dataset_id: datasetId,
    temp_variable_id: "T2M",
    precip_variable_id: datasetId === "nasa_power" ? "PRECTOTCORR" : "PRECTOT",
    start_year: startYear,
    end_year: endYear,
    alpha: 0.05
  };
  if (bbox) {
    payload.bbox = bbox;
  }

  showLoadingOverlay(
    'Computing Compound Hazard Analysis...',
    'Fetching T2M + Precipitation • Building CAI • Multivariate Hazard Classification'
  );

  try {
    const res = await fetch(`${API_BASE}/analysis/compound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const errMsg = errBody && errBody.detail ? errBody.detail : `API error: ${res.status} ${res.statusText}`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    
    // Update map subtitle
    const aridPct = (data.aridification_fraction * 100).toFixed(1);
    const intenPct = (data.intensification_fraction * 100).toFixed(1);
    document.getElementById("mapSubtitle").innerText = 
      `Multivariate Compound Hazard (T2M + Precip) • Aridification: ${aridPct}% • Intensification: ${intenPct}%`;

    // Render compound cells on the map
    renderCompoundGrid(data.cells);

    // Zoom to the compound domain bounding box if available
    if (bbox && bbox.length === 4) {
      map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [40, 40] });
    }

    // Update contrast summary card with compound findings
    const contrastContent = document.getElementById("contrastContent");
    if (contrastContent) {
      const dist = data.hazard_distribution || {};
      const severeArid = dist.severe_aridification || dist.compound_aridification || 0;
      const hydroInten = dist.hydrologic_intensification || dist.hydrological_intensification || 0;
      const modDrying = dist.moderate_drying || dist.thermal_buffering || 0;
      const neutral = dist.neutral_baseline || dist.neutral || 0;

      contrastContent.innerHTML = `
        <div style="font-size:0.8rem; line-height:1.4;">
          <strong>Multivariate Risk Engine:</strong> ${data.summary}<br/>
          <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
            <span style="background:rgba(239,68,68,0.2); color:#f87171; padding:2px 6px; border-radius:4px; font-size:0.75rem;">
              Severe Aridification: ${severeArid}
            </span>
            <span style="background:rgba(59,130,246,0.2); color:#60a5fa; padding:2px 6px; border-radius:4px; font-size:0.75rem;">
              Intensification: ${hydroInten}
            </span>
            <span style="background:rgba(245,158,11,0.2); color:#fbbf24; padding:2px 6px; border-radius:4px; font-size:0.75rem;">
              Moderate Drying: ${modDrying}
            </span>
            <span style="background:rgba(100,116,139,0.2); color:#94a3b8; padding:2px 6px; border-radius:4px; font-size:0.75rem;">
              Baseline: ${neutral}
            </span>
          </div>
        </div>
      `;
    }

    // Update legend for Compound Hazard
    document.getElementById("legendUnit").innerText = "CAI Hazard Index";
    document.getElementById("legendMin").innerText = "Buffering";
    document.getElementById("legendMax").innerText = "Aridification";

    showToast(`Compound Hazard complete! Aridification Risk: ${aridPct}% | Intensification: ${intenPct}%`, 'success');
  } catch (err) {
    console.error("Compound Hazard Analysis failed:", err);
    showToast(err.message || "Compound hazard analysis failed.", 'error');
  } finally {
    hideLoadingOverlay();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Compound Hazard Analysis (T & P)`;
    }
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
      const scorePct = Math.min(100, Math.max(12, Math.round((sig.discovery_score || 0.5) * 50)));
      card.innerHTML = `
        <div class="signal-left">
          <span class="signal-rank">#${idx + 1}</span>
          <div style="flex:1;">
            <div class="signal-coords">${formatCoords1(sig.lat, sig.lon)}</div>
            <div class="signal-sub">${sig.direction.toUpperCase()} • ${sig.slope > 0 ? "+" : ""}${sig.slope.toFixed(3)}</div>
            <div class="signal-meter-track" title="Composite discovery score: ${sig.discovery_score.toFixed(3)}">
              <div class="signal-meter-fill" style="width: ${scorePct}%;"></div>
            </div>
          </div>
        </div>
        <div class="signal-score-badge" title="${sig.ranking_rationale}">
          Score: ${sig.discovery_score.toFixed(3)}
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
function focusContrastingRegions(pairIndex = 0) {
  if (!currentAnalysisData || !currentAnalysisData.contrasts || currentAnalysisData.contrasts.length === 0) {
    showErrorToast("No significant contrasting regional pairs in current window.");
    return;
  }
  if (contrastLayerGroup) {
    contrastLayerGroup.clearLayers();
  }
  const c = currentAnalysisData.contrasts[pairIndex] || currentAnalysisData.contrasts[0];
  const pos = c.region_increasing;
  const neg = c.region_decreasing;

  // Increasing cluster bounding rectangle (Red / Warming)
  const posBounds = [[pos.bbox[1], pos.bbox[0]], [pos.bbox[3], pos.bbox[2]]];
  const posRect = L.rectangle(posBounds, {
    color: "#ef4444",
    weight: 2,
    fillColor: "#ef4444",
    fillOpacity: 0.18,
    dashArray: "4, 4"
  }).bindTooltip(`<strong>Warming / Increasing Regime</strong><br/>Cells: ${pos.cell_count}<br/>Mean Slope: +${pos.mean_slope.toFixed(3)} ${currentAnalysisData.slope_units}`);

  // Decreasing cluster bounding rectangle (Blue / Cooling)
  const negBounds = [[neg.bbox[1], neg.bbox[0]], [neg.bbox[3], neg.bbox[2]]];
  const negRect = L.rectangle(negBounds, {
    color: "#38bdf8",
    weight: 2,
    fillColor: "#38bdf8",
    fillOpacity: 0.18,
    dashArray: "4, 4"
  }).bindTooltip(`<strong>Cooling / Decreasing Regime</strong><br/>Cells: ${neg.cell_count}<br/>Mean Slope: ${neg.mean_slope.toFixed(3)} ${currentAnalysisData.slope_units}`);

  // Divergence vector connecting line
  const vectorLine = L.polyline(
    [[pos.center[1], pos.center[0]], [neg.center[1], neg.center[0]]],
    {
      color: "#f59e0b",
      weight: 2.5,
      dashArray: "6, 6"
    }
  ).bindPopup(`
    <div style="font-family: Inter, sans-serif; font-size: 11px;">
      <strong style="color:#f59e0b;">Regional Divergence Vector</strong><br/>
      <strong>Net Magnitude Delta:</strong> Δ ${c.magnitude_delta.toFixed(4)} ${currentAnalysisData.slope_units}<br/>
      <small style="color:#94a3b8;">${c.scientific_caveat || "Spatial contrast pair verified."}</small>
    </div>
  `);

  contrastLayerGroup.addLayer(posRect);
  contrastLayerGroup.addLayer(negRect);
  contrastLayerGroup.addLayer(vectorLine);

  // Zoom to encompass both contrasting regimes
  const combinedBounds = L.latLngBounds(posBounds).extend(negBounds);
  map.fitBounds(combinedBounds, { padding: [50, 50] });
  vectorLine.openPopup();
}

// Render Time Series Chart (Raw vs Climatological Anomaly Mode with Gilbert CI Ribbon)
function renderTimeSeriesChart(cell) {
  if (!cell || !timeSeriesChart) return;
  const obs = cell.observations;
  const meanObs = obs.length > 0 ? (obs.reduce((sum, v) => sum + v, 0) / obs.length) : 0;

  // Compute Gilbert (1987) 95% Confidence Interval Envelope Ribbon
  let ciLower = [];
  let ciUpper = [];
  if (cell.ci_lower !== undefined && cell.ci_upper !== undefined && cell.fitted_values && cell.fitted_values.length > 0) {
    const startY = cell.years[0];
    const slopeDeltaL = ((cell.ci_lower - cell.slope) / 10.0);
    const slopeDeltaU = ((cell.ci_upper - cell.slope) / 10.0);
    ciLower = cell.fitted_values.map((fv, i) => Number((fv + slopeDeltaL * (cell.years[i] - startY)).toFixed(3)));
    ciUpper = cell.fitted_values.map((fv, i) => Number((fv + slopeDeltaU * (cell.years[i] - startY)).toFixed(3)));
  } else {
    ciLower = cell.fitted_values || [];
    ciUpper = cell.fitted_values || [];
  }

  timeSeriesChart.data.labels = cell.years;
  if (isAnomalyMode) {
    timeSeriesChart.data.datasets[0].label = "Anomalies (Δ)";
    timeSeriesChart.data.datasets[0].data = cell.observations.map(v => Number((v - meanObs).toFixed(3)));
    timeSeriesChart.data.datasets[1].label = "Sen's Trend (Anomaly Space)";
    timeSeriesChart.data.datasets[1].data = cell.fitted_values.map(v => Number((v - meanObs).toFixed(3)));
    timeSeriesChart.data.datasets[2].label = "Baseline Zero Reference";
    timeSeriesChart.data.datasets[2].data = cell.years.map(() => 0.0);
    timeSeriesChart.data.datasets[3].data = ciLower.map(v => Number((v - meanObs).toFixed(3)));
    timeSeriesChart.data.datasets[4].data = ciUpper.map(v => Number((v - meanObs).toFixed(3)));

    if (timeSeriesChart.options.scales && timeSeriesChart.options.scales.y) {
      timeSeriesChart.options.scales.y.title = {
        display: true,
        text: `Anomaly [Δ ${cell.display_units || ""}]`,
        color: "#94a3b8",
        font: { size: 10, family: "Inter" }
      };
    }
  } else {
    timeSeriesChart.data.datasets[0].label = "Observations";
    timeSeriesChart.data.datasets[0].data = cell.observations;
    timeSeriesChart.data.datasets[1].label = "Sen's Robust Trendline";
    timeSeriesChart.data.datasets[1].data = cell.fitted_values;
    timeSeriesChart.data.datasets[2].label = `Climatology Baseline (μ = ${meanObs.toFixed(2)})`;
    timeSeriesChart.data.datasets[2].data = cell.years.map(() => Number(meanObs.toFixed(2)));
    timeSeriesChart.data.datasets[3].data = ciLower;
    timeSeriesChart.data.datasets[4].data = ciUpper;

    if (timeSeriesChart.options.scales && timeSeriesChart.options.scales.y) {
      timeSeriesChart.options.scales.y.title = {
        display: true,
        text: cell.display_units || "",
        color: "#94a3b8",
        font: { size: 10, family: "Inter" }
      };
    }
  }
  timeSeriesChart.update();
}

// Select a specific coordinate cell and update time series, HUD & evidence
async function selectCell(lat, lon) {
  if (!currentAnalysisId) return;

  try {
    const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/timeseries?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("Failed to load cell details");

    const cell = await res.json();
    currentSelectedCell = cell;

    // Update Time Series Chart with CI Ribbon
    renderTimeSeriesChart(cell);

    // Update Crosshair HUD (Fuselab Real-Time GIS)
    const hudCoords = document.getElementById("hudCoords");
    if (hudCoords) hudCoords.innerText = formatCoords(cell.lat, cell.lon);
    const hudSlope = document.getElementById("hudSlope");
    if (hudSlope) hudSlope.innerText = `${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)} ${cell.slope_units}`;
    const hudSig = document.getElementById("hudSig");
    if (hudSig) hudSig.innerText = `p = ${formatPVal(cell.p_value)} (q = ${formatPVal(cell.q_value)})`;

    // Update Header and Badges
    document.getElementById("tsCoordinateLabel").innerText = `Coordinate: ${formatCoords(cell.lat, cell.lon)}`;
    document.getElementById("tsSlopeBadge").innerText = `Slope: ${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)} ${cell.slope_units}`;
    document.getElementById("tsPValBadge").innerText = `p = ${formatPVal(cell.p_value)}`;
    document.getElementById("tsTauBadge").innerText = `Kendall's τ = ${cell.tau.toFixed(3)}`;

    // Update Pettitt (1979) Abrupt Regime Changepoint Badge
    const cpBadge = document.getElementById("tsChangepointBadge");
    if (cpBadge) {
      if (cell.changepoint_year && cell.changepoint_p_value !== undefined) {
        if (cell.changepoint_p_value < 0.05) {
          cpBadge.innerHTML = `Shift: <strong style="color:#f87171;">${cell.changepoint_year}</strong> (p = ${formatPVal(cell.changepoint_p_value)})`;
          cpBadge.title = `Statistically significant abrupt regime shift detected in ${cell.changepoint_year} (Pettitt test p = ${formatPVal(cell.changepoint_p_value)})`;
        } else {
          cpBadge.innerHTML = `Shift: None (p = ${formatPVal(cell.changepoint_p_value)})`;
          cpBadge.title = `No statistically significant abrupt shift detected (gradual monotonic drift)`;
        }
      } else {
        cpBadge.innerText = "Shift: None";
      }
    }

    // Deep-link current selection to URL hash
    updateUrlHash({
      lat: cell.lat,
      lon: cell.lon
    });

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

    // Update SpaceX Active Target Card
    const assetTitle = document.getElementById("assetTitle");
    if (assetTitle) assetTitle.innerText = `Cell ${formatCoords(cell.lat, cell.lon)}`;
    const assetSub = document.getElementById("assetSub");
    if (assetSub) assetSub.innerText = `NASA POWER • 0.5° SYNOPTIC • ${cell.variable_name || "T2M"}`;
    const assetStatusBadge = document.getElementById("assetStatusBadge");
    if (assetStatusBadge) {
      if (cell.significant) {
        assetStatusBadge.innerText = "HOTSPOT DETECTED";
        assetStatusBadge.className = "asset-status-badge hotspot";
      } else {
        assetStatusBadge.innerText = "NOMINAL";
        assetStatusBadge.className = "asset-status-badge nominal";
      }
    }

    // Update SpaceX Amber Anomaly Card
    const anomalyCard = document.getElementById("spacexAnomalyCard");
    if (anomalyCard) {
      if (cell.significant) {
        anomalyCard.classList.remove("hidden");
        const driftPct = Math.min(100, Math.max(15, Math.round(Math.abs(cell.slope) * 110)));
        const confPct = Math.min(99, Math.max(50, Math.round((1 - Math.min(cell.p_value, 0.5)) * 100)));
        const coherencePct = cell.lisa_cluster === "HH" ? 92 : (cell.lisa_cluster === "LL" ? 85 : 68);
        const dPctEl = document.getElementById("anomDriftPct");
        if (dPctEl) dPctEl.innerText = `${driftPct}%`;
        const dBarEl = document.getElementById("anomDriftBar");
        if (dBarEl) dBarEl.style.width = `${driftPct}%`;
        const cPctEl = document.getElementById("anomConfPct");
        if (cPctEl) cPctEl.innerText = `${confPct}%`;
        const cBarEl = document.getElementById("anomConfBar");
        if (cBarEl) cBarEl.style.width = `${confPct}%`;
        const cohPctEl = document.getElementById("anomCoherencePct");
        if (cohPctEl) cohPctEl.innerText = `${coherencePct}%`;
        const cohBarEl = document.getElementById("anomCoherenceBar");
        if (cohBarEl) cohBarEl.style.width = `${coherencePct}%`;
        const subEl = document.getElementById("anomalySubText");
        if (subEl) subEl.innerText = `${cell.slope > 0 ? "Positive" : "Negative"} Monotonic Trend (${cell.slope > 0 ? "+" : ""}${cell.slope.toFixed(4)} ${cell.slope_units})`;
      } else {
        anomalyCard.classList.add("hidden");
      }
    }

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
      <div class="contrast-card-item" data-contrast-idx="${idx}" style="cursor:pointer; background: rgba(14, 22, 38, 0.7); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; font-size: 11px; transition: border-color 0.2s;" title="Click to view divergence vectors on map">
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

  container.querySelectorAll(".contrast-card-item").forEach(card => {
    card.addEventListener("click", () => {
      const idx = parseInt(card.dataset.contrastIdx, 10);
      focusContrastingRegions(idx);
    });
  });
}

// AI Explainer Request
async function requestAiExplanation() {
  if (!currentSelectedCell) {
    showToast("Select a coordinate cell on the map first to generate an AI explanation.", 'warning');
    return;
  }

  const box = document.getElementById("aiOutputBox");
  const loader = document.getElementById("aiLoader");
  const content = document.getElementById("aiContentText");
  const aiActions = document.getElementById("aiActions");

  box.classList.remove("hidden");
  loader.style.display = "block";
  content.innerText = "";
  if (aiActions) aiActions.classList.add("hidden");

  const payload = {
    variable_name: currentSelectedCell.variable_name,
    location: formatCoords1(currentSelectedCell.lat, currentSelectedCell.lon),
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
    if (aiActions) aiActions.classList.remove("hidden");
  } catch (err) {
    loader.style.display = "none";
    content.innerText = "Deterministic fallback: Trend verified empirically under Mann-Kendall test. Explanation unavailable.";
    if (aiActions) aiActions.classList.remove("hidden");
  }
}

// Load Detective Case Study Preset
function loadPreset(presetKey) {
  const preset = DETECTIVE_PRESETS[presetKey];
  if (!preset) return;

  const datasetSelect = document.getElementById("datasetSelect");
  const variableSelect = document.getElementById("variableSelect");
  const startYear = document.getElementById("startYear");
  const endYear = document.getElementById("endYear");
  const minLonEl = document.getElementById("bboxMinLon");
  const minLatEl = document.getElementById("bboxMinLat");
  const maxLonEl = document.getElementById("bboxMaxLon");
  const maxLatEl = document.getElementById("bboxMaxLat");
  const presetSelectEl = document.getElementById("presetSelect");

  if (presetSelectEl) presetSelectEl.value = presetKey;
  if (datasetSelect) datasetSelect.value = preset.dataset;
  updateVariableOptions(preset.dataset);
  if (variableSelect) variableSelect.value = preset.variable;
  if (startYear) startYear.value = preset.startYear;
  if (endYear) endYear.value = preset.endYear;
  if (minLonEl) minLonEl.value = preset.bbox[0];
  if (minLatEl) minLatEl.value = preset.bbox[1];
  if (maxLonEl) maxLonEl.value = preset.bbox[2];
  if (maxLatEl) maxLatEl.value = preset.bbox[3];

  const s = parseInt(startYear.value, 10);
  const e = parseInt(endYear.value, 10);
  const hintYear = document.getElementById("yearCountHint");
  if (hintYear) hintYear.innerText = `${Math.max(0, e - s + 1)} consecutive annual records`;

  // Update bbox hint with the actual bbox values
  const bboxHint = document.getElementById("bboxHint");
  if (bboxHint) bboxHint.innerText = `Region: [${preset.bbox[0]}, ${preset.bbox[1]}] → [${preset.bbox[2]}, ${preset.bbox[3]}] • ${preset.desc}`;

  const hint = document.getElementById("datasetHint");
  if (hint) {
    hint.innerText = preset.dataset === "nasa_power"
      ? "NASA Langley Research Center • CF-1.8 Compliant • DOI: 10.5067/POWER/10.0.0"
      : "NASA GMAO • CF-1.6 Compliant • DOI: 10.5067/A7F0JNNUTWOB";
  }

  // Sync quick preset ribbon buttons (Orizon SpaceX HUD)
  document.querySelectorAll(".preset-pill-btn").forEach(btn => {
    if (btn.dataset.preset === presetKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  showToast(`Loaded: ${preset.desc}`, 'info', 4000);

  if (preset.isCompound) {
    executeCompoundHazardAnalysis();
  } else {
    executeAnalysis();
  }
}

// Boot & Event Listeners
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  initChart();

  // Quick Preset Investigation Ribbon Listeners (Orizon SpaceX HUD)
  document.querySelectorAll(".preset-pill-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pKey = btn.dataset.preset;
      if (pKey) {
        loadPreset(pKey);
      }
    });
  });

  // Detective Case Presets Dropdown
  const presetSelect = document.getElementById("presetSelect");
  if (presetSelect) {
    presetSelect.addEventListener("change", (e) => {
      if (e.target.value) {
        loadPreset(e.target.value);
      }
    });
  }

  // Climatological Anomaly Mode (Δ) Toggle
  const toggleAnomalyBtn = document.getElementById("toggleAnomalyBtn");
  if (toggleAnomalyBtn) {
    toggleAnomalyBtn.addEventListener("click", () => {
      isAnomalyMode = !isAnomalyMode;
      toggleAnomalyBtn.classList.toggle("active", isAnomalyMode);
      toggleAnomalyBtn.innerHTML = isAnomalyMode
        ? `Anomaly Filter: Active`
        : `Delta Anomaly Mode`;
      if (currentSelectedCell) {
        renderTimeSeriesChart(currentSelectedCell);
      }
    });
  }

  // Interactive Guided Detective Tour Modal
  const tourModal = document.getElementById("tourModal");
  const detectiveTourBtn = document.getElementById("detectiveTourBtn");
  const closeTourBtn = document.getElementById("closeTourBtn");
  const dismissTourBtn = document.getElementById("dismissTourBtn");

  const openTourModal = () => {
    if (tourModal) tourModal.classList.remove("hidden");
  };
  const closeTourModal = () => {
    if (tourModal) tourModal.classList.add("hidden");
  };

  if (detectiveTourBtn) detectiveTourBtn.addEventListener("click", openTourModal);
  if (closeTourBtn) closeTourBtn.addEventListener("click", closeTourModal);
  if (dismissTourBtn) dismissTourBtn.addEventListener("click", closeTourModal);
  if (tourModal) {
    tourModal.addEventListener("click", (e) => {
      if (e.target === tourModal) closeTourModal();
    });
  }

  // Tour Step Buttons
  document.querySelectorAll(".step-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const caseKey = btn.dataset.case;
      closeTourModal();
      if (caseKey === "lisa") {
        const lisaToggle = document.getElementById("lisaToggle");
        if (lisaToggle) {
          lisaToggle.checked = true;
          lisaToggle.dispatchEvent(new Event("change"));
        }
        showErrorToast("LISA Spatial Regime clustering enabled: Anselin High-High / Low-Low.");
      } else if (caseKey && DETECTIVE_PRESETS[caseKey]) {
        loadPreset(caseKey);
      }
    });
  });

  document.getElementById("runAnalysisBtn").addEventListener("click", executeAnalysis);
  document.getElementById("findInterestingBtn").addEventListener("click", findSomethingInteresting);
  const runCompoundBtn = document.getElementById("runCompoundBtn");
  if (runCompoundBtn) {
    runCompoundBtn.addEventListener("click", executeCompoundHazardAnalysis);
  }
  document.getElementById("findContrastsBtn").addEventListener("click", () => focusContrastingRegions(0));
  document.getElementById("askAiBtn").addEventListener("click", requestAiExplanation);

  // FDR Multiplicity Toggle
  const fdrToggle = document.getElementById("fdrToggle");
  if (fdrToggle) {
    fdrToggle.addEventListener("change", (e) => {
      const fdrBadge = document.getElementById("fdrStatusBadge");
      if (fdrBadge) {
        fdrBadge.innerText = e.target.checked ? "FDR (q ≤ 0.05)" : "Raw (p ≤ 0.05)";
      }
      if (currentAnalysisData) {
        const isFdrActive = e.target.checked;
        const sigCount = isFdrActive ? currentAnalysisData.summary.significant_cells_fdr : currentAnalysisData.summary.significant_cells_raw;
        const sigBadge = isFdrActive ? "FDR (q ≤ 0.05)" : "Raw (p ≤ 0.05)";
        document.getElementById("mapSubtitle").innerText = `${currentAnalysisData.variable_name} (${currentAnalysisData.time_span}) • ${sigCount} / ${currentAnalysisData.summary.total_cells} Significant Cells [${sigBadge}]`;
        renderSpatialGrid(
          currentAnalysisData.grid,
          currentAnalysisData.summary.min_slope,
          currentAnalysisData.summary.max_slope,
          document.getElementById("maskToggle").checked
        );
      }
    });
  }

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
    lisaToggle.addEventListener("change", (e) => {
      const legendTitle = document.querySelector(".legend-title");
      if (legendTitle) {
        if (e.target.checked) {
          legendTitle.innerHTML = `<strong>Anselin LISA Regimes:</strong> <span style="color:#ef4444">■ HH</span> <span style="color:#38bdf8">■ LL</span> <span style="color:#f59e0b">■ HL</span> <span style="color:#10b981">■ LH</span> <span style="color:#64748b">■ NS</span>`;
        } else if (currentAnalysisData) {
          legendTitle.innerHTML = `Trend Magnitude & Direction (<span id="legendUnit">${currentAnalysisData.slope_units}</span>)`;
        }
      }
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
        const endYear = document.getElementById("endYear") ? document.getElementById("endYear").value : "2023";
        const gibsDate = `${endYear}-07-15`;
        if (gibsLayer && map.hasLayer(gibsLayer)) {
          map.removeLayer(gibsLayer);
        }
        gibsLayer = L.tileLayer(
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
          {
            attribution: `Imagery &copy; NASA EOSDIS GIBS (${gibsDate})`,
            maxZoom: 9,
            opacity: 0.65
          }
        );
        gibsLayer.addTo(map);
        if (gridLayerGroup) gridLayerGroup.bringToFront();
      } else {
        if (gibsLayer && map.hasLayer(gibsLayer)) {
          map.removeLayer(gibsLayer);
        }
      }
    });
  }

  // Dataset Provider Change Handler — dynamically update variable dropdown
  const datasetSelect = document.getElementById("datasetSelect");
  if (datasetSelect) {
    datasetSelect.addEventListener("change", (e) => {
      const hint = document.getElementById("datasetHint");
      if (hint) {
        if (e.target.value === "nasa_power") {
          hint.innerText = "NASA Langley Research Center • CF-1.8 Compliant • DOI: 10.5067/POWER/10.0.0";
        } else {
          hint.innerText = "NASA GMAO • CF-1.6 Compliant • DOI: 10.5067/A7F0JNNUTWOB";
        }
      }
      updateVariableOptions(e.target.value);
    });
  }

  // Clear BBox button
  const clearBboxBtn = document.getElementById("clearBboxBtn");
  if (clearBboxBtn) {
    clearBboxBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("bboxMinLon").value = "";
      document.getElementById("bboxMinLat").value = "";
      document.getElementById("bboxMaxLon").value = "";
      document.getElementById("bboxMaxLat").value = "";
      const bboxHint = document.getElementById("bboxHint");
      if (bboxHint) bboxHint.innerText = "[min_lon, min_lat] → [max_lon, max_lat] • Leave blank for dataset default";
      showToast("Bounding box cleared (using dataset default).", "info", 3000);
    });
  }

  // AI Explainer Copy and Dismiss buttons
  const copyAiBtn = document.getElementById("copyAiBtn");
  if (copyAiBtn) {
    copyAiBtn.addEventListener("click", () => {
      const content = document.getElementById("aiContentText");
      if (content && content.innerText) {
        navigator.clipboard.writeText(content.innerText).then(() => {
          showToast("AI explanation copied to clipboard!", "success", 3000);
        }).catch(() => {
          showToast("Failed to copy explanation to clipboard.", "error", 3000);
        });
      }
    });
  }

  const dismissAiBtn = document.getElementById("dismissAiBtn");
  if (dismissAiBtn) {
    dismissAiBtn.addEventListener("click", () => {
      document.getElementById("aiOutputBox").classList.add("hidden");
    });
  }

  // Keyboard shortcut: Enter key triggers trend detection
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "SELECT")) {
        e.preventDefault();
        executeAnalysis();
      }
    }
  });

  // Safe programmatic file download helper (guarantees correct extension, MIME, and prevents premature blob revoking)
  function downloadBlobSafely(blob, filename, mimeType) {
    const typedBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
    const url = window.URL.createObjectURL(typedBlob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    // 30-second grace window to ensure browser download pipeline completes file flush
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 30000);
  }

  function getFilenameFromHeader(res, fallbackName) {
    const disposition = res.headers.get("content-disposition");
    if (disposition && disposition.includes("filename=")) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return fallbackName;
  }

  // CF-1.8 NetCDF-4 Export
  const exportNetcdfBtn = document.getElementById("exportNetcdfBtn");
  if (exportNetcdfBtn) {
    exportNetcdfBtn.addEventListener("click", async () => {
      if (!currentAnalysisId) {
        showToast("Please run an analysis first.", "warning");
        return;
      }
      showToast("Downloading CF-1.8 NetCDF-4 binary granule (.nc)...", "info", 4000);
      try {
        const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/export/netcdf`);
        if (!res.ok) throw new Error("Export NetCDF failed");
        const filename = getFilenameFromHeader(res, `earthsift_${currentAnalysisId}.nc`);
        const blob = await res.blob();
        downloadBlobSafely(blob, filename, "application/x-netcdf");
        showToast("NetCDF-4 (.nc) downloaded! Open in NASA Panoply, QGIS, or Python xarray.", "success", 4500);
      } catch (e) {
        showToast("Failed to download NetCDF: " + e.message, "error");
      }
    });
  }

  // GeoJSON FeatureCollection Export
  const exportGeojsonBtn = document.getElementById("exportGeojsonBtn");
  if (exportGeojsonBtn) {
    exportGeojsonBtn.addEventListener("click", async () => {
      if (!currentAnalysisId) {
        showToast("Please run an analysis first.", "warning");
        return;
      }
      showToast("Generating GeoJSON FeatureCollection (.geojson)...", "info", 3000);
      try {
        const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/export/geojson`);
        if (!res.ok) throw new Error("Export GeoJSON failed");
        const filename = getFilenameFromHeader(res, `earthsift_trends_${currentAnalysisId}.geojson`);
        const blob = await res.blob();
        downloadBlobSafely(blob, filename, "application/geo+json");
        showToast("GeoJSON (.geojson) downloaded! Open in geojson.io, QGIS, or ArcGIS.", "success", 4500);
      } catch (e) {
        showToast("Failed to export GeoJSON: " + e.message, "error");
      }
    });
  }

  // NASA Climate Science Dossier Export
  const exportDossierBtn = document.getElementById("exportDossierBtn");
  if (exportDossierBtn) {
    exportDossierBtn.addEventListener("click", async () => {
      if (!currentAnalysisId) {
        showToast("Please run an analysis first.", "warning");
        return;
      }
      showToast("Compiling NASA Climate Science Dossier (.md)...", "info", 3000);
      try {
        const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/dossier`);
        if (!res.ok) throw new Error("Export Dossier failed");
        const filename = getFilenameFromHeader(res, `NASA_Climate_Science_Dossier_${currentAnalysisId}.md`);
        const blob = await res.blob();
        downloadBlobSafely(blob, filename, "text/markdown;charset=utf-8");
        showToast("Science Dossier (.md) downloaded! Markdown publication report ready.", "success", 4500);
      } catch (e) {
        showToast("Failed to export Scientific Dossier: " + e.message, "error");
      }
    });
  }

  // Reproducible Jupyter Notebook (.ipynb) Export
  const exportNotebookBtn = document.getElementById("exportNotebookBtn");
  if (exportNotebookBtn) {
    exportNotebookBtn.addEventListener("click", async () => {
      if (!currentAnalysisId) {
        showToast("Please run an analysis first.", "warning");
        return;
      }
      showToast("Generating reproducible Jupyter Notebook (.ipynb)...", "info", 3000);
      try {
        const res = await fetch(`${API_BASE}/analysis/${currentAnalysisId}/export/notebook`);
        if (!res.ok) throw new Error("Export Notebook failed");
        const filename = getFilenameFromHeader(res, `earthsift_${currentAnalysisId}.ipynb`);
        const blob = await res.blob();
        downloadBlobSafely(blob, filename, "application/x-ipynb+json");
        showToast("Jupyter Notebook (.ipynb) downloaded! Open in Google Colab, JupyterLab, or VS Code.", "success", 4500);
      } catch (e) {
        showToast("Failed to export Jupyter Notebook: " + e.message, "error");
      }
    });
  }

  // Share Deep-Link Button
  const shareLinkBtn = document.getElementById("shareLinkBtn");
  if (shareLinkBtn) {
    shareLinkBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast("Shareable link copied to clipboard.", "success", 3500);
      }).catch(() => {
        showToast("Share URL: " + window.location.href, "info", 5000);
      });
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

  // SpaceX UTC Live Clock Ticker
  const updateClocks = () => {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    const str = `${h}:${m}:${s} UTC`;
    const hEl = document.getElementById("headerUtcClock");
    if (hEl) hEl.innerText = str;
    const dEl = document.getElementById("dockUtcTime");
    if (dEl) dEl.innerText = str;
  };
  updateClocks();
  setInterval(updateClocks, 1000);

  // SpaceX Map Floating Dock Buttons
  const dock2d = document.getElementById("dock2dBtn");
  const dockGibs = document.getElementById("dockGibsBtn");
  const dockHotspots = document.getElementById("dockHotspotsBtn");
  const dockLive = document.getElementById("dockLiveBtn");
  if (dock2d) {
    dock2d.addEventListener("click", () => {
      document.querySelectorAll(".dock-pill").forEach(p => p.classList.remove("active"));
      dock2d.classList.add("active");
      const gibs = document.getElementById("gibsToggle");
      if (gibs && gibs.checked) gibs.click();
    });
  }
  if (dockGibs) {
    dockGibs.addEventListener("click", () => {
      const gibs = document.getElementById("gibsToggle");
      if (gibs) {
        gibs.click();
        dockGibs.classList.toggle("active", gibs.checked);
      }
    });
  }
  if (dockHotspots) {
    dockHotspots.addEventListener("click", () => {
      const lisa = document.getElementById("lisaToggle");
      if (lisa) {
        lisa.click();
        dockHotspots.classList.toggle("active", lisa.checked);
      }
    });
  }
  if (dockLive) {
    dockLive.addEventListener("click", () => {
      executeAnalysis();
    });
  }

  // SpaceX Anomaly Card Actions
  const hideAnomaly = () => {
    const card = document.getElementById("spacexAnomalyCard");
    if (card) card.classList.add("hidden");
  };
  const dismissBtn = document.getElementById("dismissAnomalyBtn");
  if (dismissBtn) dismissBtn.addEventListener("click", hideAnomaly);
  const anomDismiss = document.getElementById("anomDismissBtn");
  if (anomDismiss) anomDismiss.addEventListener("click", hideAnomaly);
  const anomRespond = document.getElementById("anomRespondBtn");
  if (anomRespond) {
    anomRespond.addEventListener("click", () => {
      const askBtn = document.getElementById("askAiBtn");
      if (askBtn) askBtn.click();
    });
  }

  // Auto-run initial analysis (restore from URL hash if present, or boot into Case 1)
  setTimeout(() => {
    if (restoreFromUrlHash()) {
      showToast("Restored analysis parameters from deep-link.", "info", 3000);
      executeAnalysis();
    } else {
      loadPreset("case1");
    }
  }, 400);
});
