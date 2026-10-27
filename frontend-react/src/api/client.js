/**
 * EarthSift API Client
 * Centralized service layer for all FastAPI backend communication.
 */

const API_BASE = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : 'http://localhost:8000/api/v1');

/**
 * Module-level map of active AbortControllers for single-flight keyed requests.
 * Prevents race conditions when user rapidly selects cells or switches presets.
 */
export const activeControllers = new Map();

export function abortFlight(key) {
  const existing = activeControllers.get(key);
  if (existing) {
    try {
      existing.abort();
    } catch {
      // ignore
    }
    activeControllers.delete(key);
  }
}

export function isAbortError(err) {
  if (!err) return false;
  return (
    err.name === 'AbortError' ||
    err.code === 20 ||
    err.message?.toLowerCase().includes('aborted')
  );
}

export async function apiFetch(path, options = {}) {
  const {
    timeoutMs = 25000,
    signal: callerSignal,
    flightKey,
    suppressAbort = true,
    headers = {},
    ...fetchOptions
  } = options;

  let flightController = null;
  if (flightKey) {
    abortFlight(flightKey);
    flightController = new AbortController();
    activeControllers.set(flightKey, flightController);
  }

  const internalController = new AbortController();
  let timedOut = false;
  let timeoutId = null;

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      timedOut = true;
      internalController.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError'));
    }, timeoutMs);
  }

  const forwardAbort = (sig) => {
    if (!sig) return;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    try {
      internalController.abort(sig.reason);
    } catch {
      internalController.abort();
    }
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      forwardAbort(callerSignal);
    } else {
      callerSignal.addEventListener('abort', () => forwardAbort(callerSignal), { once: true });
    }
  }

  if (flightController) {
    if (flightController.signal.aborted) {
      forwardAbort(flightController.signal);
    } else {
      flightController.signal.addEventListener('abort', () => forwardAbort(flightController.signal), { once: true });
    }
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      signal: internalController.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || `API error: ${res.status} ${res.statusText}`);
    }
    return res;
  } catch (err) {
    if (timedOut) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    const isAborted =
      isAbortError(err) ||
      callerSignal?.aborted ||
      flightController?.signal?.aborted ||
      internalController.signal.aborted;

    if (isAborted) {
      if (suppressAbort === true) {
        return Promise.resolve(undefined);
      }
      const abortErr = isAbortError(err)
        ? err
        : new DOMException('The operation was aborted.', 'AbortError');
      throw abortErr;
    }

    throw err;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (flightKey && activeControllers.get(flightKey) === flightController) {
      activeControllers.delete(flightKey);
    }
  }
}

export async function runAnalysis(payload, options = {}) {
  const res = await apiFetch('/analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'analysis',
    ...options,
  });
  if (!res) return undefined;
  return res.json();
}

export async function runCompoundAnalysis(payload, options = {}) {
  const res = await apiFetch('/analysis/compound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'analysis',
    ...options,
  });
  if (!res) return undefined;
  return res.json();
}

export async function runCustomAnalysis(payload, options = {}) {
  const res = await apiFetch('/analysis/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'analysis',
    ...options,
  });
  if (!res) return undefined;
  return res.json();
}

export async function getAttribution(payload, options = {}) {
  const res = await apiFetch('/analysis/attribution', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...options,
  });
  return res.json();
}

export async function getCellTimeseries(analysisId, lat, lon, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/timeseries?lat=${lat}&lon=${lon}`, {
    flightKey: 'cell_timeseries',
    ...options,
  });
  return res.json();
}

export async function getSignals(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/signals`, options);
  return res.json();
}

export async function requestExplanation(payload, options = {}) {
  const res = await apiFetch('/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...options,
  });
  return res.json();
}

export async function getMetrics() {
  const res = await fetch(`${API_BASE.replace('/api/v1', '')}/metrics`);
  return res.json();
}

// Export downloads (return blob)
export async function exportNetCDF(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/export/netcdf`, options);
  const filename = getFilenameFromHeader(res, `earthsift_${analysisId}.nc`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/x-netcdf' };
}

export async function exportGeoJSON(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/export/geojson`, options);
  const filename = getFilenameFromHeader(res, `earthsift_trends_${analysisId}.geojson`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/geo+json' };
}

export async function exportDossier(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/dossier`, options);
  const filename = getFilenameFromHeader(res, `NASA_Climate_Science_Dossier_${analysisId}.md`);
  const blob = await res.blob();
  return { blob, filename, mime: 'text/markdown;charset=utf-8' };
}

export async function exportNotebook(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/export/notebook`, options);
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
export async function getClimateVelocity(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/velocity`, {
    flightKey: 'velocity',
    ...options,
  });
  return res.json();
}

export async function parseNLQ(query, options = {}) {
  const res = await apiFetch('/copilot/parse-query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    ...options,
  });
  return res.json();
}

export async function compareLocations(payload, options = {}) {
  const res = await apiFetch('/analysis/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...options,
  });
  return res.json();
}

export async function exportLatex(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/export/latex`, options);
  const filename = getFilenameFromHeader(res, `NASA_TM_${analysisId}.tex`);
  const blob = await res.blob();
  return { blob, filename, mime: 'application/x-latex' };
}

export async function getColabLink(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/export/colab`, options);
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

// EarthSift 2.0 Scientific Intelligence Client Functions
export async function assessQualityGate(payload, options = {}) {
  const res = await apiFetch('/analysis/quality-gate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'quality-gate',
    ...options,
  });
  return res.json();
}

export async function getRobustnessLab(analysisId, payload = {}, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/robustness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'robustness-lab',
    ...options,
  });
  return res.json();
}

export async function compareRegions(payload, options = {}) {
  const res = await apiFetch('/analysis/compare-regions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'compare-regions',
    ...options,
  });
  return res.json();
}

export async function discoverTrends(payload, options = {}) {
  const res = await apiFetch('/analysis/discover-trends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    flightKey: 'discover-trends',
    ...options,
  });
  return res.json();
}

export async function getDataQualityProfile(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/quality-profile`, {
    flightKey: 'quality-profile',
    ...options,
  });
  return res.json();
}

export async function getReproducibilityManifest(analysisId, options = {}) {
  const res = await apiFetch(`/analysis/${analysisId}/reproducibility`, {
    flightKey: 'reproducibility',
    ...options,
  });
  return res.json();
}


