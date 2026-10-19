import { useEffect } from 'react';
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

export default function DashboardPage() {
  const isLoading = useStore((s) => s.isLoading);
  const error = useStore((s) => s.error);
  const analysisData = useStore((s) => s.analysisData);
  const selectedCell = useStore((s) => s.selectedCell);

  useEffect(() => {
    document.title = 'Analysis Workspace — EarthSift';
    trackPageView('Analysis Workspace');
    window.scrollTo(0, 0);
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
