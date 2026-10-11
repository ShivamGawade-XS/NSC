/**
 * EarthSift API Client
 * Centralized service layer for all FastAPI backend communication.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `API error: ${res.status} ${res.statusText}`);
  }
  return res;
}

export async function runAnalysis(payload) {
  const res = await apiFetch('/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function runCompoundAnalysis(payload) {
  const res = await apiFetch('/analysis/compound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getCellTimeseries(analysisId, lat, lon) {
  const res = await apiFetch(`/analysis/${analysisId}/timeseries?lat=${lat}&lon=${lon}`);
  return res.json();
}

export async function getSignals(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/signals`);
  return res.json();
}

export async function requestExplanation(payload) {
  const res = await apiFetch('/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function getMetrics() {
  const res = await fetch(`${API_BASE.replace('/api/v1', '')}/metrics`);
  return res.json();
}

// Export downloads (return blob)
export async function exportNetCDF(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/export/netcdf`);
  const filename = getFilenameFromHeader(res, `earthsift_${analysisId}.nc`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/x-netcdf' };
}

export async function exportGeoJSON(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/export/geojson`);
  const filename = getFilenameFromHeader(res, `earthsift_trends_${analysisId}.geojson`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/geo+json' };
}

export async function exportDossier(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/dossier`);
  const filename = getFilenameFromHeader(res, `NASA_Climate_Science_Dossier_${analysisId}.md`);
  const blob = await res.blob();
  return { blob, filename, mime: 'text/markdown;charset=utf-8' };
}

export async function exportNotebook(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/export/notebook`);
  const filename = getFilenameFromHeader(res, `earthsift_${analysisId}.ipynb`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/x-ipynb+json' };
}

function getFilenameFromHeader(res, fallback) {
  const disposition = res.headers.get('content-disposition');
  if (disposition?.includes('filename=')) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
    if (match?.[1]) return match[1].trim();
  }
  return fallback;
}

// Omni-Scale Championship Endpoints
export async function getClimateVelocity(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/velocity`);
  return res.json();
}

export async function parseNLQ(query) {
  const res = await apiFetch('/copilot/parse-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

export async function compareLocations(payload) {
  const res = await apiFetch('/analysis/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function exportLatex(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/export/latex`);
  const filename = getFilenameFromHeader(res, `NASA_TM_${analysisId}.tex`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/x-latex' };
}

export async function getColabLink(analysisId) {
  const res = await apiFetch(`/analysis/${analysisId}/export/colab`);
  return res.json();
}

export function downloadBlob(blob, filename, mimeType) {
  const typedBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
  const url = URL.createObjectURL(typedBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.parentNode?.removeChild(a);
  }, 30000);
}

