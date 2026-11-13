/**
 * Tellura 2.0 — Earth System Trend Discovery Modal
 * Autonomous exploratory multi-variable scan across Earth system domains.
 * Identifies high-velocity warming, extreme hydrologic shifts, and radiation trends
 * under rigorous Benjamini-Hochberg FDR multiplicity control.
 */
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { discoverTrends } from '../api/client';
import useStore from '../store/useStore';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

const DISCOVERY_REGIONS = [
  { name: 'Northern High Latitudes (Arctic)', bbox: [-170, 60, -60, 75] },
  { name: 'Mediterranean & North Africa', bbox: [-10, 25, 40, 45] },
  { name: 'Amazon Basin & Tropical South America', bbox: [-80, -20, -40, 5] },
  { name: 'South & East Asia Monsoon Zone', bbox: [70, 10, 125, 35] },
];

export default function DiscoveryModal({ onClose }) {
  const currentDataset = useStore((s) => s.dataset) || 'nasa_power';
  const currentEnd = useStore((s) => s.endYear) || 2023;
  const currentStart = useStore((s) => s.startYear) || Math.max(1980, currentEnd - 20);
  const storeBbox = useStore((s) => s.bbox);

  const defaultBboxStr = (storeBbox?.minLon !== '' && storeBbox?.maxLat !== '')
    ? `${storeBbox.minLon}, ${storeBbox.minLat}, ${storeBbox.maxLon}, ${storeBbox.maxLat}`
    : '-170, 60, -60, 75';

  const [dataset, setDataset] = useState(currentDataset);
  const [startYear, setStartYear] = useState(Math.max(currentStart, currentEnd - 20));
  const [endYear, setEndYear] = useState(currentEnd);
  const [bboxStr, setBboxStr] = useState(defaultBboxStr);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const parseBbox = (str) => {
    const parts = str.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    return parts;
  };

  const handleRunScan = async (e) => {
    e?.preventDefault();
    playTactileClick(850);
    const parsed = parseBbox(bboxStr);
    if (!parsed) {
      setError('Please provide 4 valid bounding coordinates: minLon, minLat, maxLon, maxLat');
      return;
    }

    const sYear = parseInt(startYear, 10);
    const eYear = parseInt(endYear, 10);
    if (eYear - sYear > 20) {
      setError('Autonomous exploratory scan is capped at 20 continuous observation years. Please adjust temporal window.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        dataset_id: dataset,
        bbox: parsed,
        start_year: sYear,
        end_year: eYear,
        variable_ids: dataset === 'merra2_reanalysis' ? ['T2M', 'PRECTOT'] : ['T2M', 'PRECTOTCORR'],
        alpha: 0.05,
      };
      const data = await discoverTrends(payload);
      setResults(data);
      if (data.ranked_candidates?.length === 0) {
        toast('No trends met the FDR threshold in this region.');
      } else {
        toast.success(`Discovered ${data.ranked_candidates?.length} significant trend candidates!`);
        playTelemetryChime();
      }
    } catch (err) {
      setError(err.message || 'Discovery scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = async (candidate) => {
    playTactileClick(800);
    useStore.setState({
      dataset,
      variable: candidate.variable_id,
      startYear: parseInt(startYear, 10),
      endYear: parseInt(endYear, 10),
    });
    toast.success(`Switched workspace to ${candidate.variable_name}`);
    onClose?.();
    useStore.getState().executeAnalysis({
      targetLat: candidate.lat,
      targetLon: candidate.lon,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Earth System Trend Discovery"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-[var(--color-text-main)] shadow-2xl animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight text-[var(--color-text-main)]">
              Autonomous Earth System Trend Discovery
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
              Multi-variable exploratory scan across physical domains under Benjamini-Hochberg FDR control
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              onClose?.();
            }}
            className="w-7 h-7 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] flex items-center justify-center text-xs font-mono transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Preset Transect Ribbon */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)]">
              Region Transects:
            </span>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_REGIONS.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    playTactileClick(700);
                    setBboxStr(r.bbox.join(', '));
                  }}
                  className="preset-pill font-mono text-[11px]"
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRunScan} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="discovery-dataset-select" className="form-label block mb-1">Dataset</label>
                <select
                  id="discovery-dataset-select"
                  name="discoveryDataset"
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] focus:border-[var(--color-accent-blue)] focus:outline-none"
                >
                  <option value="nasa_power">NASA POWER (0.5° Grid)</option>
                  <option value="merra2_reanalysis">MERRA-2 Reanalysis</option>
                </select>
              </div>
              <div>
                <label htmlFor="discovery-start-year-input" className="form-label block mb-1">Start Year</label>
                <input
                  id="discovery-start-year-input"
                  name="discoveryStartYear"
                  type="number"
                  value={startYear}
                  min={1981}
                  max={2026}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="discovery-end-year-input" className="form-label block mb-1">End Year</label>
                <input
                  id="discovery-end-year-input"
                  name="discoveryEndYear"
                  type="number"
                  value={endYear}
                  min={1981}
                  max={2026}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="discovery-bbox-input" className="form-label block mb-1">
                Scan Bounding Box (minLon, minLat, maxLon, maxLat)
              </label>
              <input
                id="discovery-bbox-input"
                name="discoveryBbox"
                type="text"
                value={bboxStr}
                onChange={(e) => setBboxStr(e.target.value)}
                className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none placeholder:text-[var(--color-text-muted)]"
                placeholder="-170, 60, -60, 75"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full interface-btn-primary !py-2.5 !text-xs !tracking-wider uppercase font-semibold justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="loading-spinner !w-3.5 !h-3.5 !border-2" />
                  <span>Scanning Earth System Variables…</span>
                </span>
              ) : (
                'Launch Autonomous Multi-Variable Scan'
              )}
            </button>
          </form>

          {error && (
            <div className="p-3 rounded bg-red-950/20 border border-red-500/40 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Results list */}
          {results && (
            <div className="space-y-3.5 pt-2 border-t border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-['Space_Grotesk'] text-xs font-bold text-[var(--color-text-main)]">
                    Scan Multiplicity Telemetry:
                  </span>
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {results.fdr_discovery_count} Significant Signals Discovered from {results.total_tests_conducted} Hypothesis Tests
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  FDR q ≤ 0.05
                </span>
              </div>

              {results.ranked_candidates?.length > 0 ? (
                <div className="space-y-3">
                  {results.ranked_candidates.map((c, idx) => (
                    <div
                      key={idx}
                      className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-blue)]/50 rounded-lg p-3.5 space-y-2.5 transition-colors"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-accent-blue-subtle)] text-[var(--color-accent-blue)]">
                            #{idx + 1}
                          </span>
                          <span className="font-['Space_Grotesk'] text-sm font-bold text-[var(--color-text-main)]">
                            {c.variable_name}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)] font-mono">
                            • {c.physical_domain}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                          {c.discovery_badge}
                        </span>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[var(--color-bg-surface)] p-2.5 rounded border border-[var(--color-border-subtle)] font-mono">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">
                            Decadal Slope
                          </span>
                          <span className={`text-xs font-semibold tabular-nums ${c.slope > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            {c.slope > 0 ? '+' : ''}{c.slope.toFixed(4)} {c.slope_units}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">
                            FDR q-value
                          </span>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {c.q_value != null ? c.q_value.toFixed(4) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">
                            Kendall τ
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-text-main)] tabular-nums">
                            {c.tau?.toFixed(3) ?? '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">
                            Coordinates
                          </span>
                          <span className="text-xs font-semibold text-[var(--color-text-main)] tabular-nums">
                            {c.lat?.toFixed(1)}°, {c.lon?.toFixed(1)}°
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">
                            Discovery Score
                          </span>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                            {c.discovery_score?.toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {c.ranking_rationale}
                      </p>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectCandidate(c)}
                          className="interface-btn-secondary !text-xs !py-1.5 !px-3 font-mono text-[var(--color-accent-blue)] hover:border-[var(--color-accent-blue)]"
                        >
                          Load Variable & Inspect Coordinate in Workspace →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-subtle)] font-mono">
                  No candidates passed the multi-testing FDR threshold at α=0.05 for this spatiotemporal window.
                </div>
              )}

              {results.methodology_disclaimer && (
                <p className="text-[10px] text-[var(--color-text-muted)] font-mono italic leading-relaxed pt-1">
                  {results.methodology_disclaimer}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
