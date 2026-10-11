import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { formatCoords1 } from '../utils/helpers';

export default function SignalsList() {
  const candidateSignals = useStore((s) => s.candidateSignals);
  const selectCell = useStore((s) => s.selectCell);
  const selectedCell = useStore((s) => s.selectedCell);

  if (candidateSignals.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-3">
          Discovery Signals
        </h3>
        <p className="text-xs text-text-muted">
          Run an analysis to discover candidate trend signals.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-3">
        Top Discovery Signals
      </h3>
      <div className="space-y-2">
        <AnimatePresence>
          {candidateSignals.slice(0, 5).map((sig, idx) => {
            const scorePct = Math.min(100, Math.max(12, Math.round((sig.discovery_score || 0.5) * 50)));
            const isActive = selectedCell?.lat === sig.lat && selectedCell?.lon === sig.lon;

            return (
              <motion.button
                key={`${sig.lat}-${sig.lon}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                onClick={() => selectCell(sig.lat, sig.lon)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                  isActive
                    ? 'border-accent-cyan/40 bg-accent-cyan/5'
                    : 'border-border-subtle hover:border-border-hover bg-bg-elevated/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-bold font-[var(--font-mono)] w-6 shrink-0 ${
                    isActive ? 'text-accent-cyan' : 'text-text-muted'
                  }`}>
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-text-main truncate">
                      {formatCoords1(sig.lat, sig.lon)}
                    </div>
                    <div className="text-[10px] text-text-muted font-[var(--font-mono)]">
                      {sig.direction.toUpperCase()} • {sig.slope > 0 ? '+' : ''}{sig.slope.toFixed(3)}
                    </div>
                    <div className="signal-meter-track mt-1.5 w-24">
                      <div className="signal-meter-fill" style={{ width: `${scorePct}%` }} />
                    </div>
                  </div>
                </div>
                <div
                  className="text-xs font-bold font-[var(--font-mono)] text-accent-anomaly shrink-0 flex items-center gap-1.5"
                  title={sig.ranking_rationale}
                >
                  <span className="text-[10px] text-text-muted font-normal uppercase tracking-wider">Score</span>
                  <span className="tabular-nums">{sig.discovery_score.toFixed(3)}</span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
