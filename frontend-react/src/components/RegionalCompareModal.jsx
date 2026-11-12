/**
 * Tellura 2.0 — Side-by-Side Regional Trend Detective Modal
 * Compares climate trend trajectories across two geographic regions
 * with formal two-sample hypothesis testing for trend divergence.
 */
import { useState, useEffect } from 'react';
import { compareRegions } from '../api/client';
import useStore from '../store/useStore';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

const REGION_PRESETS = [
  {
    name: 'Arctic Amplification vs Tropics',
    dataset: 'nasa_power',
    variable: 'T2M',
    startYear: 2000,
    endYear: 2023,
    regionA: { name: 'Western Arctic', bbox: [-170, 60, -120, 75] },
    regionB: { name: 'Tropical Pacific', bbox: [-170, -10, -120, 10] },
  },
  {
    name: 'Sahel vs Mediterranean Basin',
    dataset: 'nasa_power',
    variable: 'T2M',
    startYear: 2000,
    endYear: 2023,
    regionA: { name: 'Sahel Transition Zone', bbox: [-10, 10, 30, 18] },
    regionB: { name: 'Mediterranean Basin', bbox: [-5, 35, 30, 45] },
  },
  {
    name: 'Amazon Rainforest vs Cerrado',
    dataset: 'nasa_power',
    variable: 'T2M',
    startYear: 2000,
    endYear: 2023,
    regionA: { name: 'Amazon Core', bbox: [-70, -10, -55, 0] },
    regionB: { name: 'Cerrado Savannah', bbox: [-50, -18, -40, -10] },
  },
];

export default function RegionalCompareModal({ onClose }) {
  const currentDataset = useStore((s) => s.dataset) || 'nasa_power';
  const currentVar = useStore((s) => s.variable) || 'T2M';
  const currentStart = useStore((s) => s.startYear) || 2000;
  const currentEnd = useStore((s) => s.endYear) || 2023;

  const [dataset, setDataset] = useState(currentDataset);
  const [variable, setVariable] = useState(currentVar);
  const [startYear, setStartYear] = useState(currentStart);
  const [endYear, setEndYear] = useState(currentEnd);

  // Region A
  const [nameA, setNameA] = useState('Western Arctic');
  const [bboxA, setBboxA] = useState('-170, 60, -120, 75');

  // Region B
  const [nameB, setNameB] = useState('Tropical Pacific');
  const [bboxB, setBboxB] = useState('-170, -10, -120, 10');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

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

  const handleApplyPreset = (p) => {
    playTactileClick(700);
    setDataset(p.dataset);
    setVariable(p.variable);
    setStartYear(p.startYear);
    setEndYear(p.endYear);
    setNameA(p.regionA.name);
    setBboxA(p.regionA.bbox.join(', '));
    setNameB(p.regionB.name);
    setBboxB(p.regionB.bbox.join(', '));
    setError(null);
  };

  const handleRunComparison = async (e) => {
    e?.preventDefault();
    playTactileClick(850);
    const boxA = parseBbox(bboxA);
    const boxB = parseBbox(bboxB);

    if (!boxA) {
      setError('Region A bounding box must have 4 coordinates: minLon, minLat, maxLon, maxLat');
      return;
    }
    if (!boxB) {
      setError('Region B bounding box must have 4 coordinates: minLon, minLat, maxLon, maxLat');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        dataset_id: dataset,
        variable_id: variable,
        start_year: parseInt(startYear, 10),
        end_year: parseInt(endYear, 10),
        region_a: { name: nameA, bbox: boxA },
        region_b: { name: nameB, bbox: boxB },
        alpha: 0.05,
      };
      const res = await compareRegions(payload);
      setResult(res);
      playTelemetryChime();
    } catch (err) {
      setError(err.message || 'Regional comparison test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Regional Climate Trend Detective"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-[var(--color-text-main)] shadow-2xl animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight text-[var(--color-text-main)]">
              Side-by-Side Regional Trend Detective
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
              Hypothesis testing for divergence in trend slope across distinct geographic regimes
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
          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)]">
              Exemplar Transect Pairs:
            </span>
            <div className="flex flex-wrap gap-2">
              {REGION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="preset-pill font-mono text-[11px]"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRunComparison} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label block mb-1">Dataset ID</label>
                <select
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] focus:border-[var(--color-accent-blue)] focus:outline-none"
                >
                  <option value="nasa_power">NASA POWER (0.5° Grid)</option>
                  <option value="merra2_reanalysis">MERRA-2 Reanalysis</option>
                  <option value="gibs_modis_temperature">GIBS MODIS L3</option>
                </select>
              </div>
              <div>
                <label className="form-label block mb-1">Variable ID</label>
                <input
                  type="text"
                  value={variable}
                  onChange={(e) => setVariable(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
                  placeholder="T2M"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label block mb-1">Start Year</label>
                <input
                  type="number"
                  value={startYear}
                  min={1981}
                  max={2026}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
                />
              </div>
              <div>
                <label className="form-label block mb-1">End Year</label>
                <input
                  type="number"
                  value={endYear}
                  min={1981}
                  max={2026}
                  onChange={(e) => setEndYear(e.target.value)}
                  className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
                />
              </div>
            </div>

            {/* Region A & B Side-by-Side Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3.5 space-y-2.5">
                <div className="font-mono text-xs font-bold text-[var(--color-accent-blue)] flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                  <span>Region A</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase">Reference</span>
                </div>
                <div>
                  <label className="form-label block mb-1">Label</label>
                  <input
                    type="text"
                    value={nameA}
                    onChange={(e) => setNameA(e.target.value)}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1 text-xs text-[var(--color-text-main)] focus:border-[var(--color-accent-blue)] focus:outline-none"
                    placeholder="Region A Name"
                  />
                </div>
                <div>
                  <label className="form-label block mb-1">Bounding Box (minLon, minLat, maxLon, maxLat)</label>
                  <input
                    type="text"
                    value={bboxA}
                    onChange={(e) => setBboxA(e.target.value)}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none placeholder:text-[var(--color-text-muted)]"
                    placeholder="-170, 60, -120, 75"
                  />
                </div>
              </div>

              <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3.5 space-y-2.5">
                <div className="font-mono text-xs font-bold text-amber-400 flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                  <span>Region B</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] uppercase">Comparison</span>
                </div>
                <div>
                  <label className="form-label block mb-1">Label</label>
                  <input
                    type="text"
                    value={nameB}
                    onChange={(e) => setNameB(e.target.value)}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1 text-xs text-[var(--color-text-main)] focus:border-[var(--color-accent-blue)] focus:outline-none"
                    placeholder="Region B Name"
                  />
                </div>
                <div>
                  <label className="form-label block mb-1">Bounding Box (minLon, minLat, maxLon, maxLat)</label>
                  <input
                    type="text"
                    value={bboxB}
                    onChange={(e) => setBboxB(e.target.value)}
                    className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none placeholder:text-[var(--color-text-muted)]"
                    placeholder="-170, -10, -120, 10"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full interface-btn-primary !py-2.5 !text-xs !tracking-wider uppercase font-semibold justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="loading-spinner !w-3.5 !h-3.5 !border-2" />
                  <span>Evaluating Regional Divergence…</span>
                </span>
              ) : (
                'Run Regional Trend Detective'
              )}
            </button>
          </form>

          {error && (
            <div className="p-3 rounded bg-red-950/20 border border-red-500/40 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Results view */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-[var(--color-border-subtle)]">
              {/* Divergence banner */}
              <div
                className={`p-4 rounded-lg border ${
                  result.is_divergence_significant
                    ? 'bg-emerald-950/20 border-emerald-500/35'
                    : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                  <span
                    className={`font-mono text-xs font-bold tracking-wider uppercase ${
                      result.is_divergence_significant ? 'text-emerald-400' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {result.is_divergence_significant
                      ? '✓ Statistically Significant Trend Divergence'
                      : 'Equivalent Trend Regimes (No Divergence)'}
                  </span>
                  <span className="font-mono text-xs text-[var(--color-text-secondary)]">
                    Z = {result.z_statistic != null ? result.z_statistic.toFixed(3) : '—'} (p = {result.p_value != null ? result.p_value.toFixed(4) : '—'})
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-main)] leading-relaxed">
                  {result.divergence_interpretation}
                </p>
              </div>

              {/* Side-by-side cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Card A */}
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] border-t-2 border-t-[var(--color-accent-blue)] rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-['Space_Grotesk'] text-sm font-bold text-[var(--color-accent-blue)]">
                      {result.region_a?.name || 'Region A'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                      {result.region_a?.cell_count ?? 0} cells
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Mean Decadal Slope:</span>
                      <span className={`font-semibold tabular-nums ${(result.region_a?.mean_slope || 0) > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {(result.region_a?.mean_slope || 0) > 0 ? '+' : ''}{(result.region_a?.mean_slope || 0).toFixed(4)} {result.slope_units}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Median Slope:</span>
                      <span className="font-semibold text-[var(--color-text-main)] tabular-nums">
                        {(result.region_a?.median_slope || 0) > 0 ? '+' : ''}{(result.region_a?.median_slope || 0).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Significant Cells (FDR):</span>
                      <span className="font-semibold text-emerald-400 tabular-nums">
                        {((result.region_a?.significant_fraction || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Mean Kendall Tau:</span>
                      <span className="font-semibold text-[var(--color-text-main)] tabular-nums">
                        {result.region_a?.tau_mean?.toFixed(3) ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card B */}
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] border-t-2 border-t-amber-400 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-['Space_Grotesk'] text-sm font-bold text-amber-400">
                      {result.region_b?.name || 'Region B'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)]">
                      {result.region_b?.cell_count ?? 0} cells
                    </span>
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Mean Decadal Slope:</span>
                      <span className={`font-semibold tabular-nums ${(result.region_b?.mean_slope || 0) > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {(result.region_b?.mean_slope || 0) > 0 ? '+' : ''}{(result.region_b?.mean_slope || 0).toFixed(4)} {result.slope_units}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Median Slope:</span>
                      <span className="font-semibold text-[var(--color-text-main)] tabular-nums">
                        {(result.region_b?.median_slope || 0) > 0 ? '+' : ''}{(result.region_b?.median_slope || 0).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Significant Cells (FDR):</span>
                      <span className="font-semibold text-emerald-400 tabular-nums">
                        {((result.region_b?.significant_fraction || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--color-text-muted)]">Mean Kendall Tau:</span>
                      <span className="font-semibold text-[var(--color-text-main)] tabular-nums">
                        {result.region_b?.tau_mean?.toFixed(3) ?? '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slope Difference Callout */}
              <div className="flex items-center justify-between bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg p-3 font-mono">
                <span className="text-xs text-[var(--color-text-secondary)] font-semibold">
                  Slope Difference (A − B):
                </span>
                <span className={`text-sm font-bold tabular-nums ${result.slope_difference > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                  {result.slope_difference > 0 ? '+' : ''}{result.slope_difference?.toFixed(4)} {result.slope_units}
                </span>
              </div>

              {/* Spatial compatibility notes */}
              {result.spatial_compatibility_notes?.length > 0 && (
                <div className="bg-[var(--color-accent-blue-subtle)] border border-[var(--color-accent-blue)]/30 rounded-lg p-3 space-y-1.5 font-mono text-xs">
                  <div className="font-bold text-[var(--color-accent-blue)] text-[11px] uppercase tracking-wider">
                    Spatial Compatibility Audit
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--color-text-secondary)] text-[11px]">
                    {result.spatial_compatibility_notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
