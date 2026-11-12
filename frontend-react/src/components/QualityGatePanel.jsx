/**
 * Tellura 2.0 — Pre-flight Scientific Quality Gate Panel
 * Evaluates analysis parameters before execution:
 * sensor continuity, temporal sample count, spatial grid intersection.
 */
import { useState, useEffect, useRef } from 'react';
import { assessQualityGate } from '../api/client';
import { playTactileClick } from '../utils/audio';

const STATUS_CONFIG = {
  SUPPORTED: {
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-950/20',
    borderColor: 'border-emerald-500/35',
    icon: '✓',
    label: 'Optimal',
  },
  SUPPORTED_WITH_LIMITATIONS: {
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-950/20',
    borderColor: 'border-amber-500/35',
    icon: '!',
    label: 'Caveats',
  },
  INSUFFICIENT_DATA: {
    textColor: 'text-red-400',
    bgColor: 'bg-red-950/20',
    borderColor: 'border-red-500/35',
    icon: '✗',
    label: 'Blocked',
  },
  UNSUPPORTED_FOR_THIS_METHOD: {
    textColor: 'text-red-400',
    bgColor: 'bg-red-950/20',
    borderColor: 'border-red-500/35',
    icon: '✗',
    label: 'Blocked',
  },
};

export default function QualityGatePanel({ dataset, variable, startYear, endYear, bbox, onGateResult }) {
  const [gate, setGate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const onGateResultRef = useRef(onGateResult);
  useEffect(() => {
    onGateResultRef.current = onGateResult;
  });
  const lastKeyRef = useRef('');

  const bboxStr = Array.isArray(bbox) ? bbox.join(',') : (bbox ? JSON.stringify(bbox) : '');

  useEffect(() => {
    if (!dataset || !variable || !startYear || !endYear) return;
    const currentKey = `${dataset}|${variable}|${startYear}|${endYear}|${bboxStr}`;
    if (currentKey === lastKeyRef.current) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const payload = { dataset_id: dataset, variable_id: variable, start_year: startYear, end_year: endYear };
        if (bbox) payload.bbox = bbox;
        const result = await assessQualityGate(payload);
        if (!cancelled) {
          lastKeyRef.current = currentKey;
          setGate(result);
          onGateResultRef.current?.(result);
        }
      } catch {
        if (!cancelled) setGate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dataset, variable, startYear, endYear, bboxStr, bbox]);

  if (loading) {
    return (
      <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)]">
        <span className="inline-block animate-spin text-xs">⟳</span>
        <span>Evaluating scientific feasibility…</span>
      </div>
    );
  }

  if (!gate) return null;

  const cfg = STATUS_CONFIG[gate.status] || STATUS_CONFIG.SUPPORTED_WITH_LIMITATIONS;

  const toggleExpand = () => {
    playTactileClick(600);
    setExpanded((prev) => !prev);
  };

  return (
    <div className={`rounded border px-2.5 py-1.5 transition-colors cursor-pointer select-none ${cfg.bgColor} ${cfg.borderColor}`}>
      {/* Header row */}
      <div
        className="flex items-center gap-2 outline-none"
        onClick={toggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand()}
      >
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`font-mono font-bold text-xs ${cfg.textColor}`}>{cfg.icon}</span>
          <span className={`font-mono text-[11px] font-bold tracking-wider uppercase ${cfg.textColor}`}>
            {gate.status_label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          <span
            className="text-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)] font-mono"
            title="Years of continuous observation"
          >
            ⏱ {gate.observation_count}yr
          </span>
          {gate.grid_intersection_cells > 0 && (
            <span
              className="text-[10px] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5 text-[var(--color-text-secondary)] font-mono"
              title="Grid cells intersecting bounding box"
            >
              ⊞ {gate.grid_intersection_cells} cells
            </span>
          )}
          {gate.meets_climatological_threshold && (
            <span
              className="text-[10px] bg-[var(--color-bg-surface)] border border-emerald-500/30 rounded px-1.5 py-0.5 text-emerald-400 font-mono font-semibold"
              title="Meets 20yr climatological threshold"
            >
              ✓ WMO
            </span>
          )}
        </div>

        <span
          className={`text-[10px] text-[var(--color-text-muted)] transition-transform duration-200 ml-auto ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </div>

      {/* Limitations (always show if blocking) */}
      {!gate.can_execute && gate.limitations?.length > 0 && (
        <div className="mt-2 space-y-1 text-xs">
          {gate.limitations.map((lim, i) => (
            <div key={i} className="flex items-start gap-1.5 text-red-300 font-mono text-[11px] leading-tight">
              <span className="shrink-0 text-red-400">▸</span>
              <span>{lim}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] space-y-2 text-xs font-mono animate-in fade-in duration-150">
          {gate.limitations?.length > 0 && gate.can_execute && (
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                Scientific Caveats
              </div>
              {gate.limitations.map((lim, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[var(--color-text-secondary)] text-[11px] leading-tight">
                  <span className={`${cfg.textColor} shrink-0`}>▸</span>
                  <span>{lim}</span>
                </div>
              ))}
            </div>
          )}

          {gate.actionable_recommendations?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                Recommendations
              </div>
              {gate.actionable_recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[var(--color-text-secondary)] text-[11px] leading-tight">
                  <span className="text-[var(--color-accent-blue)] shrink-0">→</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {gate.recommended_window && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                Recommended Window:
              </span>
              <span className="text-xs text-[var(--color-accent-blue)] font-bold">
                {gate.recommended_window[0]} – {gate.recommended_window[1]}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
            <span className="uppercase tracking-wider font-bold">Sensor regime:</span>
            <span className="text-[var(--color-text-secondary)]">{gate.sensor_continuity?.replace(/_/g, ' ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
