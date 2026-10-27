/**
 * EarthSift 2.0 — Pre-flight Scientific Quality Gate Panel
 * Evaluates analysis parameters before execution:
 * sensor continuity, temporal sample count, spatial grid intersection.
 */
import { useState, useEffect, useCallback } from 'react';
import { assessQualityGate } from '../api/client';

const STATUS_CONFIG = {
  SUPPORTED: {
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    icon: '✓',
    label: 'Optimal',
  },
  SUPPORTED_WITH_LIMITATIONS: {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    icon: '⚠',
    label: 'Caveats',
  },
  INSUFFICIENT_DATA: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    icon: '✗',
    label: 'Blocked',
  },
  UNSUPPORTED_FOR_THIS_METHOD: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    icon: '✗',
    label: 'Blocked',
  },
};

export default function QualityGatePanel({ dataset, variable, startYear, endYear, bbox, onGateResult }) {
  const [gate, setGate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runGate = useCallback(async () => {
    if (!dataset || !variable || !startYear || !endYear) return;
    setLoading(true);
    try {
      const payload = { dataset_id: dataset, variable_id: variable, start_year: startYear, end_year: endYear };
      if (bbox) payload.bbox = bbox;
      const result = await assessQualityGate(payload);
      setGate(result);
      onGateResult?.(result);
    } catch {
      setGate(null);
    } finally {
      setLoading(false);
    }
  }, [dataset, variable, startYear, endYear, bbox, onGateResult]);

  useEffect(() => {
    const timer = setTimeout(runGate, 400);
    return () => clearTimeout(timer);
  }, [runGate]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingRow}>
          <span style={styles.spinner}>⟳</span>
          <span style={styles.loadingText}>Evaluating scientific feasibility…</span>
        </div>
      </div>
    );
  }

  if (!gate) return null;

  const cfg = STATUS_CONFIG[gate.status] || STATUS_CONFIG.SUPPORTED_WITH_LIMITATIONS;

  return (
    <div style={{ ...styles.container, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
      {/* Header row */}
      <div style={styles.headerRow} onClick={() => setExpanded((e) => !e)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((p) => !p)}>
        <div style={styles.statusBadge}>
          <span style={{ ...styles.statusIcon, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ ...styles.statusLabel, color: cfg.color }}>{gate.status_label}</span>
        </div>
        <div style={styles.metaRow}>
          <span style={styles.metaChip} title="Years of data">⏱ {gate.observation_count}yr</span>
          {gate.grid_intersection_cells > 0 && (
            <span style={styles.metaChip} title="Grid cells">⊞ {gate.grid_intersection_cells} cells</span>
          )}
          {gate.meets_climatological_threshold && (
            <span style={{ ...styles.metaChip, color: '#10b981' }} title="Meets 20yr climatological threshold">✓ WMO</span>
          )}
        </div>
        <span style={{ ...styles.chevron, transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>

      {/* Limitations (always show if blocking) */}
      {!gate.can_execute && gate.limitations.length > 0 && (
        <div style={styles.limitationsBlock}>
          {gate.limitations.map((lim, i) => (
            <div key={i} style={styles.limitationItem}>
              <span style={{ color: cfg.color, flexShrink: 0 }}>▸</span>
              <span>{lim}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div style={styles.expandedBody}>
          {gate.limitations.length > 0 && gate.can_execute && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Scientific Caveats</div>
              {gate.limitations.map((lim, i) => (
                <div key={i} style={styles.limitationItem}>
                  <span style={{ color: cfg.color, flexShrink: 0 }}>▸</span>
                  <span>{lim}</span>
                </div>
              ))}
            </div>
          )}
          {gate.actionable_recommendations?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Recommendations</div>
              {gate.actionable_recommendations.map((rec, i) => (
                <div key={i} style={styles.recItem}>
                  <span style={{ color: '#60a5fa', flexShrink: 0 }}>→</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
          {gate.recommended_window && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Recommended Window</div>
              <span style={styles.windowChip}>{gate.recommended_window[0]} – {gate.recommended_window[1]}</span>
            </div>
          )}
          <div style={styles.sensorRow}>
            <span style={styles.sensorLabel}>Sensor regime:</span>
            <span style={styles.sensorValue}>{gate.sensor_continuity?.replace(/_/g, ' ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: 8,
    fontFamily: 'inherit',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    opacity: 0.6,
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    fontSize: 14,
    color: '#9ca3af',
  },
  loadingText: {
    fontSize: 11,
    color: '#9ca3af',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    outline: 'none',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  statusIcon: {
    fontSize: 13,
    fontWeight: 700,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  metaRow: {
    display: 'flex',
    gap: 5,
    flex: 1,
    flexWrap: 'wrap',
  },
  metaChip: {
    fontSize: 10,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '1px 5px',
    color: '#d1d5db',
  },
  chevron: {
    fontSize: 12,
    color: '#9ca3af',
    transition: 'transform 0.2s',
    marginLeft: 'auto',
  },
  limitationsBlock: {
    marginTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  limitationItem: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    color: '#f3f4f6',
    lineHeight: 1.45,
  },
  expandedBody: {
    marginTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 2,
  },
  recItem: {
    display: 'flex',
    gap: 6,
    fontSize: 11,
    color: '#d1d5db',
    lineHeight: 1.45,
  },
  windowChip: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  sensorRow: {
    display: 'flex',
    gap: 6,
    fontSize: 10,
    color: '#6b7280',
  },
  sensorLabel: {
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sensorValue: {
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
};
