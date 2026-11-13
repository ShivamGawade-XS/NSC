/**
 * Tellura 2.0 — Trend Robustness Lab Modal
 * Quantifies sensitivity of climate trends to analytical choices:
 * window perturbation, estimator comparison, autocorrelation sensitivity,
 * and jackknife stability.
 */
import { useState, useEffect } from 'react';
import { getRobustnessLab } from '../api/client';
import { playTactileClick } from '../utils/audio';

const STABILITY_CONFIG = {
  ROBUST: {
    textColor: 'text-emerald-800 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/25',
    borderColor: 'border-emerald-200 dark:border-emerald-700/40',
    label: 'ROBUST',
  },
  MODERATELY_SENSITIVE: {
    textColor: 'text-amber-800 dark:text-amber-300',
    bgColor: 'bg-amber-50 dark:bg-amber-950/25',
    borderColor: 'border-amber-200 dark:border-amber-700/40',
    label: 'MODERATELY SENSITIVE',
  },
  HIGHLY_SENSITIVE: {
    textColor: 'text-red-800 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-950/25',
    borderColor: 'border-red-200 dark:border-red-700/40',
    label: 'HIGHLY SENSITIVE',
  },
  INSUFFICIENT_DATA: {
    textColor: 'text-[var(--color-text-muted)]',
    bgColor: 'bg-[var(--color-bg-elevated)]',
    borderColor: 'border-[var(--color-border-subtle)]',
    label: 'INSUFFICIENT DATA',
  },
};

function MiniBarChart({ value, max = 100, barColorClass = 'bg-emerald-500' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border-subtle)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-[var(--color-text-secondary)] min-w-[32px] text-right tabular-nums">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function WindowTable({ windows }) {
  if (!windows?.length) return null;
  return (
    <div className="overflow-x-auto rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <table className="w-full border-collapse text-xs font-mono">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            {['Window', 'Years', 'Slope', 'p-val', 'Sign.', 'Dir'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {windows.map((w, i) => (
            <tr key={i} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
              <td className="px-3 py-2 text-[var(--color-text-main)] max-w-[140px] truncate">{w.window}</td>
              <td className="px-3 py-2 text-[var(--color-text-secondary)] tabular-nums">{w.n_years}</td>
              <td className={`px-3 py-2 font-semibold tabular-nums ${w.slope > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {w.slope > 0 ? '+' : ''}{w.slope}
              </td>
              <td className={`px-3 py-2 tabular-nums ${w.p_value < 0.05 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                {w.p_value.toFixed(3)}
              </td>
              <td className="px-3 py-2">
                {w.significant ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓</span>
                ) : (
                  <span className="text-red-400 font-bold">✗</span>
                )}
              </td>
              <td className={`px-3 py-2 text-[10px] ${w.direction === 'increasing' ? 'text-red-400' : 'text-blue-400'}`}>
                {w.direction === 'increasing' ? '▲' : '▼'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EstimatorTable({ estimators }) {
  if (!estimators?.length) return null;
  return (
    <div className="overflow-x-auto rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
      <table className="w-full border-collapse text-xs font-mono">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
            {['Estimator', 'Slope', 'SE', 'p-val'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {estimators.map((e, i) => (
            <tr key={i} className={`hover:bg-[var(--color-bg-elevated)] transition-colors ${i === 0 ? 'bg-emerald-50 dark:bg-emerald-500/5' : ''}`}>
              <td className="px-3 py-2 text-[var(--color-text-main)] max-w-[180px]">
                {i === 0 && <span className="mr-1.5 text-emerald-600 dark:text-emerald-400 font-bold">★</span>}
                {e.estimator}
              </td>
              <td className={`px-3 py-2 font-semibold tabular-nums ${(e.slope || 0) > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {(e.slope || 0) > 0 ? '+' : ''}{(e.slope || 0).toFixed(4)}
              </td>
              <td className="px-3 py-2 text-[var(--color-text-muted)] tabular-nums">
                {e.se != null ? `±${e.se.toFixed(4)}` : '—'}
              </td>
              <td className={`px-3 py-2 tabular-nums ${(e.p_value || 1) < 0.05 ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                {e.p_value != null ? e.p_value.toFixed(3) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RobustnessLabModal({ analysisId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('window');

  useEffect(() => {
    if (!analysisId) return;
    let isCancelled = false;
    getRobustnessLab(analysisId, {})
      .then((res) => {
        if (!isCancelled) setData(res);
      })
      .catch((e) => {
        if (!isCancelled) setError(e.message || 'Failed to load robustness report');
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

  const stab = data ? (STABILITY_CONFIG[data.stability_rating] || STABILITY_CONFIG.MODERATELY_SENSITIVE) : null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Trend Robustness Lab"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[var(--color-text-main)] shadow-2xl animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight text-[var(--color-text-main)]">
              Trend Robustness Lab
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
              Quantitative sensitivity audit of analytical choices and model assumptions
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
              <span>Running sensitivity audit across sliding windows and estimators…</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded bg-red-950/20 border border-red-500/40 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}

          {data && stab && (
            <>
              {/* Stability Banner */}
              <div className={`p-4 rounded-lg border ${stab.bgColor} ${stab.borderColor} space-y-1.5`}>
                <div className={`font-mono text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${stab.textColor}`}>
                  <span>●</span>
                  <span>{stab.label}</span>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {data.summary_narrative}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Sign Agreement
                  </span>
                  <MiniBarChart value={data.sign_agreement_pct} barColorClass="bg-emerald-500" />
                </div>
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Sig. Retention
                  </span>
                  <MiniBarChart value={data.significance_retention_pct} barColorClass="bg-[var(--color-accent-blue)]" />
                </div>
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Base Slope
                  </span>
                  <span className={`text-sm font-mono font-bold tabular-nums ${data.base_slope > 0 ? 'text-red-400' : 'text-blue-400'}`}>
                    {data.base_slope > 0 ? '+' : ''}{data.base_slope}
                  </span>
                </div>
                <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-mono font-bold text-[var(--color-text-muted)] block">
                    Jackknife SE
                  </span>
                  <span className="text-sm font-mono font-semibold text-[var(--color-text-secondary)] tabular-nums">
                    ±{data.jackknife_slope_se}
                  </span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-[var(--color-border-subtle)] pt-1">
                {[
                  { id: 'window', label: 'Window Sensitivity' },
                  { id: 'estimator', label: 'Slope Estimators' },
                  { id: 'autocorr', label: 'Autocorrelation' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      playTactileClick(600);
                      setTab(t.id);
                    }}
                    className={`px-3.5 py-2 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                      tab === t.id
                        ? 'border-[var(--color-accent-blue)] text-[var(--color-accent-blue)] bg-[var(--color-bg-elevated)] rounded-t'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              {tab === 'window' && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs text-[var(--color-text-muted)] font-mono leading-relaxed">
                    Each row trims the analysis window or splits into half-regimes, then re-evaluates the Mann-Kendall + Theil-Sen estimator independently.
                  </p>
                  <WindowTable windows={data.window_sensitivity} />
                </div>
              )}

              {tab === 'estimator' && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs text-[var(--color-text-muted)] font-mono leading-relaxed">
                    Comparison of three slope estimators on the same data. ★ Theil-Sen is the project default (29% breakdown point).
                  </p>
                  <EstimatorTable estimators={data.estimator_comparison} />
                </div>
              )}

              {tab === 'autocorr' && data.autocorrelation_sensitivity && (
                <div className="space-y-2.5 pt-1">
                  <p className="text-xs text-[var(--color-text-muted)] font-mono leading-relaxed">
                    Impact of applying Hamed & Rao (1998) serial autocorrelation correction to the Mann-Kendall variance estimate.
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'Lag-1 Autocorrelation', val: data.autocorrelation_sensitivity.lag1_autocorrelation, mono: true },
                      { label: 'Variance Inflation Factor', val: `${data.autocorrelation_sensitivity.variance_inflation_factor}×`, mono: true },
                      { label: 'i.i.d. p-value', val: data.autocorrelation_sensitivity.iid_p_value?.toFixed(4), mono: true },
                      { label: 'Corrected p-value', val: data.autocorrelation_sensitivity.autocorrelation_corrected_p_value?.toFixed(4), mono: true },
                      {
                        label: 'Significance Shifted?',
                        val: data.autocorrelation_sensitivity.significance_shifted_by_autocorrelation ? 'YES — correction changed conclusion' : 'No — robust to autocorr.',
                        colorClass: data.autocorrelation_sensitivity.significance_shifted_by_autocorrelation ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400',
                      },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between items-center bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg px-3.5 py-2.5 text-xs">
                        <span className="text-[var(--color-text-secondary)] font-mono">{row.label}</span>
                        <span className={`font-semibold tabular-nums ${row.colorClass || 'text-[var(--color-text-main)]'} ${row.mono ? 'font-mono' : ''}`}>
                          {String(row.val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
