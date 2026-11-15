import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import StickyMobileCTA from '../components/StickyMobileCTA';
import TrendMap from '../components/TrendMap';
import TimeSeriesChart from '../components/TimeSeriesChart';
import AnalysisPanel from '../components/AnalysisPanel';
import SignalsList from '../components/SignalsList';
import EvidencePanel from '../components/EvidencePanel';
import ExportButtons from '../components/ExportButtons';
import DetectiveWizardModal from '../components/DetectiveWizardModal';
import LatexModal from '../components/LatexModal';
import CustomDataModal from '../components/CustomDataModal';
import PreprintModal from '../components/PreprintModal';
import SchoolSlideModal from '../components/SchoolSlideModal';
import PolicyMemoModal from '../components/PolicyMemoModal';
import RobustnessLabModal from '../components/RobustnessLabModal';
import RegionalCompareModal from '../components/RegionalCompareModal';
import DataQualityModal from '../components/DataQualityModal';
import ReproducibilityModal from '../components/ReproducibilityModal';
import DiscoveryModal from '../components/DiscoveryModal';
import useStore from '../store/useStore';
import { getLabels } from '../utils/modeLabels';
import { trackPageView } from '../utils/analytics';
import { playTactileClick } from '../utils/audio';
import { stopSonification } from '../utils/sonification';
import { usePageMetadata } from '../utils/usePageMetadata';

export default function DashboardPage({ forcedMode }) {
  const isLoading = useStore((s) => s.isLoading);
  const error = useStore((s) => s.error);
  const analysisData = useStore((s) => s.analysisData);
  const selectedCell = useStore((s) => s.selectedCell);
  const analysisId = useStore((s) => s.analysisId);
  const workstationMode = useStore((s) => s.workstationMode);
  const activeMode = forcedMode || workstationMode || 'pro';
  const L = getLabels(activeMode);
  const robustnessModalOpen = useStore((s) => s.robustnessModalOpen);
  const qualityProfileModalOpen = useStore((s) => s.qualityProfileModalOpen);
  const reproducibilityModalOpen = useStore((s) => s.reproducibilityModalOpen);
  const regionalCompareModalOpen = useStore((s) => s.regionalCompareModalOpen);
  const discoveryModalOpen = useStore((s) => s.discoveryModalOpen);
  const hasInitialized = useRef(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileTab, setMobileTab] = useState('map'); // 'map' | 'controls' | 'evidence'

  // Route-aware metadata
  const pageMeta = activeMode === 'detective'
    ? {
        title: 'Earth System Detective — Tellura Student STEM Workbench',
        description: 'Guided climate mystery investigations for students and citizen scientists. 3-step hypothesis builder, audio sonification, and NASA POWER streaming.',
        canonicalPath: '/investigate',
      }
    : activeMode === 'policy'
    ? {
        title: 'Climate Risk & Resilience — Tellura Municipal Decision Cockpit',
        description: 'Decision intelligence cockpit for city planners and infrastructure authorities. Compound heatwave + drought aridification, Copula return periods, and climate velocity.',
        canonicalPath: '/policy',
      }
    : {
        title: 'Analysis Workspace — Tellura Scientific Research Workbench',
        description: 'Interactive spatiotemporal climate trend detective workspace. Real-time Mann-Kendall statistics, Sen slope, Anselin LISA clustering, and CF-1.8 NetCDF downloads.',
        canonicalPath: '/dashboard',
      };

  usePageMetadata(pageMeta);

  useEffect(() => {
    trackPageView(pageMeta.title);
    window.scrollTo(0, 0);

    // Sync forced route mode into store if specified
    if (forcedMode && forcedMode !== useStore.getState().workstationMode) {
      useStore.getState().setWorkstationMode(forcedMode);
    }

    return () => {
      stopSonification();
    };
  }, [forcedMode, pageMeta.title]);

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
        if (Number.isFinite(parsedStart) && parsedStart >= 1981 && parsedStart <= 2026) {
          updates.startYear = parsedStart;
        }
      }
      if (params.get('end')) {
        const parsedEnd = parseInt(params.get('end'), 10);
        if (Number.isFinite(parsedEnd) && parsedEnd >= 1981 && parsedEnd <= 2026) {
          updates.endYear = parsedEnd;
        }
      }
      if (updates.startYear && updates.endYear && updates.startYear >= updates.endYear) {
        updates.startYear = Math.max(1981, updates.endYear - 5);
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
          storeState.schoolSlideModalOpen ||
          storeState.policyMemoModalOpen ||
          storeState.robustnessModalOpen ||
          storeState.qualityProfileModalOpen ||
          storeState.reproducibilityModalOpen ||
          storeState.regionalCompareModalOpen ||
          storeState.discoveryModalOpen ||
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

      if (code === 'KeyA' || key === 'a' || key === 'A') {
        e.preventDefault();
        playTactileClick(680);
        storeState.toggleAnomalyMode();
        return;
      }

      if (code === 'Space') {
        e.preventDefault();
        playTactileClick(700);
        storeState.toggleTimelinePlay();
        return;
      }

      if (code === 'Digit1' || key === '1') {
        e.preventDefault();
        playTactileClick(600);
        storeState.loadPreset('case1');
        return;
      }

      if (code === 'Digit2' || key === '2') {
        e.preventDefault();
        playTactileClick(600);
        storeState.loadPreset('case2');
        return;
      }

      if (code === 'Digit3' || key === '3') {
        e.preventDefault();
        playTactileClick(600);
        storeState.loadPreset('case3');
        return;
      }

      if (code === 'Digit4' || key === '4') {
        e.preventDefault();
        playTactileClick(600);
        storeState.loadPreset('case4');
        return;
      }

      if (code === 'Digit5' || key === '5') {
        e.preventDefault();
        playTactileClick(600);
        storeState.loadPreset('case5');
        return;
      }

      if (code === 'Digit6' || key === '6') {
        e.preventDefault();
        playTactileClick(600);
        storeState.loadPreset('case6');
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
        <DetectiveWizardModal />
        <LatexModal />
        <CustomDataModal />
        <PreprintModal />
        <SchoolSlideModal />
        <PolicyMemoModal />
        {robustnessModalOpen && (
          <RobustnessLabModal
            analysisId={analysisId}
            onClose={() => useStore.getState().setRobustnessModalOpen(false)}
          />
        )}
        {qualityProfileModalOpen && (
          <DataQualityModal
            analysisId={analysisId}
            onClose={() => useStore.getState().setQualityProfileModalOpen(false)}
          />
        )}
        {reproducibilityModalOpen && (
          <ReproducibilityModal
            analysisId={analysisId}
            onClose={() => useStore.getState().setReproducibilityModalOpen(false)}
          />
        )}
        {regionalCompareModalOpen && (
          <RegionalCompareModal
            onClose={() => useStore.getState().setRegionalCompareModalOpen(false)}
          />
        )}
        {discoveryModalOpen && (
          <DiscoveryModal
            onClose={() => useStore.getState().setDiscoveryModalOpen(false)}
          />
        )}

        {/* Main Dashboard Container */}
        <main className="pt-16 px-4 sm:px-6 max-w-[1920px] mx-auto pb-12">
          {/* Scientific Computing Status Bar (Non-blocking, In-situ) */}
          {isLoading && (
            <div
              className="mb-4 p-3 rounded-md border border-[var(--color-border-active)] bg-[var(--color-bg-elevated)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-blue)] shrink-0" />
                <div>
                  <p className="font-['Space_Grotesk'] text-xs font-semibold text-[var(--color-text-main)]">
                    {workstationMode === 'detective' ? 'Investigating Satellite Clues' : workstationMode === 'policy' ? 'Evaluating Climate Risk Indicators' : 'Computing Statistical Analysis'}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                    {workstationMode === 'detective'
                      ? 'Searching for significant warming and cooling patterns across NASA observations'
                      : workstationMode === 'policy'
                      ? 'Evaluating Trend Velocity • Compound Aridification • Copula Return Periods'
                      : 'Evaluating Theil-Sen Slope • Mann-Kendall τ • Benjamini-Hochberg FDR • Anselin LISA Regimes'}
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-44 h-1.5 rounded-full bg-[var(--color-border-subtle)] overflow-hidden">
                <div className="h-full bg-[var(--color-accent-blue)] skeleton-box w-full" />
              </div>
            </div>
          )}

          {/* Page Intro Banner / Telemetry Status Strip */}
          <section className="mb-4 pt-1">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
              <div>
                <h1 className="font-['Space_Grotesk'] text-lg sm:text-xl font-bold tracking-tight text-[var(--color-text-main)] flex flex-wrap items-center gap-2">
                  <span>
                    {workstationMode === 'detective'
                      ? 'Earth System Detective Workbench'
                      : workstationMode === 'policy'
                      ? 'Municipal Climate Resilience Cockpit'
                      : 'Open-Science Research Workstation'}
                  </span>
                  <span className="text-[11px] font-mono font-normal text-[var(--color-text-muted)] border-l border-[var(--color-border-subtle)] pl-2">
                    {workstationMode === 'detective'
                      ? 'Curiosity-Driven STEM Learning & Clue Discovery'
                      : workstationMode === 'policy'
                      ? 'Decadal Risk Management & Infrastructure Decision Support'
                      : 'Non-Parametric Mann-Kendall & Anselin LISA Battery'}
                  </span>
                  {workstationMode === 'detective' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      </svg>
                      <span>Detective Track</span>
                    </span>
                  )}
                  {workstationMode === 'policy' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.5M4.5 21V10.5" />
                      </svg>
                      <span>Policy Track</span>
                    </span>
                  )}
                  {workstationMode === 'pro' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.943A4.5 4.5 0 0115.86 17H8.14a4.5 4.5 0 01-2.37-.657L4.2 15.3" />
                      </svg>
                      <span>Pro Science Track</span>
                    </span>
                  )}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Keyboard Shortcut Popover Toggle */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowShortcuts(!showShortcuts)}
                    className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded border transition-colors cursor-pointer select-none ${
                      showShortcuts
                        ? 'bg-[var(--color-accent-blue-subtle)] text-[var(--color-accent-blue)] border-[var(--color-accent-blue)]'
                        : 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border-[var(--color-border-subtle)]'
                    }`}
                    title="Toggle keyboard navigation shortcuts"
                    aria-expanded={showShortcuts}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="6" y1="9" x2="6.01" y2="9" />
                      <line x1="10" y1="9" x2="10.01" y2="9" />
                      <line x1="14" y1="9" x2="14.01" y2="9" />
                      <line x1="18" y1="9" x2="18.01" y2="9" />
                      <line x1="6" y1="13" x2="6.01" y2="13" />
                      <line x1="18" y1="13" x2="18.01" y2="13" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <span>Shortcuts</span>
                  </button>

                  {showShortcuts && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-72 bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-md shadow-lg p-3 text-xs font-mono animate-in fade-in duration-150">
                      <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider mb-2 border-b border-[var(--color-border-subtle)] pb-1">
                        Workstation Keyboard Controls
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Navigate Grid Cells</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">↑ ↓ ← →</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Toggle Significance Mask</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">F</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Toggle LISA Cluster Regimes</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">L</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Toggle Anomaly Mode</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">A</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Play / Pause 4D Timeline</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">Space</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Load Presets (1–4)</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">1 2 3 4</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Command Query Palette</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">⌘K / Ctrl+K</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">Close Modals / HUDs</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)] font-bold">Esc</kbd>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Synthetic Warning (Only shown if data is synthetic test data) */}
                {analysisData?.provenance?.is_synthetic === true && (
                  <div
                    role="alert"
                    className="flex items-center gap-1.5 text-xs font-mono bg-amber-50 dark:bg-amber-950/25 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-700/40 font-semibold"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span>Synthetic test data — not NASA observations.</span>
                  </div>
                )}

                {/* Live Run Metadata Pill */}
                {analysisData && !analysisData.isCompound && (
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono bg-[var(--color-bg-surface)] px-3 py-1.5 rounded border border-[var(--color-border-subtle)]">
                    <span className="text-[var(--color-text-secondary)]">
                      <strong className="text-[var(--color-text-main)]">{analysisData.variable_name}</strong> ({analysisData.time_span})
                    </span>
                    <span className="text-[var(--color-border-default)] hidden sm:inline">•</span>
                    <span className="text-[var(--color-text-main)] font-medium">
                      {analysisData.summary?.significant_cells_fdr ?? 0} / {analysisData.summary?.total_cells ?? 0} {L.mapPillSignificant || 'FDR Sig (q ≤ 0.05)'}
                    </span>
                    {analysisData.summary?.spatial_autocorrelation && (
                      <>
                        <span className="text-[var(--color-border-default)] hidden sm:inline">•</span>
                        <span className="text-[var(--color-text-secondary)]">
                          {workstationMode === 'detective' ? (
                            <span>{L.mapPillSpatial}: <strong className="text-[var(--color-text-main)] font-bold">{analysisData.summary.spatial_autocorrelation.interpretation}</strong></span>
                          ) : (
                            <span>{L.mapPillSpatial}: <strong className="text-[var(--color-text-main)] font-bold">{analysisData.summary.spatial_autocorrelation.moran_i?.toFixed(3) || '0.000'}</strong> ({analysisData.summary.spatial_autocorrelation.interpretation})</span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {analysisData && analysisData.isCompound && (
                  <div className="flex items-center gap-2 text-xs font-mono bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-700/40">
                    <span>Compound Hazard Analysis (T & P) • CAI Index Active ({analysisData.cells?.length || 0} Cells Evaluated)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Clamped Bounding Box Warning Callout */}
            {analysisData?.provenance?.bbox_clamped === true && analysisData?.provenance?.warning && (
              <div
                role="alert"
                className="mt-2.5 p-2.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/35 text-amber-800 dark:text-amber-300 font-mono text-xs flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>{analysisData.provenance.warning}</span>
              </div>
            )}
          </section>

          {/* Error Banner */}
          {error && (
            <div className="p-3 mb-4 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-300 flex items-center gap-2 rounded">
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="font-mono">{error}</span>
            </div>
          )}

          {/* Mobile Workspace Segmented Switcher (< lg screens) */}
          <div className="lg:hidden flex items-center p-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] mb-4 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                playTactileClick(650);
                setMobileTab('map');
              }}
              className={`flex-1 py-1.5 px-2 rounded font-medium text-center transition-colors cursor-pointer ${
                mobileTab === 'map'
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
            >
              GIS & Trends
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(650);
                setMobileTab('controls');
              }}
              className={`flex-1 py-1.5 px-2 rounded font-medium text-center transition-colors cursor-pointer ${
                mobileTab === 'controls'
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
            >
              Controls
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(650);
                setMobileTab('evidence');
              }}
              className={`flex-1 py-1.5 px-2 rounded font-medium text-center transition-colors cursor-pointer ${
                mobileTab === 'evidence'
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
            >
              Evidence
            </button>
          </div>

          {/* 3-Column Architecture — Balanced 1-Screen Viewport */}
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] xl:grid-cols-[340px_1fr_380px] gap-5 items-start">
            {/* Left Column: Data Controls & Scientific Feasibility */}
            <div className={`space-y-3 ${mobileTab === 'controls' ? 'block' : 'hidden lg:block'}`}>
              <AnalysisPanel />
            </div>

            {/* Center Column: GIS Map, Analytical Chart & Regional Discovery / Exports Hub */}
            <div id="map-section" className={`space-y-3 min-w-0 ${mobileTab === 'map' ? 'block' : 'hidden lg:block'}`}>
              <div className="h-[46vh] min-h-[380px]">
                <TrendMap />
              </div>
              <div className="interface-card p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="instrument-heading">
                    Temporal Trajectory & Theil-Sen Estimator
                  </h2>
                  {selectedCell && (
                    <span className="text-xs text-[var(--color-text-secondary)] font-mono tabular-nums font-medium">
                      Sen's Slope: <strong className="text-[var(--color-text-main)] font-bold">{selectedCell.slope > 0 ? '+' : ''}{selectedCell.slope?.toFixed(4)}</strong> <span className="text-[10px] text-[var(--color-text-muted)]">{selectedCell.slope_units}</span>
                    </span>
                  )}
                </div>
                <div className="h-[255px]">
                  <TimeSeriesChart />
                </div>
              </div>

              {/* Balanced Regional Discovery Signals & Open Science Export Suite */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start pt-1">
                <SignalsList />
                <ExportButtons />
              </div>
            </div>

            {/* Right Column: Evidence & Verification */}
            <div id="evidence-section" className={`space-y-3 ${mobileTab === 'evidence' ? 'block' : 'hidden lg:block'}`}>
              <EvidencePanel />
            </div>
          </div>
        </main>
      </div>

      <StickyMobileCTA mode="dashboard" />
      <Footer />
    </div>
  );
}
