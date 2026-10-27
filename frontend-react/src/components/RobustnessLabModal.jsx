/**
 * EarthSift 2.0 — Trend Robustness Lab Modal
 * Feature A: Quantifies sensitivity of climate trends to analytical choices.
 * Shows window perturbation, estimator comparison, autocorrelation sensitivity,
 * and jackknife stability.
 */
import { useState, useEffect } from 'react';
import { getRobustnessLab } from '../api/client';

const STABILITY_CONFIG = {
  ROBUST: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'ROBUST', icon: '🛡' },
  MODERATELY_SENSITIVE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'MODERATELY SENSITIVE', icon: '⚡' },
  HIGHLY_SENSITIVE: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'HIGHLY SENSITIVE', icon: '⚠' },
  INSUFFICIENT_DATA: { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'INSUFFICIENT DATA', icon: '?' },
};

function MiniBarChart({ value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, color: '#d1d5db', fontFamily: 'monospace', minWidth: 36 }}>{value.toFixed(1)}%</span>
    </div>
  );
}

function WindowTable({ windows }) {
  if (!windows?.length) return null;
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Window', 'Years', 'Slope', 'p-val', 'Sign.', 'Dir'].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {windows.map((w, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
              <td style={{ ...styles.td, color: '#e5e7eb', maxWidth: 140, whiteSpace: 'normal', lineHeight: 1.3 }}>{w.window}</td>
              <td style={styles.td}>{w.n_years}</td>
              <td style={{ ...styles.td, color: w.slope > 0 ? '#f87171' : '#60a5fa', fontFamily: 'monospace' }}>
                {w.slope > 0 ? '+' : ''}{w.slope}
              </td>
              <td style={{ ...styles.td, color: w.p_value < 0.05 ? '#10b981' : '#9ca3af', fontFamily: 'monospace' }}>
                {w.p_value.toFixed(3)}
              </td>
              <td style={styles.td}>{w.significant ? <span style={{ color: '#10b981' }}>✓</span> : <span style={{ color: '#ef4444' }}>✗</span>}</td>
              <td style={{ ...styles.td, color: w.direction === 'increasing' ? '#f87171' : '#60a5fa', fontSize: 10 }}>
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
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {['Estimator', 'Slope', 'SE', 'p-val'].map((h) => <th key={h} style={styles.th}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {estimators.map((e, i) => (
            <tr key={i} style={{ background: i === 0 ? 'rgba(16,185,129,0.06)' : i % 2 === 1 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
              <td style={{ ...styles.td, color: '#e5e7eb', maxWidth: 180, whiteSpace: 'normal', lineHeight: 1.3, fontSize: 10 }}>
                {i === 0 && <span style={{ marginRight: 4, color: '#10b981' }}>★</span>}
                {e.estimator}
              </td>
              <td style={{ ...styles.td, color: (e.slope || 0) > 0 ? '#f87171' : '#60a5fa', fontFamily: 'monospace' }}>
                {(e.slope || 0) > 0 ? '+' : ''}{(e.slope || 0).toFixed(4)}
              </td>
              <td style={{ ...styles.td, fontFamily: 'monospace', color: '#9ca3af' }}>
                {e.se != null ? `±${e.se.toFixed(4)}` : '—'}
              </td>
              <td style={{ ...styles.td, color: (e.p_value || 1) < 0.05 ? '#10b981' : '#9ca3af', fontFamily: 'monospace' }}>
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

  // Keyboard close
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const stab = data ? (STABILITY_CONFIG[data.stability_rating] || STABILITY_CONFIG.MODERATELY_SENSITIVE) : null;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Trend Robustness Lab">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>🔬 Trend Robustness Lab</div>
            <div style={styles.subtitle}>Sensitivity audit of analytical choices</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">✕</button>
        </div>

        {loading && (
          <div style={styles.centered}>
            <div style={styles.spinnerLg}>⟳</div>
            <div style={styles.loadingText}>Running sensitivity audit…</div>
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {data && stab && (
          <>
            {/* Stability Banner */}
            <div style={{ ...styles.stabilityBanner, background: stab.bg, border: `1px solid ${stab.color}44` }}>
              <span style={styles.stabilityIcon}>{stab.icon}</span>
              <div style={styles.stabilityContent}>
                <div style={{ ...styles.stabilityRating, color: stab.color }}>{stab.label}</div>
                <div style={styles.summaryText}>{data.summary_narrative}</div>
              </div>
            </div>

            {/* KPI Row */}
            <div style={styles.kpiRow}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Sign Agreement</div>
                <MiniBarChart value={data.sign_agreement_pct} color="#10b981" />
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Sig. Retention</div>
                <MiniBarChart value={data.significance_retention_pct} color="#60a5fa" />
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Base Slope</div>
                <span style={{ fontSize: 13, fontFamily: 'monospace', color: data.base_slope > 0 ? '#f87171' : '#60a5fa', fontWeight: 700 }}>
                  {data.base_slope > 0 ? '+' : ''}{data.base_slope}
                </span>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Jackknife SE</div>
                <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#d1d5db' }}>±{data.jackknife_slope_se}</span>
              </div>
            </div>

            {/* Tab Bar */}
            <div style={styles.tabBar}>
              {[
                { id: 'window', label: '📅 Window' },
                { id: 'estimator', label: '📐 Estimators' },
                { id: 'autocorr', label: '🔗 Autocorr.' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {tab === 'window' && (
              <div style={styles.tabContent}>
                <p style={styles.tabDesc}>
                  Each row trims the analysis window or splits into half-regimes, then re-evaluates the Mann-Kendall + Theil-Sen estimator independently.
                </p>
                <WindowTable windows={data.window_sensitivity} />
              </div>
            )}

            {tab === 'estimator' && (
              <div style={styles.tabContent}>
                <p style={styles.tabDesc}>
                  Comparison of three slope estimators on the same data. ★ Theil-Sen is the project default (29% breakdown point).
                </p>
                <EstimatorTable estimators={data.estimator_comparison} />
              </div>
            )}

            {tab === 'autocorr' && data.autocorrelation_sensitivity && (
              <div style={styles.tabContent}>
                <p style={styles.tabDesc}>
                  Impact of applying Hamed & Rao (1998) serial autocorrelation correction to the Mann-Kendall variance estimate.
                </p>
                <div style={styles.acGrid}>
                  {[
                    { label: 'Lag-1 Autocorrelation', val: data.autocorrelation_sensitivity.lag1_autocorrelation, mono: true },
                    { label: 'Variance Inflation Factor', val: `${data.autocorrelation_sensitivity.variance_inflation_factor}×`, mono: true },
                    { label: 'i.i.d. p-value', val: data.autocorrelation_sensitivity.iid_p_value?.toFixed(4), mono: true },
                    { label: 'Corrected p-value', val: data.autocorrelation_sensitivity.autocorrelation_corrected_p_value?.toFixed(4), mono: true },
                    {
                      label: 'Significance Shifted?',
                      val: data.autocorrelation_sensitivity.significance_shifted_by_autocorrelation ? 'YES — correction changed conclusion' : 'No — robust to autocorr.',
                      color: data.autocorrelation_sensitivity.significance_shifted_by_autocorrelation ? '#f59e0b' : '#10b981',
                    },
                  ].map((row, i) => (
                    <div key={i} style={styles.acRow}>
                      <span style={styles.acLabel}>{row.label}</span>
                      <span style={{ ...styles.acVal, fontFamily: row.mono ? 'monospace' : 'inherit', color: row.color || '#d1d5db' }}>
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
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    width: '100%', maxWidth: 680,
    maxHeight: '88vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column', gap: 0,
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: { fontSize: 20, fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  closeBtn: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#9ca3af', borderRadius: 8, width: 32, height: 32,
    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  centered: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 60, color: '#6b7280',
  },
  spinnerLg: { fontSize: 32, animation: 'spin 1s linear infinite' },
  loadingText: { fontSize: 13, color: '#6b7280' },
  errorBox: {
    margin: '16px 24px', padding: '12px 16px',
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 8, color: '#fca5a5', fontSize: 13,
  },
  stabilityBanner: {
    margin: '16px 24px',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex', gap: 12, alignItems: 'flex-start',
  },
  stabilityIcon: { fontSize: 24, flexShrink: 0, lineHeight: 1 },
  stabilityContent: { display: 'flex', flexDirection: 'column', gap: 4 },
  stabilityRating: { fontSize: 13, fontWeight: 800, letterSpacing: '0.06em' },
  summaryText: { fontSize: 12, color: '#d1d5db', lineHeight: 1.6 },
  kpiRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8,
    padding: '0 24px', marginBottom: 4,
  },
  kpiCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  kpiLabel: { fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' },
  tabBar: {
    display: 'flex', gap: 2, padding: '8px 24px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  tabBtn: {
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: '#6b7280', cursor: 'pointer', transition: 'all 0.15s', borderRadius: '6px 6px 0 0',
  },
  tabBtnActive: {
    color: '#60a5fa', borderBottomColor: '#60a5fa', background: 'rgba(96,165,250,0.06)',
  },
  tabContent: { padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 },
  tabDesc: { fontSize: 11, color: '#9ca3af', lineHeight: 1.6, margin: 0 },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: {
    padding: '6px 10px', textAlign: 'left',
    color: '#6b7280', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  td: { padding: '7px 10px', color: '#9ca3af', verticalAlign: 'middle' },
  acGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  acRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  acLabel: { fontSize: 12, color: '#9ca3af' },
  acVal: { fontSize: 12, fontWeight: 600 },
};
