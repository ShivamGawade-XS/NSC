import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { CASE_STUDY_HOTSPOTS } from '../constants/caseStudies';
import { playTactileClick, playTelemetryChime } from '../utils/audio';
import { formatPVal, DETECTIVE_PRESETS } from '../utils/helpers';

export default function JudgeTourOverlay({ mapInstance }) {
  const isCaseStudyOpen = useStore((s) => s.isCaseStudyTourOpen ?? s.isJudgeTourActive);
  const step = useStore((s) => s.tourStepIndex ?? s.judgeTourStep ?? 0);
  const closeTour = useStore((s) => s.closeCaseStudyTour || s.stopJudgeTour);
  const loadPreset = useStore((s) => s.loadPreset);
  const analysisData = useStore((s) => s.analysisData);
  const selectedCell = useStore((s) => s.selectedCell);
  const isLoading = useStore((s) => s.isLoading);
  const selectCell = useStore((s) => s.selectCell);
  const selectCompoundCell = useStore((s) => s.selectCompoundCell);

  const activeIndex = step % CASE_STUDY_HOTSPOTS.length;
  const currentHotspot = CASE_STUDY_HOTSPOTS[activeIndex];
  const preset = currentHotspot?.presetKey ? DETECTIVE_PRESETS[currentHotspot.presetKey] : null;

  // Analysis matches the current hotspot preset when dataset and variable (or compound status) align
  const isPresetMatch = Boolean(
    analysisData &&
    (preset?.isCompound
      ? Boolean(analysisData.isCompound)
      : (!analysisData.isCompound &&
         (analysisData.dataset_id === preset?.dataset || !analysisData.dataset_id) &&
         (analysisData.variable_id === preset?.variable || analysisData.variable_name === preset?.variable)))
  );

  const isLive = Boolean(isPresetMatch && !isLoading);

  // Auto-sync initial transect on tour open
  useEffect(() => {
    if (isCaseStudyOpen && currentHotspot?.presetKey) {
      loadPreset(currentHotspot.presetKey, {
        targetLat: currentHotspot.coords[0],
        targetLon: currentHotspot.coords[1],
      });
      if (mapInstance) {
        mapInstance.flyTo(currentHotspot.coords, currentHotspot.zoom, { duration: 1.8 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCaseStudyOpen]);

  // Synchronize selected cell with current hotspot coordinate when live data arrives
  useEffect(() => {
    if (!isCaseStudyOpen || !currentHotspot?.coords || !analysisData || isLoading || !isPresetMatch) return;

    const [targetLat, targetLon] = currentHotspot.coords;
    if (analysisData.isCompound) {
      const cells = analysisData.cells || [];
      if (cells.length > 0) {
        let closest = cells[0];
        let minDist = Infinity;
        for (const c of cells) {
          const dist = (c.lat - targetLat) ** 2 + (c.lon - targetLon) ** 2;
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
        if (!selectedCell || selectedCell.lat !== closest.lat || selectedCell.lon !== closest.lon) {
          selectCompoundCell(closest);
        }
      }
    } else {
      const grid = analysisData.grid || [];
      if (grid.length > 0) {
        let closest = grid[0];
        let minDist = Infinity;
        for (const c of grid) {
          const dist = (c.lat - targetLat) ** 2 + (c.lon - targetLon) ** 2;
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
        if (
          !selectedCell ||
          Math.abs(selectedCell.lat - closest.lat) > 1e-4 ||
          Math.abs(selectedCell.lon - closest.lon) > 1e-4
        ) {
          selectCell(closest.lat, closest.lon);
        }
      }
    }
  }, [isCaseStudyOpen, currentHotspot, analysisData, isPresetMatch, isLoading, selectedCell, selectCell, selectCompoundCell]);

  const goToTransect = (targetIdx) => {
    const safeIdx = (targetIdx + CASE_STUDY_HOTSPOTS.length) % CASE_STUDY_HOTSPOTS.length;
    useStore.setState({ tourStepIndex: safeIdx, judgeTourStep: safeIdx });
    const target = CASE_STUDY_HOTSPOTS[safeIdx];
    if (target.presetKey) {
      loadPreset(target.presetKey, {
        targetLat: target.coords[0],
        targetLon: target.coords[1],
      });
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

  // Compute live telemetry vs fallback loading placeholders
  let displayRate = currentHotspot.rate;
  let domainMeanStr = null;
  let displaySignificance = currentHotspot.significance;
  let displayMoranI = null;

  if (isLive) {
    if (analysisData?.isCompound) {
      if (selectedCell?.temp_slope !== undefined && selectedCell?.precip_slope !== undefined) {
        displayRate = `Temp ${selectedCell.temp_slope > 0 ? '+' : ''}${Number(selectedCell.temp_slope).toFixed(3)} °C/dec • Precip ${selectedCell.precip_slope > 0 ? '+' : ''}${Number(selectedCell.precip_slope).toFixed(3)}`;
        if (selectedCell.tau !== undefined) {
          domainMeanStr = `CAI Index: +${Number(selectedCell.tau).toFixed(2)}`;
        }
      } else if (selectedCell?.tau !== undefined) {
        displayRate = `CAI: +${Number(selectedCell.tau).toFixed(2)} (Aridification)`;
      }
    } else {
      const units = selectedCell?.slope_units || analysisData?.slope_units || '°C / decade';
      if (analysisData?.summary?.mean_slope !== undefined && analysisData?.summary?.mean_slope !== null) {
        const m = Number(analysisData.summary.mean_slope);
        domainMeanStr = `${m > 0 ? '+' : ''}${m.toFixed(4)} ${units}`;
      }

      if (selectedCell?.slope !== undefined && selectedCell?.slope !== null) {
        const s = Number(selectedCell.slope);
        displayRate = `${s > 0 ? '+' : ''}${s.toFixed(4)} ${units}`;
      } else if (domainMeanStr) {
        displayRate = domainMeanStr;
      }
    }

    // Live Significance
    if (analysisData?.isCompound) {
      if (selectedCell?.p_value !== undefined && selectedCell?.p_value !== null) {
        displaySignificance = `p = ${formatPVal(selectedCell.p_value)} (Copula Risk > 50yr)`;
      }
    } else {
      if (selectedCell?.p_value !== undefined && selectedCell?.p_value !== null) {
        const pStr = formatPVal(selectedCell.p_value);
        const qStr = formatPVal(selectedCell.q_value);
        displaySignificance = `p = ${pStr} (FDR q = ${qStr})`;
      } else if (analysisData?.summary?.significant_cells_fdr !== undefined) {
        displaySignificance = `${analysisData.summary.significant_cells_fdr} / ${analysisData.summary.total_cells} cells sig (FDR)`;
      }
    }

    // Live Moran's I
    const moranObj = analysisData?.summary?.spatial_autocorrelation;
    if (moranObj && moranObj.moran_i !== undefined && moranObj.moran_i !== null) {
      const mVal = Number(moranObj.moran_i);
      displayMoranI = `${mVal.toFixed(3)}${moranObj.is_clustered ? ' (Clustered)' : ''}`;
    }
  }

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

          <div className="mb-3 bg-[var(--color-bg-elevated)] p-2.5 rounded border border-[var(--color-border-subtle)] text-xs font-mono space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-border-subtle)] text-[10px]">
              <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                {isLive ? 'Live Statistical Telemetry' : 'Estimated Baseline'}
              </span>
              {isLive ? (
                <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE COMPUTED
                </span>
              ) : (
                <span className="text-[9px] text-amber-400/80 flex items-center gap-1 font-mono">
                  {isLoading ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      COMPUTING...
                    </>
                  ) : (
                    'PRESET PLACEHOLDER'
                  )}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-[var(--color-text-muted)] block uppercase tracking-wider">
                  {isLive && selectedCell?.slope !== undefined ? 'Cell Slope' : 'Rate / Slope'}
                </span>
                <span className="text-[#f59e0b] font-semibold block leading-tight">
                  {displayRate}
                </span>
                {domainMeanStr && (
                  <span className="text-[9px] text-[var(--color-text-muted)] block mt-0.5">
                    Domain mean: {domainMeanStr}
                  </span>
                )}
              </div>
              <div>
                <span className="text-[9px] text-[var(--color-text-muted)] block uppercase tracking-wider">
                  Significance
                </span>
                <span className="text-emerald-500 font-semibold block leading-tight">
                  {displaySignificance}
                </span>
              </div>
            </div>

            {displayMoranI !== null && displayMoranI !== undefined && (
              <div className="pt-1.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[10px]">
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">
                  Spatial Autocorrelation
                </span>
                <span className="text-[var(--color-accent-blue)] font-semibold">
                  Global Moran's I = {displayMoranI}
                </span>
              </div>
            )}
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
