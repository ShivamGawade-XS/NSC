import { Toaster } from 'react-hot-toast';
import Header from '../components/Header';
import TrendMap from '../components/TrendMap';
import TimeSeriesChart from '../components/TimeSeriesChart';
import AnalysisPanel from '../components/AnalysisPanel';
import SignalsList from '../components/SignalsList';
import EvidencePanel from '../components/EvidencePanel';
import ExportButtons from '../components/ExportButtons';
import CommandPaletteModal from '../components/CommandPaletteModal';
import LatexModal from '../components/LatexModal';
import useStore from '../store/useStore';

export default function DashboardPage() {
  const isLoading = useStore((s) => s.isLoading);
  const error = useStore((s) => s.error);
  const analysisData = useStore((s) => s.analysisData);

  return (
    <div className="min-h-screen bg-bg-deep">
      <Header />
      <CommandPaletteModal />
      <LatexModal />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(13, 13, 18, 0.95)',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(12px)',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
        }}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4" />
            <p className="text-sm font-semibold text-text-main mb-1">Computing Trend Analysis...</p>
            <p className="text-xs text-text-muted">Mann-Kendall • FDR Correction • LISA Clustering</p>
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <main className="pt-[78px] p-4 max-w-[1920px] mx-auto">
        {/* Map Subtitle Bar */}
        {analysisData && !analysisData.isCompound && (
          <div className="glass-card px-4 py-2 mb-4 flex items-center justify-between">
            <div className="text-xs text-text-secondary font-[var(--font-mono)]">
              {analysisData.variable_name} ({analysisData.time_span}) •{' '}
              {analysisData.summary?.significant_cells_fdr ?? 0} / {analysisData.summary?.total_cells ?? 0} Significant Cells [FDR (q ≤ 0.05)]
            </div>
            {analysisData.summary?.spatial_autocorrelation && (
              <div className="text-[10px] text-text-muted font-[var(--font-mono)]">
                Moran's I = {analysisData.summary.spatial_autocorrelation.moran_i?.toFixed(3) || '0.000'} (
                {analysisData.summary.spatial_autocorrelation.interpretation})
              </div>
            )}
          </div>
        )}

        {analysisData && analysisData.isCompound && (
          <div className="glass-card px-4 py-2.5 mb-4 flex items-center justify-between border-amber-500/20 bg-amber-950/10">
            <div className="text-xs text-amber-200 font-[var(--font-mono)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Compound Hazard Analysis (T + P) • Climate Aridification Index (CAI)
            </div>
            <div className="text-[10px] text-zinc-400 font-[var(--font-mono)]">
              {analysisData.cells?.length || 0} Cells Evaluated
            </div>
          </div>
        )}

        {/* Error toast */}
        {error && (
          <div className="glass-card px-4 py-3 mb-4 border-red-500/30 bg-red-950/20 text-xs text-red-300 flex items-center gap-2 rounded-md">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-4">
          {/* Left: Controls */}
          <div className="space-y-4 lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-2">
            <AnalysisPanel />
            <SignalsList />
            <ExportButtons />
          </div>

          {/* Center: Map + Chart */}
          <div className="space-y-4">
            <div className="h-[50vh] min-h-[400px]">
              <TrendMap />
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
                  Time Series Analysis
                </h3>
                {useStore.getState().selectedCell && (
                  <span className="text-[10px] text-text-muted font-[var(--font-mono)]">
                    {useStore.getState().selectedCell?.slope > 0 ? '+' : ''}
                    {useStore.getState().selectedCell?.slope?.toFixed(4)}{' '}
                    {useStore.getState().selectedCell?.slope_units}
                  </span>
                )}
              </div>
              <div className="h-[250px]">
                <TimeSeriesChart />
              </div>
            </div>
          </div>

          {/* Right: Evidence */}
          <div className="lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-2">
            <EvidencePanel />
          </div>
        </div>
      </main>
    </div>
  );
}
