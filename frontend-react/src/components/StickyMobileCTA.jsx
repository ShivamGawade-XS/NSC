import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { playTactileClick } from '../utils/audio';

export default function StickyMobileCTA({ mode = 'landing' }) {
  const navigate = useNavigate();
  const isLoading = useStore((s) => s.isLoading);
  const executeAnalysis = useStore((s) => s.executeAnalysis);

  if (mode === 'landing') {
    return (
      <aside
        aria-label="Mobile Navigation Quick Action"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-surface)]/95 backdrop-blur-md border-t border-[var(--color-border-strong)] p-3 px-4 flex items-center justify-between gap-3 shadow-2xl"
      >
        <div className="flex flex-col min-w-0">
          <span className="font-['Space_Grotesk'] font-bold text-xs text-[var(--color-text-main)] truncate">
            NASA Space Apps 2026
          </span>
          <span className="text-[10px] text-[var(--color-accent-blue)] font-mono">
            44yr Continuous Record
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            playTactileClick(800);
            navigate('/dashboard');
          }}
          className="interface-btn-primary !py-2 !px-4 !text-xs font-semibold whitespace-nowrap shrink-0 shadow-md"
        >
          <span>Launch Workspace →</span>
        </button>
      </aside>
    );
  }

  // Dashboard mode
  return (
    <aside
      aria-label="Dashboard Quick Action Bar"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-surface)]/95 backdrop-blur-md border-t border-[var(--color-border-strong)] p-2.5 px-4 flex items-center justify-between gap-2 shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <a
          href="#map-section"
          className="interface-btn-secondary !py-1.5 !px-3 !text-[11px] font-mono"
          onClick={() => playTactileClick(500)}
        >
          GIS Map
        </a>
        <a
          href="#evidence-section"
          className="interface-btn-secondary !py-1.5 !px-3 !text-[11px] font-mono"
          onClick={() => playTactileClick(500)}
        >
          Evidence
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          playTactileClick(750);
          executeAnalysis();
        }}
        disabled={isLoading}
        className="interface-btn-primary !py-1.5 !px-3.5 !text-xs font-semibold shrink-0"
      >
        {isLoading ? (
          <>
            <span className="loading-spinner !w-3 !h-3 !border-2" />
            <span>Computing...</span>
          </>
        ) : (
          <span>Run Trends</span>
        )}
      </button>
    </aside>
  );
}

