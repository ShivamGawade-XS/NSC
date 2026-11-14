/**
 * Tellura — Earth System Trend Detective Guided Wizard
 * A friendly 3-step interactive Q&A workflow designed for high school students,
 * college researchers, and hackathon judges to formulate scientific hypotheses
 * and discover verified trends across authentic NASA Earth observations.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

const DETECTIVE_MYSTERIES = [
  {
    id: 'heat',
    icon: '🌡️',
    title: 'Surface Heat Acceleration',
    variable: 'T2M',
    dataset: 'nasa_power',
    isCompound: false,
    tagline: 'Are extreme heatwaves or baseline surface air temperatures rising?',
    eli5: 'Investigates 2-meter air temperature—the ambient heat humans, livestock, and ecosystems physically feel.',
    missions: 'Assimilated from MODIS (Terra/Aqua), AIRS, and NASA GEOS-5 FP-IT.',
  },
  {
    id: 'rain',
    icon: '🌧️',
    title: 'Rainfall Shifts & Deluges',
    variable: 'PRECTOTCORR',
    dataset: 'nasa_power',
    isCompound: false,
    tagline: 'Is precipitation intensifying or declining across croplands?',
    eli5: 'Tracks daily rain and snowfall rates, mathematically corrected for rain-gauge wind undercatch.',
    missions: 'Global Precipitation Measurement (GPM) & MERRA-2 meteorological grids.',
  },
  {
    id: 'solar',
    icon: '☀️',
    title: 'Solar Energy & Cloud Thinning',
    variable: 'ALLSKY_SFC_SW_DWN',
    dataset: 'nasa_power',
    isCompound: false,
    tagline: 'Is sunlight reaching the surface brightening or dimming?',
    eli5: 'Measures total incoming solar energy under real all-sky cloud conditions, powering solar panels and photosynthesis.',
    missions: 'Clouds and the Earth\'s Radiant Energy System (CERES) & GEWEX SRB.',
  },
  {
    id: 'wind',
    icon: '💨',
    title: 'Atmospheric Winds & Jet Stream',
    variable: 'WS10M',
    dataset: 'nasa_power',
    isCompound: false,
    tagline: 'Are surface wind speeds accelerating or undergoing atmospheric stilling?',
    eli5: 'Analyzes 10-meter wind velocity (two-story building height) controlling turbulent evaporation and wind turbines.',
    missions: 'NASA GMAO GEOS-5 FP-IT assimilation system.',
  },
  {
    id: 'moisture',
    icon: '💧',
    title: 'Atmospheric Thirst (Humidity)',
    variable: 'RH2M',
    dataset: 'nasa_power',
    isCompound: false,
    tagline: 'Is atmospheric air drying out, escalating wildfire risk?',
    eli5: 'Monitors 2-meter relative humidity percentage to measure atmospheric dryness and vegetation fuel moisture.',
    missions: 'NASA GMAO GEOS-5 FP-IT atmospheric boundary layer model.',
  },
  {
    id: 'compound',
    icon: '🌵',
    title: 'Compound Aridification (Heat + Drought)',
    variable: 'T2M',
    dataset: 'merra2_reanalysis',
    isCompound: true,
    tagline: 'Are rising temperatures coupling with falling rain to drive megadroughts?',
    eli5: 'Uses Archimedean Copulas to calculate the joint return period of concurrent severe heat and rainfall suppression.',
    missions: 'NASA MERRA-2 Atmospheric Reanalysis (GMAO GEOS-5).',
  },
];

const DETECTIVE_REGIONS = [
  {
    id: 'plains',
    name: 'Southern Great Plains (Texas Basin)',
    bbox: [-102.0, 30.0, -94.0, 38.0],
    center: [34.0, -98.0],
    desc: 'Subtropical heat dome acceleration & agricultural cropland stress.',
  },
  {
    id: 'southwest',
    name: 'Southwestern US & Colorado Basin',
    bbox: [-114.0, 31.0, -108.0, 37.0],
    center: [34.0, -111.0],
    desc: 'Multidecadal megadrought, reservoir depletion, and compound aridification.',
  },
  {
    id: 'midwest',
    name: 'Midwest Agricultural Belt',
    bbox: [-100.0, 32.0, -92.0, 40.0],
    center: [36.0, -96.0],
    desc: 'Hydrological regime shifts and intensified precipitation variability.',
  },
  {
    id: 'continental',
    name: 'North American Continental Domain',
    bbox: [-125.0, 25.0, -65.0, 50.0],
    center: [38.0, -95.0],
    desc: 'Macro-scale continental synoptic warming and polar-equatorial gradient shifts.',
  },
  {
    id: 'gulf_contrasts',
    name: 'Gulf Coastline & Inland Divergence',
    bbox: [-104.0, 26.0, -92.0, 36.0],
    center: [31.0, -98.0],
    desc: 'Opposing synoptic contrasts: intense inland heating vs marine boundary buffering.',
  },
];

const DETECTIVE_HORIZONS = [
  {
    id: 'modern',
    start: 2000,
    end: 2023,
    label: 'Modern Satellite Era (2000–2023)',
    years: 24,
    desc: '24 years of high-resolution calibrated CERES, MODIS, and MERRA-2 overpasses.',
  },
  {
    id: 'deep',
    start: 1980,
    end: 2023,
    label: 'Deep Multi-Decadal Baseline (1980–2023)',
    years: 44,
    desc: '44 years of continuous atmospheric reanalysis tracking long-term climate drift.',
  },
];

export default function DetectiveWizardModal() {
  const isOpen = useStore((s) => s.detectiveWizardModalOpen);
  const setOpen = useStore((s) => s.setDetectiveWizardModalOpen);
  const setFormField = useStore((s) => s.setFormField);
  const setBbox = useStore((s) => s.setBbox);
  const executeAnalysis = useStore((s) => s.executeAnalysis);
  const executeCompoundAnalysis = useStore((s) => s.executeCompoundAnalysis);

  const [selectedMystery, setSelectedMystery] = useState(DETECTIVE_MYSTERIES[0]);
  const [selectedRegion, setSelectedRegion] = useState(DETECTIVE_REGIONS[0]);
  const [selectedHorizon, setSelectedHorizon] = useState(DETECTIVE_HORIZONS[0]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  const handleLaunchInvestigation = () => {
    playTactileClick(850);
    const { dataset, variable, isCompound } = selectedMystery;
    const { bbox } = selectedRegion;
    const { start, end } = selectedHorizon;

    // Apply parameters to store
    setFormField('dataset', dataset);
    setFormField('variable', variable);
    setFormField('startYear', start);
    setFormField('endYear', end);
    setFormField('useFdr', true);

    setBbox({
      minLon: String(bbox[0]),
      minLat: String(bbox[1]),
      maxLon: String(bbox[2]),
      maxLat: String(bbox[3]),
    });

    setOpen(false);
    playTelemetryChime();

    toast.success(`Detective Investigation Launched: ${selectedMystery.title} (${selectedRegion.name})`, {
      icon: '🕵️',
      duration: 4000,
    });

    // Execute appropriate analysis
    if (isCompound) {
      executeCompoundAnalysis();
    } else {
      executeAnalysis();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative w-full max-w-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-accent-blue)]/10 border border-[var(--color-accent-blue)]/30 flex items-center justify-center text-xl shrink-0">
                🕵️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold font-['Space_Grotesk'] text-[var(--color-text-main)]">
                    Earth System Trend Detective
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-accent-blue)] text-white">
                    NASA 2026 Challenge
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Answer 3 simple questions to investigate real multi-decadal changes in NASA satellite observations.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                playTactileClick(600);
                setOpen(false);
              }}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] p-1.5 rounded-lg hover:bg-[var(--color-bg-surface)] transition-colors"
              aria-label="Close detective wizard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-6">
            {/* Step 1: Earth Science Mystery */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-accent-blue)] text-white font-mono text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <label className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--color-text-main)]">
                  What Earth System Mystery are you investigating?
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {DETECTIVE_MYSTERIES.map((m) => {
                  const isSelected = selectedMystery.id === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        playTactileClick(700);
                        setSelectedMystery(m);
                      }}
                      className={`text-left p-3 rounded-lg border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/5 shadow-xs ring-1 ring-[var(--color-accent-blue)]'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-lg">{m.icon}</span>
                        <div className="font-bold text-xs text-[var(--color-text-main)] leading-tight">
                          {m.title}
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                        {m.tagline}
                      </p>
                      <div className="mt-2 text-[9px] font-mono text-[var(--color-accent-blue)] flex items-center justify-between">
                        <span>{m.variable} {m.isCompound ? '(Dual Hazard)' : ''}</span>
                        {isSelected && <span className="font-bold">✓ Selected</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Explainer Card for Selected Mystery */}
              <div className="mt-2.5 p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-xs space-y-1">
                <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-text-main)]">
                  <span className="text-amber-500">💡 Detective Clue:</span>
                  <span>{selectedMystery.eli5}</span>
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
                  Satellite Instrument / Model: {selectedMystery.missions}
                </div>
              </div>
            </div>

            {/* Step 2: Investigation Zone */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-accent-blue)] text-white font-mono text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <label className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--color-text-main)]">
                  Where is your investigation target zone?
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DETECTIVE_REGIONS.map((r) => {
                  const isSelected = selectedRegion.id === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        playTactileClick(700);
                        setSelectedRegion(r);
                      }}
                      className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/5 ring-1 ring-[var(--color-accent-blue)]'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[var(--color-text-main)]">
                          {r.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono font-bold text-[var(--color-accent-blue)]">
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                        {r.desc}
                      </p>
                      <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-1">
                        BBox: [{r.bbox.join(', ')}]
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Investigation Horizon */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-[var(--color-accent-blue)] text-white font-mono text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <label className="text-xs font-mono uppercase tracking-wider font-bold text-[var(--color-text-main)]">
                  Over what observation time horizon?
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DETECTIVE_HORIZONS.map((h) => {
                  const isSelected = selectedHorizon.id === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => {
                        playTactileClick(700);
                        setSelectedHorizon(h);
                      }}
                      className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--color-accent-blue)] bg-[var(--color-accent-blue)]/5 ring-1 ring-[var(--color-accent-blue)]'
                          : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-text-muted)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-[var(--color-text-main)]">
                          {h.label}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-semibold">
                          {h.years} Years
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                        {h.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer & Launch Action */}
          <div className="px-5 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-mono text-[var(--color-text-secondary)] text-center sm:text-left">
              <span className="font-bold text-[var(--color-text-main)]">Hypothesis:</span>{' '}
              {selectedMystery.title} in {selectedRegion.name} ({selectedHorizon.start}–{selectedHorizon.end})
            </div>

            <button
              type="button"
              onClick={handleLaunchInvestigation}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/90 text-white font-bold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Detective Investigation</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
