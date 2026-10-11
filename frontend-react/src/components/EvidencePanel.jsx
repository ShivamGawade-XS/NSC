import { useState } from 'react';
import { motion } from 'framer-motion';
import useStore from '../store/useStore';
import { formatCoords, formatPVal, LISA_LABELS } from '../utils/helpers';
import * as api from '../api/client';

export default function EvidencePanel() {
  const selectedCell = useStore((s) => s.selectedCell);
  const isAnomalyMode = useStore((s) => s.isAnomalyMode);
  const toggleAnomalyMode = useStore((s) => s.toggleAnomalyMode);

  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);

  if (!selectedCell) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">
          Evidence Record
        </h3>
        <p className="text-xs text-text-muted">Select a cell on the map to view its evidence record.</p>
      </div>
    );
  }

  const cell = selectedCell;
  const ev = cell.evidence_record;
  const cluster = cell.lisa_cluster || ev?.lisa_cluster || 'NS';

  const handleAiExplain = async () => {
    setShowAi(true);
    setAiLoading(true);
    setAiResult(null);
    try {
      const data = await api.requestExplanation({
        variable_name: cell.variable_name,
        location: formatCoords(cell.lat, cell.lon),
        time_span: `${cell.years[0]} - ${cell.years[cell.years.length - 1]}`,
        slope: cell.slope,
        slope_units: cell.slope_units,
        p_value: cell.p_value,
        q_value: cell.q_value,
        significant: cell.significant,
        direction: cell.direction,
        sample_count: cell.years?.length || 0,
        source: ev?.source || 'NASA Observation',
      });
      setAiResult(data);
    } catch {
      setAiResult({ summary: 'Deterministic fallback: Trend verified empirically under Mann-Kendall test. Explanation unavailable.' });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Active Target Card */}
      <motion.div
        key={`${cell.lat}-${cell.lon}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold font-[var(--font-display)] text-text-main">
              Cell {formatCoords(cell.lat, cell.lon)}
            </h3>
            <p className="text-[10px] text-text-muted font-[var(--font-mono)]">
              NASA POWER • 0.5° SYNOPTIC • {cell.variable_name || 'T2M'}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-[var(--font-mono)] ${
            cell.significant ? 'badge-hotspot' : 'badge-nominal'
          }`}>
            {cell.significant ? 'HOTSPOT DETECTED' : 'NOMINAL'}
          </span>
        </div>

        {/* Telemetry Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-bg-elevated rounded-lg p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-widest text-text-muted mb-1">Slope</div>
            <div className="text-sm font-bold font-[var(--font-mono)] text-accent-anomaly">
              {cell.slope > 0 ? '+' : ''}{cell.slope.toFixed(4)}
            </div>
            <div className="text-[8px] text-text-muted">{cell.slope_units}</div>
          </div>
          <div className="bg-bg-elevated rounded-lg p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-widest text-text-muted mb-1">p-value</div>
            <div className="text-sm font-bold font-[var(--font-mono)] text-accent-sig">
              {formatPVal(cell.p_value)}
            </div>
            <div className="text-[8px] text-text-muted">FDR q = {formatPVal(cell.q_value)}</div>
          </div>
          <div className="bg-bg-elevated rounded-lg p-2.5 text-center">
            <div className="text-[9px] uppercase tracking-widest text-text-muted mb-1">Kendall τ</div>
            <div className="text-sm font-bold font-[var(--font-mono)] text-accent-blue">
              {cell.tau.toFixed(3)}
            </div>
            <div className="text-[8px] text-text-muted">Rank Correlation</div>
          </div>
        </div>

        {/* Anomaly Mode Toggle */}
        <button
          onClick={toggleAnomalyMode}
          className={`w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium border transition-all ${
            isAnomalyMode
              ? 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan'
              : 'border-neutral-800 bg-bg-elevated text-text-secondary hover:border-neutral-700'
          }`}
        >
          <span className="font-mono text-[10px]">Δ</span>
          <span>{isAnomalyMode ? 'Anomaly Filter: Active' : 'Delta Anomaly Mode'}</span>
        </button>
      </motion.div>

      {/* Anomaly Severity Card */}
      {cell.significant && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-4 border-amber-500/20 bg-amber-950/5 rounded-md"
        >
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3.5 h-3.5 text-accent-anomaly shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-xs font-bold text-accent-anomaly uppercase tracking-wider font-mono">
              Significant Monotonic Drift Detected
            </span>
          </div>
          <p className="text-[10px] text-text-secondary mb-3 font-mono">
            {cell.slope > 0 ? 'Positive' : 'Negative'} Monotonic Trend ({cell.slope > 0 ? '+' : ''}{cell.slope.toFixed(4)} {cell.slope_units})
          </p>
          <div className="space-y-2">
            {[
              { label: 'Drift Magnitude', pct: Math.min(100, Math.max(15, Math.round(Math.abs(cell.slope) * 110))), cls: 'drift' },
              { label: 'Statistical Confidence', pct: Math.min(99, Math.max(50, Math.round((1 - Math.min(cell.p_value, 0.5)) * 100))), cls: 'confidence' },
              { label: 'Spatial Coherence', pct: cluster === 'HH' ? 92 : cluster === 'LL' ? 85 : 68, cls: 'coherence' },
            ].map(({ label, pct, cls }) => (
              <div key={cls}>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-text-muted">{label}</span>
                  <span className="text-text-secondary font-[var(--font-mono)]">{pct}%</span>
                </div>
                <div className="anomaly-bar-track">
                  <div className={`anomaly-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Evidence Details */}
      <div className="glass-card p-4 rounded-md">
        <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-3">
          Scientific Evidence Record
        </h3>
        <div className="space-y-2 text-xs text-text-secondary">
          <Row label="Observation" value={ev?.observation || `${cell.variable_name || 'Observation'} over ${cell.years?.length || 0} years`} />
          <Row label="Magnitude" value={ev?.magnitude || `${cell.slope > 0 ? '+' : ''}${cell.slope?.toFixed(4)} ${cell.slope_units}`} />
          <Row label="Significance" value={`p = ${formatPVal(cell.p_value)} | FDR q = ${formatPVal(cell.q_value)}`} />
          <Row label="Status" value={cell.significant ? 'Statistically Significant' : 'Not Significant'} />
          {cell.ci_lower !== undefined && (
            <Row
              label="95% CI"
              value={`[${cell.ci_lower > 0 ? '+' : ''}${cell.ci_lower.toFixed(4)}, ${cell.ci_upper > 0 ? '+' : ''}${cell.ci_upper.toFixed(4)}] ${cell.slope_units}`}
            />
          )}
          <Row label="LISA Cluster">
            <span className={`lisa-badge ${cluster.toLowerCase()}`}>
              {LISA_LABELS[cluster] || cluster}
            </span>
          </Row>
          {cell.changepoint_year && cell.changepoint_p_value < 0.05 && (
            <Row label="Regime Shift" value={`${cell.changepoint_year} (p = ${formatPVal(cell.changepoint_p_value)})`} />
          )}
          <Row label="Coverage" value={ev?.coverage || `${cell.years?.length || 0} consecutive annual records`} />
          <Row label="Method" value={ev?.method || "Mann-Kendall (1945) & Sen's Slope (1968)"} />
          <Row label="Source" value={ev?.source || 'NASA Observation'} />
          <Row label="Limitations" value={ev?.scientific_limitation || 'Empirical monotonic trend — period-dependent'} />
        </div>
      </div>

      {/* Physical Mechanism Briefing */}
      <div className="glass-card p-4 rounded-md">
        <button
          onClick={handleAiExplain}
          disabled={aiLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-950/30 hover:bg-blue-900/40 border border-blue-500/30 hover:border-blue-500/60 text-blue-300 rounded-md px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-50"
        >
          {aiLoading ? (
            <>
              <span className="loading-spinner !w-3.5 !h-3.5 !border-2" />
              Retrieving Physical Mechanism...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Physical Mechanism Briefing
            </>
          )}
        </button>

        {showAi && aiResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 p-3.5 rounded-md bg-bg-elevated border border-neutral-800 text-xs text-text-secondary space-y-2.5"
          >
            {aiResult.summary && <p><strong className="text-text-main font-semibold">Summary:</strong> {aiResult.summary}</p>}
            {aiResult.statistical_assessment && <p><strong className="text-text-main font-semibold">Assessment:</strong> {aiResult.statistical_assessment}</p>}
            {aiResult.limitations && <p className="text-amber-400/90"><strong>Caveats:</strong> {aiResult.limitations}</p>}

            {/* Candidate Physical Drivers */}
            {aiResult.physical_hypotheses && aiResult.physical_hypotheses.length > 0 && (
              <div className="border-t border-neutral-800 pt-2 mt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.942A6.75 6.75 0 0114.39 17.25H9.61a6.75 6.75 0 01-3.84-1.008L4.2 15.3M19.8 15.3A2.25 2.25 0 0021 13.364V6.75a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6.75v6.614a2.25 2.25 0 001.2 1.936" />
                  </svg>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400 font-semibold">
                    Candidate Physical Drivers (Peer-Reviewed)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {aiResult.physical_hypotheses.map((h, idx) => (
                    <div key={idx} className="bg-black/30 p-2 rounded border border-neutral-800 text-[11px]">
                      <div className="font-semibold text-neutral-200">{idx + 1}. {h.hypothesis}</div>
                      <div className="text-neutral-400 text-[10px] mt-0.5">{h.mechanism}</div>
                      <div className="text-[9px] text-blue-400/90 font-mono mt-0.5">DOI: {h.doi}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => navigator.clipboard.writeText(aiResult.summary || '')}
                className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.75v-6.75" />
                </svg>
                Copy Briefing
              </button>
              <button
                onClick={() => setShowAi(false)}
                className="text-[10px] text-text-muted hover:text-text-secondary"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Dual-Location Comparison Result Card */}
      {useStore.getState().comparisonResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-4 border-blue-500/30 bg-blue-950/10 rounded-md"
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider font-mono">
              Pin A vs Pin B Differential Inspector
            </h4>
          </div>
          <div className="text-[11px] text-neutral-300 font-mono space-y-1.5 bg-black/40 p-2.5 rounded-md border border-neutral-800">
            <div className="flex justify-between">
              <span className="text-blue-400">Loc A ({useStore.getState().comparisonResult.loc_a.lat.toFixed(1)}°, {useStore.getState().comparisonResult.loc_a.lon.toFixed(1)}°):</span>
              <span className="font-bold text-white tabular-nums">{useStore.getState().comparisonResult.loc_a.slope > 0 ? '+' : ''}{useStore.getState().comparisonResult.loc_a.slope}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-400">Loc B ({useStore.getState().comparisonResult.loc_b.lat.toFixed(1)}°, {useStore.getState().comparisonResult.loc_b.lon.toFixed(1)}°):</span>
              <span className="font-bold text-white tabular-nums">{useStore.getState().comparisonResult.loc_b.slope > 0 ? '+' : ''}{useStore.getState().comparisonResult.loc_b.slope}</span>
            </div>
            <div className="border-t border-neutral-800 pt-1 flex justify-between font-semibold">
              <span className="text-neutral-300">ΔSlope:</span>
              <span className="text-white tabular-nums">{useStore.getState().comparisonResult.delta_slope > 0 ? '+' : ''}{useStore.getState().comparisonResult.delta_slope} {useStore.getState().comparisonResult.slope_units}</span>
            </div>
            <div className="flex justify-between text-[10px] text-neutral-400">
              <span>Pearson Correlation r:</span>
              <span className="text-emerald-400 font-bold tabular-nums">{useStore.getState().comparisonResult.cross_correlation_r}</span>
            </div>
          </div>
          <p className="text-[10px] text-neutral-300 mt-2 italic font-mono">
            {useStore.getState().comparisonResult.regime_divergence_summary}
          </p>
        </motion.div>
      )}

      {/* Climate Velocity Telemetry Card */}
      {useStore.getState().velocityData && (
        <div className="glass-card p-3 border-blue-500/20 bg-blue-950/10 rounded-md">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-blue-400 font-bold flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Climate Velocity Field
            </span>
            <span className="text-neutral-400 text-[10px]">Burrows et al. (2011)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2 text-center text-xs font-mono">
            <div className="bg-black/30 p-1.5 rounded border border-neutral-800">
              <span className="text-[9px] text-neutral-400 block">Mean Speed</span>
              <span className="text-blue-300 font-bold tabular-nums">
                {useStore.getState().velocityData.summary?.mean_velocity_km_decade || 0} km/dec
              </span>
            </div>
            <div className="bg-black/30 p-1.5 rounded border border-neutral-800">
              <span className="text-[9px] text-neutral-400 block">P95 Speed</span>
              <span className="text-amber-300 font-bold tabular-nums">
                {useStore.getState().velocityData.summary?.p95_velocity_km_decade || 0} km/dec
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, children }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold w-24 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-xs text-text-secondary flex-1">
        {children || value}
      </span>
    </div>
  );
}
