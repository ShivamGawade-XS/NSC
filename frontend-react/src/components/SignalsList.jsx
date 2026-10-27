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
  const compoundHotspots = isCompound && analysisData?.cells
    ? [...analysisData.cells].sort((a, b) => (b.cai || 0) - (a.cai || 0)).slice(0, 5)
    : [];

  const hasData = isCompound ? compoundHotspots.length > 0 : candidateSignals.length > 0;

  if (!hasData) {
    return (
      <div className="interface-card p-4 space-y-2.5">
        <h3 className="eyebrow-label mb-1">
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
          className="interface-btn-secondary !py-1.5 !text-[11px] font-mono justify-center w-full hover:border-[#0066ff]/40"
        >
          <span>🔭 Autonomous Discovery Scan</span>
        </button>
      </div>
    );
  }

  // Compound Hazard Hotspots List
  if (isCompound) {
    return (
      <div className="interface-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="eyebrow-label text-[#f59e0b]">
            Top Compound Hotspots
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
    <div className="interface-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="eyebrow-label">
          Top Discovery Signals
        </h3>
        <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
          Ranked by Kendall τ
        </span>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence>
          {candidateSignals.slice(0, 5).map((sig, idx) => {
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
                className={`w-full flex items-center justify-between p-2.5 rounded border transition-all text-left ${
                  isActive
                    ? 'border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/10 text-[var(--color-text-main)] font-semibold'
                    : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] text-[var(--color-text-main)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`text-xs font-mono font-bold w-5 shrink-0 ${
                    isActive ? 'text-[var(--color-accent-blue)]' : 'text-[var(--color-text-muted)]'
                  }`}>
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[var(--color-text-main)] truncate font-['Space_Grotesk']">
                      {formatCoords1(sig.lat, sig.lon)}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-secondary)] font-mono flex items-center gap-1.5 mt-0.5">
                      <span className={sig.slope > 0 ? 'text-amber-500 font-semibold' : 'text-cyan-500 font-semibold'}>
                        {sig.slope > 0 ? '+' : ''}{sig.slope.toFixed(3)}/dec
                      </span>
                      <span className="text-[var(--color-border-strong)]">|</span>
                      <span>τ = {sig.tau !== undefined ? (sig.tau > 0 ? '+' : '') + sig.tau.toFixed(2) : (sig.direction === 'increasing' ? '+τ' : '-τ')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-semibold text-emerald-500 tabular-nums">
                    {sig.p_value !== undefined ? (sig.p_value < 0.001 ? 'p < 0.001' : `p = ${sig.p_value.toFixed(3)}`) : 'FDR Sig'}
                  </div>
                  <div className="text-[9px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">
                    q ≤ 0.05
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
