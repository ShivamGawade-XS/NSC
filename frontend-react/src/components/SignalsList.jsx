import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { formatCoords1 } from '../utils/helpers';
import { playTactileClick } from '../utils/audio';

export default function SignalsList() {
  const candidateSignals = useStore((s) => s.candidateSignals);
  const analysisData = useStore((s) => s.analysisData);
  const selectCell = useStore((s) => s.selectCell);
  const selectCompoundCell = useStore((s) => s.selectCompoundCell);
  const selectedCell = useStore((s) => s.selectedCell);

  const isCompound = Boolean(analysisData?.isCompound);
  const contrasts = analysisData?.contrasts || [];
  const compoundHotspots = isCompound && analysisData?.cells
    ? [...analysisData.cells].sort((a, b) => (b.cai || 0) - (a.cai || 0)).slice(0, 3)
    : [];

  const hasData = isCompound ? compoundHotspots.length > 0 : candidateSignals.length > 0;

  if (!hasData) {
    return (
      <div className="interface-card p-4 space-y-2.5">
        <h3 className="instrument-heading mb-1">
          Discovery Signals
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] font-mono">
          Execute an analysis or launch the multi-variable scan to populate candidate trend signals.
        </p>
        <button
          type="button"
          onClick={() => {
            playTactileClick(700);
            useStore.getState().setDiscoveryModalOpen(true);
          }}
          className="interface-btn-secondary !py-1.5 !text-[11px] font-mono justify-center w-full hover:border-[var(--color-accent-blue)]/50 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span>Autonomous Discovery Scan</span>
        </button>
      </div>
    );
  }

  // Compound Hazard Hotspots List
  if (isCompound) {
    return (
      <div className="interface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="instrument-heading text-amber-700 dark:text-amber-400">
            Compound Hazard Hotspots
          </h3>
          <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
            Ranked by CAI Index
          </span>
        </div>

        <div className="space-y-1.5">
          <AnimatePresence>
            {compoundHotspots.map((cell, idx) => {
              const isActive = selectedCell?.lat === cell.lat && selectedCell?.lon === cell.lon;
              return (
                <motion.button
                  key={`${cell.lat}-${cell.lon}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    playTactileClick(650);
                    selectCompoundCell(cell);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded border transition-all text-left ${
                    isActive
                      ? 'border-[#f59e0b] bg-[#f59e0b]/10 text-[var(--color-text-main)] font-semibold'
                      : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-main)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-xs font-mono font-bold w-5 shrink-0 ${
                      isActive ? 'text-[#f59e0b]' : 'text-[var(--color-text-muted)]'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[var(--color-text-main)] truncate font-['Space_Grotesk']">
                        {formatCoords1(cell.lat, cell.lon)}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-secondary)] font-mono flex items-center gap-1 mt-0.5">
                        <span className="text-[#ef4444]">T: {cell.temp_slope > 0 ? '+' : ''}{cell.temp_slope.toFixed(2)}</span>
                        <span>•</span>
                        <span className="text-[#06b6d4]">P: {cell.precip_slope > 0 ? '+' : ''}{cell.precip_slope.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-[#f59e0b] tabular-nums">
                      +{cell.cai.toFixed(3)}
                    </div>
                    <div className="text-[8px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">
                      CAI Risk
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Standard Monovariate Candidate Signals List
  return (
    <div className="interface-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="instrument-heading !text-xs">
          Top Discovery Signals
        </h3>
        <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
          Ranked by Kendall τ
        </span>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence>
          {candidateSignals.slice(0, 3).map((sig, idx) => {
            const isActive = selectedCell?.lat === sig.lat && selectedCell?.lon === sig.lon;
            return (
              <motion.button
                key={`${sig.lat}-${sig.lon}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => {
                  playTactileClick(650);
                  selectCell(sig.lat, sig.lon);
                }}
                className={`w-full flex items-center justify-between p-2 rounded border transition-all text-left cursor-pointer ${
                  isActive
                    ? 'border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10 text-[var(--color-text-main)] font-semibold'
                    : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-main)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[11px] font-mono font-bold w-4 shrink-0 ${
                    isActive ? 'text-[var(--color-accent-blue)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-[var(--color-text-main)] truncate font-['Space_Grotesk']">
                      {formatCoords1(sig.lat, sig.lon)}
                    </div>
                    <div className="text-[9px] text-[var(--color-text-secondary)] font-mono flex items-center gap-1 mt-0.5">
                      <span className={sig.slope > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-cyan-700 dark:text-cyan-400 font-semibold'}>
                        {sig.slope > 0 ? '+' : ''}{sig.slope.toFixed(3)}/dec
                      </span>
                      <span className="text-[var(--color-border-strong)]">•</span>
                      <span>τ = {sig.tau !== undefined ? (sig.tau > 0 ? '+' : '') + sig.tau.toFixed(2) : (sig.direction === 'increasing' ? '+τ' : '-τ')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {sig.p_value !== undefined ? (sig.p_value < 0.001 ? 'p < 0.001' : `p = ${sig.p_value.toFixed(3)}`) : 'FDR Sig'}
                  </div>
                  <div className="text-[8px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">
                    {sig.q_value !== undefined ? (sig.q_value < 0.001 ? 'q < 0.001' : `q = ${sig.q_value.toFixed(3)}`) : 'FDR Sig'}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Opposing Regional Contrasts (NASA Prompt: Opposite Trends Driven by Same Process) */}
      {contrasts && contrasts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)] space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold font-['Space_Grotesk'] text-[var(--color-text-main)] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[var(--color-accent-blue)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
                <path d="M7 21h10" />
                <path d="M12 3v18" />
                <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
              </svg>
              <span>Opposing Regional Contrasts</span>
            </h4>
            <span className="text-[9px] font-mono text-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10 px-1.5 py-0.5 rounded border border-[var(--color-accent-blue)]/30 font-semibold">
              Same Synoptic Process
            </span>
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)] font-mono leading-tight">
            Detected geographic cluster pairs with opposite significant trends:
          </p>
          <div className="space-y-1.5">
            {contrasts.slice(0, 2).map((c, i) => (
              <div
                key={i}
                className="p-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                  <span className="text-rose-600 dark:text-rose-400">
                    ▲ {c.cluster_1?.type === 'increasing' ? '+' : ''}{c.cluster_1?.mean_slope?.toFixed(2)} ({c.cluster_1?.cell_count} cells)
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">vs</span>
                  <span className="text-cyan-600 dark:text-cyan-400">
                    ▼ {c.cluster_2?.mean_slope?.toFixed(2)} ({c.cluster_2?.cell_count} cells)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-[var(--color-text-muted)] pt-0.5">
                  <span>Δ Divergence: {c.divergence?.toFixed(3)}</span>
                  <span>Distance: {Math.round(c.distance_km || 0)} km</span>
                </div>
                <div className="pt-1 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(600);
                      if (c.cluster_1?.center) selectCell(c.cluster_1.center[1], c.cluster_1.center[0]);
                    }}
                    className="flex-1 py-1 rounded bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[9px] font-mono text-center text-[var(--color-text-main)] cursor-pointer"
                  >
                    Inspect Zone 1 ({c.cluster_1?.center?.[1]}°N)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(600);
                      if (c.cluster_2?.center) selectCell(c.cluster_2.center[1], c.cluster_2.center[0]);
                    }}
                    className="flex-1 py-1 rounded bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[9px] font-mono text-center text-[var(--color-text-main)] cursor-pointer"
                  >
                    Inspect Zone 2 ({c.cluster_2?.center?.[1]}°N)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
