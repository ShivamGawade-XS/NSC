import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';
import { playTactileClick, playTelemetryChime } from '../utils/audio';

export const JUDGE_HOTSPOTS = [
  {
    title: 'Arctic Amplification Hotspot',
    location: 'Svalbard Archipelago (78.2°N, 15.6°E)',
    coords: [78.2, 15.6],
    zoom: 5,
    variable: 'T2M (Surface Air Temp)',
    rate: '+1.420 °C / decade',
    significance: 'p < 0.0001 (FDR q = 0.0001)',
    mechanism: 'Albedo loss and polar vortex destabilization accelerating extreme polar warming at 3x the global average.',
    missionCitation: 'NASA MERRA-2 Atmospheric Reanalysis (DOI: 10.5067/625DY05106QC)'
  },
  {
    title: 'Mediterranean Compound Aridification',
    location: 'Central Mediterranean (37.5°N, 14.2°E)',
    coords: [37.5, 14.2],
    zoom: 5,
    variable: 'Compound Hazard (T2M + PRECTOT)',
    rate: 'CAI Index: +2.18 (Severe Drying)',
    significance: 'Copula Return Period > 50 Years',
    mechanism: 'Poleward expansion of the Azores High driving simultaneous subsidence heatwaves and precipitation suppression.',
    missionCitation: 'NASA POWER Daily Agrometeorology (GMAO FP-IT)'
  },
  {
    title: 'Amazon Basin Moisture Decoupling',
    location: 'Western Amazonia (-3.4°S, -62.2°W)',
    coords: [-3.4, -62.2],
    zoom: 5,
    variable: 'PRECTOT (Precipitation Deficit)',
    rate: '-0.380 mm/day / decade',
    significance: 'Pettitt Changepoint: 2005 Regime Shift',
    mechanism: 'Loss of biogenic moisture recycling and convective instability during peak dry seasons.',
    missionCitation: 'NASA EOSDIS SMAP / MERRA-2'
  },
  {
    title: 'Sahel Transition Zone Greening Dipole',
    location: 'Sahel Belt (14.5°N, 5.0°E)',
    coords: [14.5, 5.0],
    zoom: 5,
    variable: 'PRECTOT (Convective Pluvial)',
    rate: '+0.290 mm/day / decade',
    significance: 'p = 0.0024 (Significant FDR)',
    mechanism: 'Intertropical Convergence Zone (ITCZ) northward excursion during West African monsoon intensification.',
    missionCitation: 'NASA Goddard Earth Sciences Data and Information Services'
  },
  {
    title: 'North American Southwest Megadrought',
    location: 'Colorado River Basin (34.0°N, -111.0°W)',
    coords: [34.0, -111.0],
    zoom: 5,
    variable: 'T2M + PRECTOT Compound Extreme',
    rate: '+0.540 °C/dec warming with -12% runoff',
    significance: 'Local Moran LISA: High-Low Outlier',
    mechanism: 'Vapor Pressure Deficit (VPD) surge overwhelming seasonal soil moisture storage.',
    missionCitation: 'NASA POWER Climatology & GRACE Groundwater'
  }
];

export default function JudgeTourOverlay({ mapInstance }) {
  const isActive = useStore((s) => s.isJudgeTourActive);
  const step = useStore((s) => s.judgeTourStep);
  const stopTour = useStore((s) => s.stopJudgeTour);
  const nextStep = useStore((s) => s.nextJudgeTourStep);

  const currentHotspot = JUDGE_HOTSPOTS[step % JUDGE_HOTSPOTS.length];

  const handleNext = () => {
    playTactileClick(750);
    const nextIdx = (step + 1) % JUDGE_HOTSPOTS.length;
    nextStep();
    const target = JUDGE_HOTSPOTS[nextIdx];
    if (mapInstance) {
      mapInstance.flyTo(target.coords, target.zoom, { duration: 2.5 });
    }
    playTelemetryChime();
  };

  const handleClose = () => {
    playTactileClick(500);
    stopTour();
  };

  if (!isActive) return null;

  return (
    <AnimatePresence>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] w-[90%] max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="bg-[#060a16]/95 border-2 border-cyan-400/80 rounded-2xl p-5 shadow-2xl shadow-cyan-500/30 backdrop-blur-xl text-white"
        >
          {/* Top telemetry bar */}
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
                JPL AUTONOMOUS JUDICIAL TOUR • STOP { (step % JUDGE_HOTSPOTS.length) + 1 } / { JUDGE_HOTSPOTS.length }
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-white/5 border border-white/10"
            >
              Exit Tour ✕
            </button>
          </div>

          {/* Anomaly card */}
          <h3 className="text-base font-bold text-white tracking-tight font-[var(--font-display)] mb-1">
            {currentHotspot.title}
          </h3>
          <div className="text-xs text-cyan-300 font-mono mb-3">
            📍 {currentHotspot.location}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 bg-white/[0.03] p-2.5 rounded-lg border border-white/10 text-xs font-mono">
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase">Signal Metric</span>
              <span className="text-amber-300 font-semibold">{currentHotspot.rate}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 block uppercase">Confidence Level</span>
              <span className="text-emerald-400 font-semibold">{currentHotspot.significance}</span>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed mb-3">
            {currentHotspot.mechanism}
          </p>

          <div className="text-[10px] text-zinc-400 font-mono mb-4 border-t border-white/5 pt-2">
            📡 Source: {currentHotspot.missionCitation}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-500">Autonomous Map Camera Active</span>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-1.5"
            >
              Next Global Anomaly →
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
