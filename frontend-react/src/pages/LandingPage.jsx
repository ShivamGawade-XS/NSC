import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';

const METRICS = [
  { label: 'NASA Observations', val: '44+ Yrs', desc: 'POWER & MERRA-2 Continuous Coverage' },
  { label: 'Statistical Engine', val: 'Kendall τ', desc: 'Non-Parametric & Outlier-Resistant' },
  { label: 'Spatial Regimes', val: "LISA I", desc: 'Local Moran Hotspot / Coldspot Clustering' },
  { label: 'Verification', val: '0% Drift', desc: 'Deterministic Fallback & NetCDF-4 Standard' },
];

const FEATURES = [
  {
    icon: '🔬',
    badge: 'Core Stat Engine',
    title: 'Mann-Kendall & Sen’s Slope',
    desc: "Rigorous non-parametric monotonic trend detection with Sen's robust slope estimator and Gilbert (1987) 95% confidence bounds that cannot be skewed by extreme weather outliers.",
  },
  {
    icon: '📊',
    badge: 'Spatial Clustering',
    title: 'Anselin Local Moran’s I (LISA)',
    desc: 'Uncovers statistically verified spatial autocorrelation regimes: High-High warming hotspots, Low-Low cooling refugia, and anomalous spatial outliers with false discovery control.',
  },
  {
    icon: '🔥',
    badge: 'Multivariate Science',
    title: 'Compound Hazard Detection',
    desc: 'Bivariate temperature and precipitation engine calculating the Climate Aridification Index (CAI) to discover compounding drought and heat stresses simultaneously.',
  },
  {
    icon: '🛰️',
    badge: 'Zero Synthetic Data',
    title: 'Direct NASA Earth Ingestion',
    desc: 'Live streaming from NASA POWER (LaRC) and MERRA-2 (GMAO) reanalysis APIs. Fully compliant with CF-1.8 NetCDF conventions for science reproducibility.',
  },
  {
    icon: '📦',
    badge: 'Open Science',
    title: 'Peer-Review Ready Exports',
    desc: 'One-click publication packaging: CF-compliant NetCDF-4 grids, GeoJSON geospatial layers, executable Jupyter Notebooks, and comprehensive Markdown Science Dossiers.',
  },
  {
    icon: '🧠',
    badge: 'Guaranteed Grounding',
    title: 'Responsible AI Synthesis',
    desc: 'Context-grounded natural language interpretations that strictly cite p-values, slopes, and sensor metadata. Deterministic fallback guarantees eliminate hallucinations.',
  },
];

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
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00F0FF] to-[#3B82F6] text-[#050507] text-xs font-bold tracking-wide shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <span>⚡ Launch Console</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Glow Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-20 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Mission Badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>NASA SPACE APPS CHALLENGE 2026 • EARTH DETECTIVE</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-[var(--font-display)] leading-[1.1] mb-6">
              Sifting Subtle Shifts in <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-[#00F0FF] via-[#38BDF8] to-[#818CF8] bg-clip-text text-transparent">
                Earth’s Climate System
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              An evidence-first scientific workbench transforming raw NASA satellite reanalysis into rigorous,
              spatially-correlated trend discoveries and reproducible peer-review research.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#3B82F6] text-[#050507] font-bold text-sm tracking-wide shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>⚡ Open Mission Dashboard</span>
              </button>
              <a
                href="#features"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-zinc-200 text-sm font-medium transition-all text-center"
              >
                Explore Scientific Rigor ↓
              </a>
            </div>
          </motion.div>

          {/* Telemetry Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {METRICS.map((m, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#0B101B]/80 border border-white/[0.07] backdrop-blur-md text-left"
              >
                <div className="text-2xl font-black font-mono text-[#00F0FF] mb-1">{m.val}</div>
                <div className="text-xs font-semibold text-zinc-200 mb-0.5">{m.label}</div>
                <div className="text-[11px] text-zinc-500 leading-tight">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Feature Architecture */}
      <section id="features" className="py-24 px-6 border-t border-white/[0.06] bg-[#07090E]/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest block mb-2">Mathematical Foundation</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-[var(--font-display)] text-white mb-4">
              Built for Climate Scientists, Not Casual Observers
            </h2>
            <p className="text-sm text-zinc-400">
              Every trendline is backed by non-parametric statistics, spatial weight matrices, and false discovery corrections.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#0B101B]/90 border border-white/[0.08] hover:border-cyan-500/40 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-950/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] block">{feat.icon}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Pipeline */}
      <section className="py-24 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest block mb-2">Discovery Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold font-[var(--font-display)] text-white mb-4">
              From Raw Satellite Telemetry to Research Dossier
            </h2>
            <p className="text-sm text-zinc-400">
              A four-stage deterministic pipeline executing peer-reviewed methodology in seconds.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {WORKFLOW.map((wf, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#090C14] border border-white/[0.07] flex gap-5 items-start"
              >
                <div className="text-2xl font-black font-mono text-cyan-400/40 bg-cyan-400/5 px-3 py-1.5 rounded-lg border border-cyan-400/10 shrink-0">
                  {wf.step}
                </div>
                <div>
                  <div className="text-[10px] font-mono text-cyan-400 tracking-wider mb-1">{wf.phase}</div>
                  <h4 className="text-sm font-bold text-white mb-1.5">{wf.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{wf.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 px-6 border-t border-white/[0.06] bg-gradient-to-b from-[#080B12] to-[#050507]">
        <div className="max-w-4xl mx-auto rounded-3xl p-8 sm:p-12 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-purple-950/30 border border-cyan-500/20 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <h2 className="text-3xl sm:text-4xl font-extrabold font-[var(--font-display)] text-white mb-4">
            Investigate Earth System Trends Today
          </h2>
          <p className="text-sm text-zinc-300 max-w-xl mx-auto mb-8">
            Access real-time NASA observations, test spatial autocorrelation hypotheses, and export reproducible scientific artifacts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#3B82F6] text-[#050507] font-bold text-sm tracking-wide shadow-xl shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all"
            >
              Launch EarthSift Mission Console →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/[0.06] text-center bg-[#040406]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#00F0FF] to-[#3B82F6] flex items-center justify-center">
              <span className="text-[10px] font-black text-[#050507]">ES</span>
            </div>
            <span className="text-xs font-bold text-zinc-300 font-[var(--font-display)]">EarthSift</span>
            <span className="text-xs text-zinc-500">• NASA Space Apps Challenge 2026</span>
          </div>
          <p className="text-xs text-zinc-500">
            Open Source • CF-1.8 NetCDF4 • FastApi + React + Leaflet + Mann-Kendall
          </p>
          <div className="text-xs font-mono text-zinc-500">
            Engineered by Shivam Gawade
          </div>
        </div>
      </footer>
    </div>
  );
}
