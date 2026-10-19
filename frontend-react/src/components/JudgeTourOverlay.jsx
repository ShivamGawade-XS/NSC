import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { CASE_STUDY_HOTSPOTS } from '../constants/caseStudies';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

export default function JudgeTourOverlay({ mapInstance }) {
  const isCaseStudyOpen = useStore((s) => s.isCaseStudyTourOpen ?? s.isJudgeTourActive);
  const step = useStore((s) => s.tourStepIndex ?? s.judgeTourStep ?? 0);
  const closeTour = useStore((s) => s.closeCaseStudyTour || s.stopJudgeTour);
  const loadPreset = useStore((s) => s.loadPreset);

  const activeIndex = step % CASE_STUDY_HOTSPOTS.length;
  const currentHotspot = CASE_STUDY_HOTSPOTS[activeIndex];

  // Auto-sync initial transect on tour open
  useEffect(() => {
    if (isCaseStudyOpen && currentHotspot?.presetKey) {
      loadPreset(currentHotspot.presetKey);
      if (mapInstance) {
        mapInstance.flyTo(currentHotspot.coords, currentHotspot.zoom, { duration: 1.8 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCaseStudyOpen]);

  const goToTransect = (targetIdx) => {
    const safeIdx = (targetIdx + CASE_STUDY_HOTSPOTS.length) % CASE_STUDY_HOTSPOTS.length;
    useStore.setState({ tourStepIndex: safeIdx, judgeTourStep: safeIdx });
    const target = CASE_STUDY_HOTSPOTS[safeIdx];
    if (target.presetKey) {
      loadPreset(target.presetKey);
    }
    if (mapInstance) {
      mapInstance.flyTo(target.coords, target.zoom, { duration: 2.0 });
    }
    playTelemetryChime();
  };

  const handleNext = () => {
    playTactileClick(750);
    goToTransect(activeIndex + 1);
  };

  const handlePrev = () => {
    playTactileClick(650);
    goToTransect(activeIndex - 1);
  };

  const handleClose = () => {
    playTactileClick(500);
    closeTour();
  };

  if (!isCaseStudyOpen) return null;

  return (
    <AnimatePresence>
      <div className="absolute top-14 left-3 z-[2000] w-[92%] sm:w-96 max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          className="bg-[var(--color-bg-surface)]/95 border border-[var(--color-border-strong)] rounded p-4 shadow-2xl backdrop-blur-md text-[var(--color-text-main)] text-xs font-sans"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2.5 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent-blue)] animate-pulse" />
              <span className="text-[10px] font-mono tracking-wider text-[var(--color-accent-blue)] uppercase font-semibold">
                Exemplar Transect {activeIndex + 1} of {CASE_STUDY_HOTSPOTS.length}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] text-xs px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] font-mono transition-colors"
            >
              Close
            </button>
          </div>

          {/* Stepper Dots Indicator */}
          <div className="flex items-center gap-1 mb-3">
            {CASE_STUDY_HOTSPOTS.map((h, i) => (
              <button
                key={h.id || i}
                type="button"
                onClick={() => {
                  playTactileClick(700);
                  goToTransect(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeIndex
                    ? 'w-6 bg-[var(--color-accent-blue)]'
                    : 'w-2 bg-[var(--color-border-subtle)] hover:bg-[var(--color-text-muted)]'
                }`}
                title={h.title}
                aria-label={`Jump to Transect ${i + 1}: ${h.title}`}
              />
            ))}
          </div>

          {/* Anomaly Information */}
          <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[var(--color-text-main)] tracking-tight mb-0.5">
            {currentHotspot.title}
          </h3>
          <div className="text-[11px] text-[var(--color-text-secondary)] font-mono mb-3">
            {currentHotspot.location}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 bg-[var(--color-bg-elevated)] p-2.5 rounded border border-[var(--color-border-subtle)] text-xs font-mono">
            <div>
              <span className="text-[9px] text-[var(--color-text-muted)] block uppercase tracking-wider">Estimated Rate</span>
              <span className="text-[#f59e0b] font-semibold">{currentHotspot.rate}</span>
            </div>
            <div>
              <span className="text-[9px] text-[var(--color-text-muted)] block uppercase tracking-wider">Significance</span>
              <span className="text-emerald-500 font-semibold">{currentHotspot.significance}</span>
            </div>
          </div>

          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-3">
            {currentHotspot.mechanism}
          </p>

          <div className="text-[10px] text-[var(--color-text-muted)] font-mono mb-3.5 border-t border-[var(--color-border-subtle)] pt-2">
            Reference: {currentHotspot.missionCitation}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="interface-btn-secondary !py-1.5 !px-2.5 !text-xs font-mono"
            >
              <span aria-hidden="true">&larr;</span>
              <span>Prev</span>
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="interface-btn-primary !py-1.5 !px-3 !text-xs font-mono flex-1 justify-center"
            >
              <span>Next Transect</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
