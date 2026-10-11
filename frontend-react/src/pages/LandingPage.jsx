import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const METRICS = [
  { label: 'NASA Observations', val: '44+ Yrs', desc: 'POWER & MERRA-2 Continuous Coverage' },
  { label: 'Statistical Engine', val: 'Kendall τ', desc: 'Non-Parametric & Outlier-Resistant' },
  { label: 'Spatial Regimes', val: "LISA I", desc: 'Local Moran Hotspot / Coldspot Clustering' },
  { label: 'Verification', val: '0% Drift', desc: 'Deterministic Fallback & NetCDF-4 Standard' },
];

const FEATURES = [
  {
    iconName: 'trend',
    badge: 'Core Stat Engine',
    title: 'Mann-Kendall & Sen’s Slope',
    desc: "Rigorous non-parametric monotonic trend detection with Sen's robust slope estimator and Gilbert (1987) 95% confidence bounds that cannot be skewed by extreme weather outliers.",
  },
  {
    iconName: 'cluster',
    badge: 'Spatial Clustering',
    title: 'Anselin Local Moran’s I (LISA)',
    desc: 'Uncovers statistically verified spatial autocorrelation regimes: High-High warming hotspots, Low-Low cooling refugia, and anomalous spatial outliers with false discovery control.',
  },
  {
    iconName: 'hazard',
    badge: 'Multivariate Science',
    title: 'Compound Hazard Detection',
    desc: 'Bivariate temperature and precipitation engine calculating the Climate Aridification Index (CAI) to discover compounding drought and heat stresses simultaneously.',
  },
  {
    iconName: 'satellite',
    badge: 'Zero Synthetic Data',
    title: 'Direct NASA Earth Ingestion',
    desc: 'Live streaming from NASA POWER (LaRC) and MERRA-2 (GMAO) reanalysis APIs. Fully compliant with CF-1.8 NetCDF conventions for science reproducibility.',
  },
  {
    iconName: 'export',
    badge: 'Open Science',
    title: 'Peer-Review Ready Exports',
    desc: 'One-click publication packaging: CF-compliant NetCDF-4 grids, GeoJSON geospatial layers, executable Jupyter Notebooks, and comprehensive Markdown Science Dossiers.',
  },
  {
    iconName: 'document',
    badge: 'Attribution Briefing',
    title: 'Physical Attribution Synthesis',
    desc: 'Context-grounded natural language interpretations that strictly cite p-values, slopes, and sensor metadata. Deterministic fallback guarantees eliminate hallucinations.',
  },
];

function FeatureIcon({ name }) {
  if (name === 'trend') {
    return (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    );
  }
  if (name === 'cluster') {
    return (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    );
  }
  if (name === 'hazard') {
    return (
      <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    );
  }
  if (name === 'satellite') {
    return (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" />
      </svg>
    );
  }
  if (name === 'export') {
    return (
      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

const WORKFLOW = [
  {
    step: '01',
    phase: 'INGESTION',
    title: 'Select Region & Data Stream',
    desc: 'Pick your target coordinates or choose from NASA case study presets (Texas Heat, SW Drought, Continental US, Midwest Ag Belt).',
  },
  {
    step: '02',
    phase: 'COMPUTATION',
    title: 'Run Non-Parametric Analytics',
    desc: 'FastAPI computes Mann-Kendall statistics, Sen slope, Benjamini-Hochberg FDR correction (q ≤ 0.05), and Pettitt changepoints across all grid cells.',
  },
  {
    step: '03',
    phase: 'SPATIAL REGIMES',
    title: 'Cluster Autocorrelation & Hazards',
    desc: 'Queen-contiguity spatial weights calculate local Moran’s I to identify regional hotspots, compound climate hazards, and climate contrast pairs.',
  },
  {
    step: '04',
    phase: 'REPRODUCIBILITY',
    title: 'Export Science-Grade Dossier',
    desc: 'Inspect deep telemetry charts with confidence ribbons, and export NetCDF, GeoJSON, or full academic documentation for peer review.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050507] text-[#F8FAFC] selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#08080B]/80 backdrop-blur-xl border-b border-white/[0.08] px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00F0FF] to-[#3B82F6] flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="text-sm font-black text-[#050507]">ES</span>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight font-[var(--font-display)]">EarthSift</span>
              <span className="text-[10px] text-zinc-400 font-mono block leading-none">NASA Space Apps 2026</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/ShivamGawade-XS/NSC"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all font-mono"
            >
              <span>GitHub Repo</span>
              <span className="text-zinc-500">↗</span>
            </a>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold tracking-wide transition-all flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span>Analysis Workspace</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Subtle Background Radial */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Mission Badge */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-md bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs font-mono font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>NASA SPACE APPS CHALLENGE 2026 • OPERATIONAL CLIMATE WORKBENCH</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-[var(--font-display)] leading-[1.1] mb-6">
              Sifting Subtle Shifts in <br className="hidden sm:block" />
              <span className="text-blue-400">
                Earth’s Climate System
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-neutral-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              An evidence-first scientific workbench transforming raw NASA satellite reanalysis into rigorous,
              spatially-correlated trend discoveries and reproducible peer-review research.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span>Launch Analysis Workspace</span>
              </button>
              <a
                href="#features"
                className="w-full sm:w-auto px-6 py-3 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium transition-all text-center"
              >
                Scientific Specification ↓
              </a>
            </div>
          </motion.div>

          {/* Telemetry Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {METRICS.map((m, idx) => (
              <div
                key={idx}
                className="p-4 rounded-md bg-[#10141E] border border-neutral-800 text-left"
              >
                <div className="text-2xl font-bold font-mono text-blue-400 mb-1">{m.val}</div>
                <div className="text-xs font-semibold text-neutral-200 mb-0.5">{m.label}</div>
                <div className="text-[11px] text-neutral-400 leading-tight">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Feature Architecture */}
      <section id="features" className="py-24 px-6 border-t border-neutral-800 bg-[#0A0D14]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest block mb-2">Mathematical Formulation</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-[var(--font-display)] text-white mb-4">
              Built for Climate Scientists and Mission Researchers
            </h2>
            <p className="text-sm text-neutral-400">
              Every trendline is backed by non-parametric statistics, spatial weight matrices, and false discovery corrections.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                className="p-5 rounded-md bg-[#10141E] border border-neutral-800 hover:border-blue-500/40 transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-md bg-neutral-900 border border-neutral-800 shrink-0">
                      <FeatureIcon name={feat.iconName} />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Pipeline */}
      <section className="py-24 px-6 border-t border-neutral-800 bg-[#0A0D14]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono text-blue-400 uppercase tracking-widest block mb-2">Discovery Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-[var(--font-display)] text-white mb-4">
              From Raw Satellite Telemetry to Research Dossier
            </h2>
            <p className="text-sm text-neutral-400">
              A four-stage deterministic pipeline executing peer-reviewed methodology in seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {WORKFLOW.map((wf, idx) => (
              <div
                key={idx}
                className="p-5 rounded-md bg-[#10141E] border border-neutral-800 flex gap-4 items-start"
              >
                <div className="text-xl font-bold font-mono text-blue-400 bg-blue-950/40 px-3 py-1.5 rounded border border-blue-500/20 shrink-0">
                  {wf.step}
                </div>
                <div>
                  <div className="text-[10px] font-mono text-blue-400 tracking-wider mb-1">{wf.phase}</div>
                  <h4 className="text-sm font-bold text-white mb-1.5">{wf.title}</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">{wf.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 px-6 border-t border-neutral-800 bg-[#0A0D14]">
        <div className="max-w-4xl mx-auto rounded-lg p-8 sm:p-12 bg-[#10141E] border border-neutral-800 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-[var(--font-display)] text-white mb-3">
            Investigate Earth System Trends
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto mb-6">
            Access continuous NASA observations, compute spatial autocorrelation statistics, and generate reproducible scientific packages.
          </p>
          <div className="flex items-center justify-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wider uppercase transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span>Launch Analysis Workspace</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-neutral-800 text-center bg-[#07090E]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">ES</span>
            </div>
            <span className="text-xs font-bold text-neutral-300 font-[var(--font-display)]">EarthSift</span>
            <span className="text-xs text-neutral-500">• NASA Space Apps Challenge 2026</span>
          </div>
          <p className="text-xs text-neutral-500">
            CF-1.8 NetCDF4 • FastAPI + React + Leaflet • Mann-Kendall & Sen Slope
          </p>
          <div className="text-xs font-mono text-neutral-500">
            Engineered by Shivam Gawade
          </div>
        </div>
      </footer>
    </div>
  );
}
