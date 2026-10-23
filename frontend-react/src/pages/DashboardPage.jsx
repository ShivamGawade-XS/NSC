import { useEffect, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from '../components/Header';
import Footer from '../components/Footer';
import TrendMap from '../components/TrendMap';
import TimeSeriesChart from '../components/TimeSeriesChart';
import AnalysisPanel from '../components/AnalysisPanel';
import SignalsList from '../components/SignalsList';
import EvidencePanel from '../components/EvidencePanel';
import ExportButtons from '../components/ExportButtons';
import CommandPaletteModal from '../components/CommandPaletteModal';
import LatexModal from '../components/LatexModal';
import CustomDataModal from '../components/CustomDataModal';
import PreprintModal from '../components/PreprintModal';
import useStore from '../store/useStore';
import { trackPageView } from '../utils/analytics';
import { playTactileClick } from '../utils/audio';
import { stopSonification } from '../utils/sonification';

export default function DashboardPage() {
  const isLoading = useStore((s) => s.isLoading);
  const error = useStore((s) => s.error);
  const analysisData = useStore((s) => s.analysisData);
  const selectedCell = useStore((s) => s.selectedCell);
  const hasInitialized = useRef(false);

  useEffect(() => {
    document.title = 'Analysis Workspace — EarthSift';
    trackPageView('Analysis Workspace');
    window.scrollTo(0, 0);

    return () => {
      stopSonification();
    };
  }, []);

  // Initialize from URL parameters on first load (sanitizing corrupted or malformed parameters)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const hasParams =
      params.has('dataset') ||
      params.has('var') ||
      params.has('start') ||
      params.has('end') ||
      params.has('bbox') ||
      params.has('compound') ||
      params.has('isCompound');

    if (hasParams) {
      const updates = {};
      if (params.get('dataset')) updates.dataset = params.get('dataset');
      if (params.get('var')) updates.variable = params.get('var');

      if (params.get('start')) {
        const parsedStart = parseInt(params.get('start'), 10);
        if (Number.isFinite(parsedStart) && parsedStart >= 1980 && parsedStart <= 2026) {
          updates.startYear = parsedStart;
        }
      }
      if (params.get('end')) {
        const parsedEnd = parseInt(params.get('end'), 10);
        if (Number.isFinite(parsedEnd) && parsedEnd >= 1980 && parsedEnd <= 2026) {
          updates.endYear = parsedEnd;
        }
      }
      if (updates.startYear && updates.endYear && updates.startYear >= updates.endYear) {
        updates.startYear = Math.max(1980, updates.endYear - 5);
      }
      if (params.has('fdr')) updates.useFdr = params.get('fdr') !== 'false';

      const bboxStr = params.get('bbox');
      if (bboxStr) {
        const parts = bboxStr.split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 4 && parts.every(Number.isFinite)) {
          const [minLon, minLat, maxLon, maxLat] = parts;
          if (minLon >= -180 && maxLon <= 180 && minLat >= -90 && maxLat <= 90 && minLon < maxLon && minLat < maxLat) {
            updates.bbox = {
              minLon: String(minLon),
              minLat: String(minLat),
              maxLon: String(maxLon),
              maxLat: String(maxLat),
            };
          }
        }
      }

      useStore.setState(updates);

      const isCompound =
        params.get('compound') === 'true' || params.get('isCompound') === 'true';
      const rawLat = parseFloat(params.get('lat'));
      const rawLon = parseFloat(params.get('lon'));
      const targetLat = (Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90) ? rawLat : undefined;
      const targetLon = (Number.isFinite(rawLon) && rawLon >= -180 && rawLon <= 180) ? rawLon : undefined;

      if (isCompound) {
        useStore.getState().executeCompoundAnalysis({ targetLat, targetLon });
      } else {
        useStore.getState().executeAnalysis({ targetLat, targetLon });
      }
    } else {
      // Default initial analysis so the dashboard never boots empty
      if (!useStore.getState().analysisData) {
        useStore.getState().executeAnalysis();
      }
    }
  }, []);

  // Keyboard Navigation: Arrow Keys, F (Sig Mask), L (LISA), Escape (Close Modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape closes any active modal immediately
      if (e.key === 'Escape') {
        const storeState = useStore.getState();
        if (
          storeState.nlqModalOpen ||
          storeState.latexModalOpen ||
          storeState.customDataModalOpen ||
          storeState.preprintModalOpen ||
          storeState.isCaseStudyTourOpen ||
          storeState.isJudgeTourActive
        ) {
          e.preventDefault();
          storeState.closeAllModals();
          return;
        }
      }

      // Ignore if focus is in input, textarea, select, or contenteditable
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }

      // Ignore if any modal is open
      const storeState = useStore.getState();
      if (
        storeState.nlqModalOpen ||
        storeState.latexModalOpen ||
        storeState.customDataModalOpen ||
        storeState.preprintModalOpen ||
        document.querySelector('[role="dialog"], .modal-overlay, dialog[open]')
      ) {
        return;
      }

      // Guard modifier keys so browser shortcuts (Ctrl+F, Cmd+K, etc.) remain intact
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key;
      const code = e.code;

      if (code === 'KeyF' || key === 'f' || key === 'F') {
        e.preventDefault();
        playTactileClick(680);
        storeState.toggleMask();
        return;
      }

      if (code === 'KeyL' || key === 'l' || key === 'L') {
        e.preventDefault();
        playTactileClick(680);
        storeState.toggleLisa();
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        const { analysisData, selectedCell } = storeState;
        if (!analysisData) return;

        const isCompound = Boolean(analysisData.isCompound);
        const cells = isCompound ? (analysisData.cells || []) : (analysisData.grid || []);
        if (!cells || cells.length === 0) return;

        const curCell = selectedCell || cells[0];
        const curLat = curCell.lat;
        const curLon = curCell.lon;

        let candidates = [];
        if (key === 'ArrowUp') {
          // Cardinal direction: +lat (North)
          candidates = cells.filter((c) => c.lat > curLat + 1e-4);
        } else if (key === 'ArrowDown') {
          // Cardinal direction: -lat (South)
          candidates = cells.filter((c) => c.lat < curLat - 1e-4);
        } else if (key === 'ArrowLeft') {
          // Cardinal direction: -lon (West)
          candidates = cells.filter((c) => c.lon < curLon - 1e-4);
        } else if (key === 'ArrowRight') {
          // Cardinal direction: +lon (East)
          candidates = cells.filter((c) => c.lon > curLon + 1e-4);
        }

        if (candidates.length === 0) return;

        e.preventDefault();

        let next = null;
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          // Find the nearest latitude step
          const minDLat = Math.min(...candidates.map((c) => Math.abs(c.lat - curLat)));
          const tier = candidates.filter(
            (c) => Math.abs(Math.abs(c.lat - curLat) - minDLat) < 1e-4
          );
          // Pick candidate with closest longitude
          let best = tier[0];
          let minDLon = Math.abs(best.lon - curLon);
          for (let i = 1; i < tier.length; i++) {
            const dLon = Math.abs(tier[i].lon - curLon);
            if (dLon < minDLon) {
              minDLon = dLon;
              best = tier[i];
            }
          }
          next = best;
        } else {
          // ArrowLeft / ArrowRight: find the nearest longitude step
          const minDLon = Math.min(...candidates.map((c) => Math.abs(c.lon - curLon)));
          const tier = candidates.filter(
            (c) => Math.abs(Math.abs(c.lon - curLon) - minDLon) < 1e-4
          );
          // Pick candidate with closest latitude
          let best = tier[0];
          let minDLat = Math.abs(best.lat - curLat);
          for (let i = 1; i < tier.length; i++) {
            const dLat = Math.abs(tier[i].lat - curLat);
            if (dLat < minDLat) {
              minDLat = dLat;
              best = tier[i];
            }
          }
          next = best;
        }

        if (next) {
          playTactileClick(680);
          if (isCompound) {
            storeState.selectCompoundCell(next);
          } else {
            storeState.selectCell(next.lat, next.lon);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] flex flex-col justify-between transition-colors">
      <div>
        <Header />
        <CommandPaletteModal />
        <LatexModal />
        <CustomDataModal />
        <PreprintModal />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-bg-surface)',
              color: 'var(--color-text-main)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'Inter, sans-serif',
            },
          }}
        />

        {/* Minimal Loading Overlay */}
        {isLoading && (
          <div className="loading-overlay" role="status" aria-live="polite">
            <div className="text-center p-6 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] shadow-2xl">
              <div className="loading-spinner mx-auto mb-3" />
              <p className="font-['Space_Grotesk'] text-sm font-semibold text-[var(--color-text-main)] mb-1">
                Computing Statistical Analysis
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                Mann-Kendall τ • Benjamini-Hochberg FDR • Anselin LISA
              </p>
            </div>
          </div>
        )}

        {/* Main Dashboard Container */}
        <main className="pt-16 px-4 sm:px-6 max-w-[1920px] mx-auto pb-12">
          {/* Page Intro Banner / Telemetry Status Strip */}
          <section className="mb-4 pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
              <div>
                <span className="eyebrow-label block mb-1">Scientific Trend Investigation</span>
                <h1 className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text-main)]">
                  Spatiotemporal Trend Workspace
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Subtle Keyboard Shortcut Hint Pill */}
                <div
                  className="flex items-center gap-1.5 text-[11px] font-mono bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] px-3 py-1.5 rounded border border-[var(--color-border-subtle)] shadow-xs select-none"
                  title="Mission-control keyboard navigation active"
                >
                  <span>↑↓←→ Navigate Grid • F Sig Mask • L LISA • ⌘K Query</span>
                </div>

                {/* Provenance Alert / Verification Badge */}
                {analysisData?.provenance && (
                  <>
                    {analysisData.provenance.is_synthetic === true && (
                      <div
                        role="alert"
                        className="flex items-center gap-1.5 text-xs font-mono bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded border border-amber-500/50 font-bold animate-pulse"
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Synthetic test data — not NASA observations.</span>
                      </div>
                    )}

                    {analysisData.provenance.is_synthetic === false && (
                      <div className="flex items-center gap-1.5 text-xs font-mono bg-emerald-950/40 text-emerald-400 px-3 py-1.5 rounded border border-emerald-500/40 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Verified NASA CF-1.8 Observations</span>
                        {analysisData.provenance.doi && (
                          <a
                            href={`https://doi.org/${analysisData.provenance.doi.replace(/^https?:\/\/doi\.org\//, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-300 hover:text-emerald-100 underline decoration-emerald-500/50 ml-0.5"
                            title={`View dataset DOI: ${analysisData.provenance.doi}`}
                          >
                            DOI ↗
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Live Run Metadata Pill */}
                {analysisData && !analysisData.isCompound && (
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono bg-[var(--color-bg-surface)] px-3.5 py-1.5 rounded border border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-secondary)]">
                      <strong className="text-[var(--color-text-main)]">{analysisData.variable_name}</strong> ({analysisData.time_span})
                    </span>
                    <span className="text-[var(--color-text-muted)] hidden sm:inline">•</span>
                    <span className="text-[var(--color-accent-blue)]">
                      {analysisData.summary?.significant_cells_fdr ?? 0} / {analysisData.summary?.total_cells ?? 0} FDR Significant (q ≤ 0.05)
                    </span>
                    {analysisData.summary?.spatial_autocorrelation && (
                      <>
                        <span className="text-[var(--color-text-muted)] hidden sm:inline">•</span>
                        <span className="text-[var(--color-text-secondary)]">
                          Moran’s I: <strong className="text-emerald-500 font-semibold">{analysisData.summary.spatial_autocorrelation.moran_i?.toFixed(3) || '0.000'}</strong> ({analysisData.summary.spatial_autocorrelation.interpretation})
                        </span>
                      </>
                    )}
                  </div>
                )}

                {analysisData && analysisData.isCompound && (
                  <div className="flex items-center gap-2 text-xs font-mono bg-[#f59e0b]/10 text-[#f59e0b] px-3.5 py-1.5 rounded border border-[#f59e0b]/30">
                    <span>Compound Hazard Analysis (T & P) • CAI Index Active ({analysisData.cells?.length || 0} Cells Evaluated)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Clamped Bounding Box Warning Callout */}
            {analysisData?.provenance?.bbox_clamped === true && analysisData?.provenance?.warning && (
              <div
                role="alert"
                className="mt-2.5 p-2.5 rounded bg-amber-950/30 border border-amber-500/40 text-amber-300 font-mono text-xs flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-[#f59e0b] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>{analysisData.provenance.warning}</span>
              </div>
            )}
          </section>

          {/* Error Banner */}
          {error && (
            <div className="p-3 mb-4 border border-red-500/30 bg-red-950/20 text-xs text-red-300 flex items-center gap-2 rounded">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="font-mono">{error}</span>
            </div>
          )}

          {/* 3-Column Architecture */}
          <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr_360px] gap-4 items-start">
            {/* Left Column: Data Controls & Signals */}
            <div className="space-y-4">
              <AnalysisPanel />
              <SignalsList />
              <ExportButtons />
            </div>

            {/* Center Column: GIS Map & Analytical Chart */}
            <div className="space-y-4 min-w-0">
              <div className="h-[52vh] min-h-[420px]">
                <TrendMap />
              </div>
              <div className="interface-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="eyebrow-label">
                    Annual Time Series & Sen's Slope
                  </h3>
                  {selectedCell && (
                    <span className="text-[11px] text-[#f59e0b] font-mono tabular-nums font-semibold">
                      Sen's Slope: {selectedCell.slope > 0 ? '+' : ''}{selectedCell.slope?.toFixed(4)} {selectedCell.slope_units}
                    </span>
                  )}
                </div>
                <div className="h-[250px]">
                  <TimeSeriesChart />
                </div>
              </div>
            </div>

            {/* Right Column: Evidence & Verification */}
            <div className="space-y-4">
              <EvidencePanel />
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
