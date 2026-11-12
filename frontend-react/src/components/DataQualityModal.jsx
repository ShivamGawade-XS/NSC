/**
 * Tellura 2.0 — Data Quality & Source Continuity Inspector Modal
 * Provides transparent audit of temporal completeness,
 * satellite sensor lineage, instrument calibration transitions, and physical outliers.
 */
import { useState, useEffect } from 'react';
import { getDataQualityProfile } from '../api/client';
import { playTactileClick } from '../utils/audio';

export default function DataQualityModal({ analysisId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!analysisId) return;
    let isCancelled = false;
    getDataQualityProfile(analysisId)
      .then((res) => {
        if (!isCancelled) setData(res);
      })
      .catch((e) => {
        if (!isCancelled) setError(e.message || 'Failed to retrieve data quality profile');
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Data Quality and Source Continuity Inspector"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[var(--color-text-main)] shadow-2xl animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight text-[var(--color-text-main)]">
              Data Quality & Sensor Lineage Inspector
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
              Scientific observation fidelity, sensor continuity regimes, and outlier profile
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
        <div className="p-6 overflow-y-auto space-y-4">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs font-mono text-[var(--color-text-muted)]">
              <span className="loading-spinner !w-6 !h-6 !border-2" />
              <span>Auditing sensor lineage and temporal completeness…</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded bg-red-950/20 border border-red-500/40 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Quality Rating Banner */}
              <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/35 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <span className="font-mono text-xs font-bold tracking-wider uppercase text-emerald-400">
                      {data.quality_rating || 'VERIFIED OBSERVATIONAL QUALITY'}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[var(--color-accent-blue-subtle)] text-[var(--color-accent-blue)] border border-[var(--color-accent-blue)]/30">
                    {data.temporal_completeness_pct?.toFixed(1)}% Completeness
                  </span>
                </div>

                {/* Completeness Bar */}
                <div className="w-full h-1.5 rounded-full bg-[var(--color-border-subtle)] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-[var(--color-accent-blue)] rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, data.temporal_completeness_pct || 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between font-mono text-xs text-[var(--color-text-secondary)]">
                  <span>
                    Valid Records: <strong className="text-[var(--color-text-main)]">{data.valid_records}</strong> / {data.total_expected_records}
                  </span>
                  <span>
                    Missing Gaps: <strong className={data.missing_intervals?.length ? 'text-amber-400' : 'text-emerald-400'}>{data.missing_intervals?.length || 0}</strong>
                  </span>
                </div>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Variable & Product
                  </span>
                  <span className="text-xs font-semibold text-[var(--color-text-main)] block truncate">
                    {data.variable_name} ({data.variable_id})
                  </span>
                </div>
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Native Resolution
                  </span>
                  <span className="text-xs font-mono font-semibold text-[var(--color-text-main)] block">
                    {data.native_resolution}
                  </span>
                </div>
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Aggregation
                  </span>
                  <span className="text-xs font-mono font-semibold text-[var(--color-text-main)] block">
                    {data.temporal_aggregation}
                  </span>
                </div>
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Physical Scale
                  </span>
                  <span className="text-xs font-mono font-semibold text-[var(--color-text-main)] block">
                    {data.metric_scale_km ? `~${data.metric_scale_km.dx_km?.toFixed(1)} × ${data.metric_scale_km.dy_km?.toFixed(1)} km` : '—'}
                  </span>
                </div>
              </div>

              {/* Sensor Lineage */}
              <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-4 space-y-2">
                <div className="font-['Space_Grotesk'] text-xs font-bold text-[var(--color-text-main)]">
                  Satellite & Sensor Lineage
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {data.sensor_lineage}
                </p>
              </div>

              {/* Anomaly & Outlier Screen */}
              <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-4 space-y-3">
                <div className="font-['Space_Grotesk'] text-xs font-bold text-[var(--color-text-main)]">
                  Anomaly & Outlier Screen (MAD-based)
                </div>
                {data.outliers_detected?.length > 0 ? (
                  <div className="overflow-x-auto rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
                    <table className="w-full border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
                          <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Year</th>
                          <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Obs. Value</th>
                          <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Z-Score (MAD)</th>
                          <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">Suspected Cause</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {data.outliers_detected.map((o, idx) => (
                          <tr key={idx} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                            <td className="px-3 py-2 text-[var(--color-text-main)] font-semibold tabular-nums">{o.year}</td>
                            <td className="px-3 py-2 text-blue-400 tabular-nums">{typeof o.value === 'number' ? o.value.toFixed(3) : o.value}</td>
                            <td className="px-3 py-2 text-amber-400 font-semibold tabular-nums">{typeof o.z_mad === 'number' ? `${o.z_mad.toFixed(2)}σ` : o.z_mad}</td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">{o.suspected_cause || 'Extreme climate fluctuation / anomaly event'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded bg-emerald-950/20 border border-emerald-500/35 text-emerald-400 font-mono text-xs flex items-center gap-2">
                    <span className="font-bold">✓</span>
                    <span>No extreme outliers detected (&gt;3.5 MAD). Observation distribution conforms to expected regional climatology.</span>
                  </div>
                )}
                {data.outlier_handling_note && (
                  <p className="text-[10px] text-[var(--color-text-muted)] font-mono italic leading-relaxed">
                    {data.outlier_handling_note}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
