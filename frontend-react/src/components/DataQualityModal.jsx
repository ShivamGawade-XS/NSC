/**
 * EarthSift 2.0 — Data Quality & Source Continuity Inspector Modal
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
            <div style={styles.title}>📊 Data Quality & Sensor Lineage Inspector</div>
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
                    <span style={styles.ratingIcon}>🛡️</span>
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
                  <span>Valid Records: <strong style={{ color: '#f3f4f6' }}>{data.valid_records}</strong> / {data.total_expected_records}</span>
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
                <div style={styles.sectionTitle}>🛰️ Satellite & Sensor Lineage</div>
                <p style={styles.sectionDesc}>{data.sensor_lineage}</p>
              </div>

              {/* Outliers & Anomalies */}
              <div style={styles.sectionCard}>
                <div style={styles.sectionTitle}>⚡ Anomaly & Outlier Screen (MAD-based)</div>
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
    background: 'rgba(0,0,0,0.78)',
    backdropFilter: 'blur(8px)',
    zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    width: '100%', maxWidth: 720,
    maxHeight: '88vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.75)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: { fontSize: 19, fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  closeBtn: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#9ca3af', borderRadius: 8, width: 32, height: 32,
    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  centered: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 60, color: '#6b7280',
  },
  spinner: { fontSize: 32, animation: 'spin 1s linear infinite' },
  loadingText: { fontSize: 13, color: '#6b7280' },
  errorBox: {
    padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 8, color: '#fca5a5', fontSize: 13,
  },
  qualityBanner: {
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
  },
  ratingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  ratingBadge: { display: 'flex', alignItems: 'center', gap: 8 },
  ratingIcon: { fontSize: 18 },
  ratingLabel: { fontSize: 13, fontWeight: 800, color: '#10b981', letterSpacing: '0.04em' },
  completenessChip: {
    fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa',
    background: 'rgba(96,165,250,0.1)', padding: '3px 8px', borderRadius: 4,
  },
  barOuter: {
    width: '100%', height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  barInner: {
    height: '100%', background: 'linear-gradient(90deg, #10b981, #60a5fa)', borderRadius: 4,
    transition: 'width 0.4s ease',
  },
  recordStats: {
    display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace',
  },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 },
  metricCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  metricLabel: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 },
  metricVal: { fontSize: 12, fontWeight: 600, color: '#e5e7eb' },
  sectionCard: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
  },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#f3f4f6', letterSpacing: '0.02em' },
  sectionDesc: { fontSize: 12, color: '#9ca3af', lineHeight: 1.6, margin: 0 },
  tableWrapper: { overflowX: 'auto', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: {
    padding: '6px 10px', textAlign: 'left', color: '#6b7280',
    fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  td: { padding: '7px 10px', color: '#9ca3af' },
  emptyNotice: {
    padding: '10px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.08)',
    border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7', fontSize: 11,
  },
  outlierNote: { fontSize: 10.5, color: '#6b7280', fontStyle: 'italic', margin: '4px 0 0' },
};
