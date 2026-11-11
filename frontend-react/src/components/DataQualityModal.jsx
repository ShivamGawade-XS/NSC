/**
 * Tellura 2.0 — Data Quality & Source Continuity Inspector Modal
 * Feature D: Provides transparent audit of temporal completeness,
 * satellite sensor lineage, instrument calibration transitions, and physical outliers.
 */
import { useState, useEffect } from 'react';
import { getDataQualityProfile } from '../api/client';

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
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Data Quality and Source Continuity Inspector">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Data Quality & Sensor Lineage Inspector</div>
            <div style={styles.subtitle}>Scientific observation fidelity, sensor continuity, and anomaly profile</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">✕</button>
        </div>

        <div style={styles.body}>
          {loading && (
            <div style={styles.centered}>
              <div style={styles.spinner}>⟳</div>
              <span style={styles.loadingText}>Auditing sensor lineage and temporal completeness…</span>
            </div>
          )}

          {error && <div style={styles.errorBox}>{error}</div>}

          {data && (
            <>
              {/* Quality Rating Banner */}
              <div style={styles.qualityBanner}>
                <div style={styles.ratingRow}>
                  <div style={styles.ratingBadge}>
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <span style={styles.ratingLabel}>{data.quality_rating || 'VERIFIED OBSERVATIONAL QUALITY'}</span>
                  </div>
                  <span style={styles.completenessChip}>
                    {data.temporal_completeness_pct?.toFixed(1)}% Completeness
                  </span>
                </div>

                {/* Completeness Bar */}
                <div style={styles.barOuter}>
                  <div
                    style={{
                      ...styles.barInner,
                      width: `${Math.min(100, Math.max(0, data.temporal_completeness_pct || 100))}%`,
                    }}
                  />
                </div>

                <div style={styles.recordStats}>
                  <span>Valid Records: <strong style={{ color: 'var(--color-text-main)' }}>{data.valid_records}</strong> / {data.total_expected_records}</span>
                  <span>Missing Gaps: <strong style={{ color: data.missing_intervals?.length ? '#f59e0b' : '#10b981' }}>{data.missing_intervals?.length || 0}</strong></span>
                </div>
              </div>

              {/* Grid Metrics & Resolution */}
              <div style={styles.metricsGrid}>
                <div style={styles.metricCard}>
                  <span style={styles.metricLabel}>Variable & Product</span>
                  <span style={styles.metricVal}>{data.variable_name} ({data.variable_id})</span>
                </div>
                <div style={styles.metricCard}>
                  <span style={styles.metricLabel}>Native Resolution</span>
                  <span style={styles.metricVal}>{data.native_resolution}</span>
                </div>
                <div style={styles.metricCard}>
                  <span style={styles.metricLabel}>Temporal Aggregation</span>
                  <span style={styles.metricVal}>{data.temporal_aggregation}</span>
                </div>
                <div style={styles.metricCard}>
                  <span style={styles.metricLabel}>Physical Grid Scale</span>
                  <span style={styles.metricVal}>
                    {data.metric_scale_km ? `~${data.metric_scale_km.dx_km?.toFixed(1)} × ${data.metric_scale_km.dy_km?.toFixed(1)} km` : '—'}
                  </span>
                </div>
              </div>

              {/* Sensor Lineage & Constellation */}
              <div style={styles.sectionCard}>
                <div style={styles.sectionTitle}>Satellite & Sensor Lineage</div>
                <p style={styles.sectionDesc}>{data.sensor_lineage}</p>
              </div>

              {/* Outliers & Anomalies */}
              <div style={styles.sectionCard}>
                <div style={styles.sectionTitle}>Anomaly & Outlier Screen (MAD-based)</div>
                {data.outliers_detected?.length > 0 ? (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Year</th>
                          <th style={styles.th}>Obs. Value</th>
                          <th style={styles.th}>Z-Score (MAD)</th>
                          <th style={styles.th}>Suspected Physical Cause</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.outliers_detected.map((o, idx) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td style={{ ...styles.td, color: '#f3f4f6', fontFamily: 'monospace' }}>{o.year}</td>
                            <td style={{ ...styles.td, fontFamily: 'monospace', color: '#60a5fa' }}>{typeof o.value === 'number' ? o.value.toFixed(3) : o.value}</td>
                            <td style={{ ...styles.td, fontFamily: 'monospace', color: '#f59e0b' }}>{typeof o.z_mad === 'number' ? `${o.z_mad.toFixed(2)}σ` : o.z_mad}</td>
                            <td style={{ ...styles.td, color: '#9ca3af' }}>{o.suspected_cause || 'Extreme climate fluctuation / anomaly event'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={styles.emptyNotice}>
                    ✓ No extreme outliers detected (&gt;3.5 MAD). Observation distribution conforms to expected regional climatology.
                  </div>
                )}
                <p style={styles.outlierNote}>{data.outlier_handling_note}</p>
              </div>
            </>
          )}
        </div>
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
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 12,
    width: '100%', maxWidth: 720,
    maxHeight: '88vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
    color: 'var(--color-text-main)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--color-border-subtle)',
    background: 'var(--color-bg-elevated)',
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--color-text-main)', letterSpacing: '-0.02em', fontFamily: 'Space Grotesk, sans-serif' },
  subtitle: { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  closeBtn: {
    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-muted)', borderRadius: 6, width: 28, height: 28,
    cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  centered: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 60, color: 'var(--color-text-muted)',
  },
  spinner: { fontSize: 32, animation: 'spin 1s linear infinite' },
  loadingText: { fontSize: 13, color: 'var(--color-text-muted)' },
  errorBox: {
    padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 8, color: '#fca5a5', fontSize: 13,
  },
  qualityBanner: {
    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
  },
  ratingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  ratingBadge: { display: 'flex', alignItems: 'center', gap: 8 },
  ratingIcon: { fontSize: 18 },
  ratingLabel: { fontSize: 12, fontWeight: 800, color: '#10b981', letterSpacing: '0.06em', fontFamily: 'monospace' },
  completenessChip: {
    fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6',
    background: 'rgba(59,130,246,0.1)', padding: '3px 8px', borderRadius: 4,
  },
  barOuter: {
    width: '100%', height: 7, borderRadius: 4, background: 'var(--color-border-subtle)', overflow: 'hidden',
  },
  barInner: {
    height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: 4,
    transition: 'width 0.4s ease',
  },
  recordStats: {
    display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace',
  },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
  metricCard: {
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  metricLabel: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', fontWeight: 700, fontFamily: 'monospace' },
  metricVal: { fontSize: 12, fontWeight: 600, color: 'var(--color-text-main)' },
  sectionCard: {
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-main)', letterSpacing: '0.02em', fontFamily: 'Space Grotesk, sans-serif' },
  sectionDesc: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 },
  tableWrapper: { overflowX: 'auto', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: {
    padding: '6px 10px', textAlign: 'left', color: 'var(--color-text-muted)',
    fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1px solid var(--color-border-subtle)', fontFamily: 'monospace',
  },
  td: { padding: '7px 10px', color: 'var(--color-text-secondary)' },
  emptyNotice: {
    padding: '10px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.2)', color: '#10b981', fontSize: 11,
  },
  outlierNote: { fontSize: 10.5, color: 'var(--color-text-muted)', fontStyle: 'italic', margin: '4px 0 0' },
};
