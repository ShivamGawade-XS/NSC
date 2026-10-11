import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

export const CASE_STUDY_HOTSPOTS = [
  {
    title: 'Arctic Polar Amplification',
    location: 'Svalbard Archipelago (78.2°N, 15.6°E)',
    coords: [78.2, 15.6],
    zoom: 5,
    variable: 'T2M (Surface Air Temp)',
    rate: '+1.420 °C / decade',
    significance: 'p < 0.0001 (FDR q = 0.0001)',
    mechanism: 'Surface albedo feedback and sea-ice extent retreat accelerating polar warming at approximately 3x the global rate.',
    missionCitation: 'NASA MERRA-2 Atmospheric Reanalysis (DOI: 10.5067/625DY05106QC)'
  },
  {
    title: 'Mediterranean Compound Aridification',
    location: 'Central Mediterranean (37.5°N, 14.2°E)',
    coords: [37.5, 14.2],
    zoom: 5,
    variable: 'Compound Hazard (T2M + PRECTOT)',
    rate: 'CAI Index: +2.18 (Severe Drying)',
    significance: 'Copula Joint Return Period > 50 Years',
    mechanism: 'Subtropical anticyclonic ridge persistence driving coupled thermodynamic warming and convective precipitation suppression.',
    missionCitation: 'NASA POWER Daily Climatology (GMAO FP-IT)'
  },
  {
    title: 'Amazon Moisture Redistribution',
    location: 'Western Amazonia (-3.4°S, -62.2°W)',
    coords: [-3.4, -62.2],
    zoom: 5,
    variable: 'PRECTOT (Precipitation Deficit)',
    rate: '-0.380 mm/day / decade',
    significance: 'Pettitt Changepoint: 2005 Regime Shift',
    mechanism: 'Suppression of deep convective moisture recycling during dry-season transitions.',
    missionCitation: 'NASA EOSDIS SMAP / MERRA-2'
  },
  {
    title: 'Sahel Transition Zone Hydrological Dipole',
    location: 'Sahel Belt (14.5°N, 5.0°E)',
    coords: [14.5, 5.0],
    zoom: 5,
    variable: 'PRECTOT (Convective Pluvial)',
    rate: '+0.290 mm/day / decade',
    significance: 'p = 0.0024 (FDR Significant)',
    mechanism: 'Intertropical Convergence Zone (ITCZ) mean northward shift enhancing West African monsoon penetration.',
    missionCitation: 'NASA Goddard Earth Sciences Data & Services'
  },
  {
    title: 'Southwestern North America Aridification',
    location: 'Colorado River Basin (34.0°N, -111.0°W)',
    coords: [34.0, -111.0],
    zoom: 5,
    variable: 'T2M + PRECTOT Compound Extreme',
    rate: '+0.540 °C/dec warming with runoff reduction',
    significance: 'LISA Spatial Cluster: High-Low Outlier',
    mechanism: 'Atmospheric vapor pressure deficit surge compounding multidecadal hydrological deficit.',
    missionCitation: 'NASA POWER Climatology & GRACE Terrestrial Storage'
  }
];

export default function JudgeTourOverlay({ mapInstance }) {
  const isCaseStudyOpen = useStore((s) => s.isCaseStudyTourOpen ?? s.isJudgeTourActive);
  const step = useStore((s) => s.tourStepIndex ?? s.judgeTourStep ?? 0);
  const closeTour = useStore((s) => s.closeCaseStudyTour || s.stopJudgeTour);
  const nextStep = useStore((s) => s.nextCaseStudyStep || s.nextJudgeTourStep);

  const currentHotspot = CASE_STUDY_HOTSPOTS[step % CASE_STUDY_HOTSPOTS.length];

  const handleNext = () => {
    playTactileClick(750);
    const nextIdx = (step + 1) % CASE_STUDY_HOTSPOTS.length;
    nextStep();
    const target = CASE_STUDY_HOTSPOTS[nextIdx];
    if (mapInstance) {
      mapInstance.flyTo(target.coords, target.zoom, { duration: 2.2 });
    }
    playTelemetryChime();
  };

  const handleClose = () => {
    playTactileClick(500);
    closeTour();
  };

  if (!isCaseStudyOpen) return null;

  return (
    <AnimatePresence>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] w-[92%] max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: -15, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.98 }}
          className="bg-[#0B0E14]/95 border border-white/15 rounded-lg p-4 shadow-xl backdrop-blur-md text-white text-xs font-sans"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-[10px] font-mono tracking-wider text-blue-400 uppercase font-semibold">
                Curated Transect { (step % CASE_STUDY_HOTSPOTS.length) + 1 } of { CASE_STUDY_HOTSPOTS.length }
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-zinc-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 font-mono transition-colors"
            >
              Close
            </button>
          </div>

          {/* Anomaly Information */}
          <h3 className="text-sm font-bold text-white tracking-tight mb-0.5">
            {currentHotspot.title}
          </h3>
          <div className="text-[11px] text-zinc-400 font-mono mb-2.5">
            {currentHotspot.location}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2.5 bg-white/[0.02] p-2 rounded border border-white/10 text-xs font-mono">
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase">Estimated Rate</span>
              <span className="text-amber-300 font-semibold">{currentHotspot.rate}</span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase">Confidence Measure</span>
              <span className="text-emerald-400 font-semibold">{currentHotspot.significance}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed mb-2.5">
            {currentHotspot.mechanism}
          </p>

          <div className="text-[10px] text-zinc-500 font-mono mb-3 border-t border-white/5 pt-2">
            Reference: {currentHotspot.missionCitation}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500">Autonomous Camera Control</span>
            <button
              onClick={handleNext}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded transition-colors flex items-center gap-1 font-mono"
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
