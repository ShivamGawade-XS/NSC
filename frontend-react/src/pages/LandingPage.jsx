import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import StickyMobileCTA from '../components/StickyMobileCTA';
import MathFormula from '../components/MathFormula';
import WorkstationHeroPreview from '../components/WorkstationHeroPreview';
import useStore from '../store/useStore';
import { playTactileClick } from '../utils/audio';
import { trackPageView } from '../utils/analytics';
import { usePageMetadata } from '../utils/usePageMetadata';

const SPEC_METRICS = [
  { label: 'Observation Record', val: '1981–Present', desc: '44+ years of continuous NASA POWER & MERRA-2 reanalysis' },
  { label: 'Statistical Engine', val: 'Mann-Kendall τ', desc: 'Rank-based non-parametric tests resistant to extreme anomalies' },
  { label: 'Spatial Regimes', val: 'Anselin LISA', desc: 'Queen-contiguity spatial weights identifying regional clusters' },
  { label: 'Reproducibility', val: 'CF-1.8 NetCDF', desc: 'Standard NetCDF-4, GeoJSON, and executable Jupyter verification' },
];

const SCIENTIFIC_FORMULATIONS = [
  {
    title: 'Mann-Kendall Monotonic Rank Test',
    formula: 'S = \\sum_{k=1}^{n-1} \\sum_{j=k+1}^n \\operatorname{sgn}(x_j - x_k)',
    description: 'Evaluates whether an atmospheric or surface variable monotonically increases or decreases over multi-decadal time spans without assuming underlying normal distributions.',
    citation: 'Mann (1945), Kendall (1975)',
  },
  {
    title: 'Theil-Sen Robust Slope Estimator',
    formula: '\\beta = \\operatorname{median}\\left( \\frac{x_j - x_k}{j - k} \\right), \\quad 1 \\le k < j \\le n',
    description: 'Computes the median of all pairwise temporal slopes, providing a rate estimate with Gilbert (1987) 95% confidence intervals unskewed by extreme outliers.',
    citation: 'Sen (1968), Theil (1950)',
  },
  {
    title: 'Anselin Local Moran’s I (LISA)',
    formula: 'I_i = \\frac{x_i - \\bar{x}}{s^2} \\sum_{j=1}^N w_{ij} (x_j - \\bar{x})',
    description: 'Uncovers statistically verified spatial autocorrelation regimes: High-High warming hotspots, Low-Low cooling refugia, and anomalous spatial outliers.',
    citation: 'Anselin (1995), Geographical Analysis',
  },
  {
    title: 'Benjamini-Hochberg FDR Control',
    formula: 'P_{(k)} \\le \\frac{k}{m} \\cdot Q, \\quad Q = 0.05',
    description: 'Controls the expected false discovery rate across thousands of simultaneous spatial grid tests, eliminating false positive hotspots.',
    citation: 'Benjamini & Hochberg (1995)',
  },
  {
    title: 'Climate Aridification Index (CAI)',
    formula: '\\mathrm{CAI} = z(\\Delta T) - z(\\Delta P)',
    description: 'Coupled bivariate processing identifying compound drought-heat hazards where rising temperatures coincide with declining precipitation.',
    citation: 'Zscheischler et al. (2020), Nature Climate Change',
  },
  {
    title: 'Climate Velocity Vectors',
    formula: '\\mathbf{v} = \\frac{\\partial T / \\partial t}{\\|\\nabla T\\|}',
    description: 'Calculates the rate and direction (km/decade) an isotherm moves across the landscape, measuring regional climate displacement pressure.',
    citation: 'Burrows et al. (2011), Science',
  },
];

const PIPELINE_STAGES = [
  {
    step: '01',
    layer: 'Stage 1 • Ingestion',
    title: 'Observational Data Ingestion',
    specs: 'NASA POWER (LaRC) & MERRA-2 (GMAO)',
    desc: 'Direct programmatic retrieval of daily surface meteorology, air temperatures, precipitation rates, and irradiance across user-defined coordinate bounds.',
    throughput: '< 850ms latency',
    format: 'HDF5 / NetCDF / OPeNDAP',
  },
  {
    step: '02',
    layer: 'Stage 2 • Core Mathematics',
    title: 'Vectorized Non-Parametric Engine',
    specs: 'SciPy & NumPy Vectorized Architecture',
    desc: 'Calculates Kendall test statistic S, variance correction for tied values, Sen’s median slope, Pettitt regime changepoints, and exact two-tailed p-values.',
    throughput: 'O(N log N) vectorized',
    format: 'NumPy Structured Arrays',
  },
  {
    step: '03',
    layer: 'Stage 3 • Spatial Regimes',
    title: 'Spatial Autocorrelation Analysis',
    specs: 'Queen-Contiguity Spatial Matrix',
    desc: 'Quantifies spatial clustering with Anselin Local Moran’s I, categorizing cells into High-High, Low-Low, High-Low, and Low-High regimes under FDR control.',
    throughput: 'Monte Carlo permutations',
    format: 'GeoJSON RFC 7946',
  },
  {
    step: '04',
    layer: 'Stage 4 • Packaging',
    title: 'CF-1.8 & LaTeX Technical Record',
    specs: 'NetCDF-4 • GeoJSON • IEEE LaTeX',
    desc: 'Generates multidimensional NetCDF-4 binaries, RFC 7946 GeoJSON layers, executable Jupyter Notebooks, and IEEE/AGU LaTeX Technical Memorandums.',
    throughput: 'Deterministic compilation',
    format: 'CF-1.8 NetCDF-4 / .tex',
  },
];

const CASE_STUDIES = [
  {
    key: 'case1',
    title: 'Texas Thermal Basin',
    dataset: 'NASA POWER Synoptic',
    variable: 'T2M Surface Air Temperature',
    window: '2000–2023',
    trend: '+0.48 °C / decade',
    regime: 'Hotspot Regime (High-High)',
    coords: '26.0°N to 36.5°N, -106.5°E to -93.5°E',
    badgeClr: '#ef4444',
  },
  {
    key: 'case2',
    title: 'Southwest Arid Transect',
    dataset: 'MERRA-2 Reanalysis',
    variable: 'Compound Hazard (T + P)',
    window: '2000–2020',
    trend: 'CAI: +2.18 Severity',
    regime: 'Compound Aridification Stress',
    coords: '31.0°N to 37.0°N, -114.0°E to -108.0°E',
    badgeClr: '#f59e0b',
  },
  {
    key: 'case3',
    title: 'Continental CONUS Transect',
    dataset: 'MERRA-2 Reanalysis',
    variable: 'T2M Surface Air Temperature',
    window: '1990–2023',
    trend: 'Macro-Scale Footprint',
    regime: 'Synoptic Continental Regimes',
    coords: '25.0°N to 49.0°N, -125.0°E to -67.0°E',
    badgeClr: '#2b7fff',
  },
  {
    key: 'case4',
    title: 'Midwest Agricultural Belt',
    dataset: 'NASA POWER Synoptic',
    variable: 'PRECTOTCORR Precipitation',
    window: '2000–2023',
    trend: '+0.31 mm/day / decade',
    regime: 'Hydrological Shift Zone',
    coords: '37.0°N to 46.0°N, -97.0°E to -83.0°E',
    badgeClr: '#06b6d4',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  usePageMetadata({
    title: 'Tellura — Spatiotemporal Climate Trend Discovery System | NASA Space Apps 2026',
    description: 'Autonomous spatial trend discovery workstation detecting non-parametric Mann-Kendall climate trends and Anselin LISA spatial autocorrelation across 44 years of continuous NASA Earth observations.',
    canonicalPath: '/',
  });

  useEffect(() => {
    trackPageView('Overview Landing Page');
    window.scrollTo(0, 0);
  }, []);

  const handleLaunchPreset = (key) => {
    playTactileClick(800);
    useStore.getState().loadPreset(key);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] transition-colors">
      <Header />

      <main className="pt-14">
        {/* Editorial Hero Section */}
        <section className="relative py-12 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--color-border-subtle)]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Dignified Institutional Attribution Header */}
              <div className="flex items-center gap-2.5 text-xs font-mono tracking-wider text-[var(--color-text-secondary)] uppercase mb-6 font-medium">
                <img
                  src="/tellura_icon.png"
                  alt="Tellura emblem"
                  className="w-5 h-5 rounded object-contain shrink-0 hidden dark:block"
                  width="20"
                  height="20"
                />
                <img
                  src="/tellura_icon_light.png"
                  alt="Tellura emblem"
                  className="w-5 h-5 rounded object-contain shrink-0 block dark:hidden"
                  width="20"
                  height="20"
                />
                <span>NASA Space Apps Challenge 2026</span>
                <span className="text-[var(--color-border-strong)]">/</span>
                <span>Earth Observation Systems</span>
              </div>

              {/* Confident, Academic Scientific Headline */}
              <h1 className="font-['Space_Grotesk'] text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[var(--color-text-main)] leading-[1.12] mb-6 max-w-4xl">
                Statistical Detection of Multi-Decadal Trends in NASA Earth System Data
              </h1>

              {/* Precise Scientific Summary */}
              <p className="text-base sm:text-lg text-[var(--color-text-secondary)] max-w-3xl leading-relaxed mb-8 font-normal">
                An open-science workstation computing non-parametric Mann-Kendall monotonic trends, Theil-Sen robust slopes, and Anselin Local Moran’s spatial autocorrelation regimes across 44 years of NASA POWER and MERRA-2 observations.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <button
                  onClick={() => {
                    playTactileClick(800);
                    navigate('/dashboard');
                  }}
                  className="interface-btn-primary !py-3 !px-6 !text-xs !tracking-wider uppercase font-semibold"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <span>Launch Analysis Workspace</span>
                </button>
                <a
                  href="#formulations"
                  className="interface-btn-secondary !py-3 !px-6 !text-xs !tracking-wider uppercase font-medium text-center"
                >
                  Mathematical Formulations ↓
                </a>
              </div>

              {/* Authentic Workstation Live Preview */}
              <WorkstationHeroPreview />
            </motion.div>

            {/* Scientific Parameters Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 mt-10 border-t border-[var(--color-border-subtle)]">
              {SPEC_METRICS.map((m, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-accent-blue)] tabular-nums">
                    {m.val}
                  </div>
                  <div className="text-xs font-semibold text-[var(--color-text-main)] font-['Space_Grotesk']">
                    {m.label}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    {m.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guided Regional Transects (Case Studies) */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-4 border-b border-[var(--color-border-subtle)]">
              <div>
                <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text-main)]">
                  Regional Climate Transect Dossiers
                </h2>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-md font-mono">
                Load calibrated regional bounding boxes to inspect spatial autocorrelation regimes and multi-decadal slope distributions.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CASE_STUDIES.map((c) => (
                <div
                  key={c.key}
                  className="p-5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col justify-between hover:border-[var(--color-border-strong)] transition-all group shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[var(--color-accent-blue)] font-semibold">{c.window}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[120px]">{c.dataset}</span>
                    </div>

                    <div>
                      <h3 className="font-['Space_Grotesk'] text-base font-bold text-[var(--color-text-main)] mb-1">
                        {c.title}
                      </h3>
                      <div className="text-xs text-[var(--color-text-secondary)] font-mono">
                        {c.variable}
                      </div>
                    </div>

                    <div className="p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] font-mono text-xs">
                      <div className="text-[10px] text-[var(--color-text-secondary)] uppercase mb-0.5">Calculated Trend</div>
                      <div className="text-sm font-bold text-[var(--color-text-main)]">{c.trend}</div>
                      <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.badgeClr }} />
                        <span className="truncate">{c.regime}</span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-[var(--color-text-secondary)] truncate" title={c.coords}>
                      {c.coords}
                    </div>
                  </div>

                  <button
                    onClick={() => handleLaunchPreset(c.key)}
                    className="w-full mt-4 interface-btn-secondary !text-xs !py-2 justify-center font-mono cursor-pointer"
                  >
                    <span>Inspect Transect</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]" aria-hidden="true">→</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Rigorous Mathematical Formulations with KaTeX */}
        <section id="formulations" className="py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-3xl mb-12">
              <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text-main)] mb-3">
                Deterministic Mathematical Engine
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Tellura rejects ungrounded machine learning approximations for physical quantities. Every observation cell is evaluated using deterministically proven non-parametric mathematics, spatial weighting matrices, and false discovery controls.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCIENTIFIC_FORMULATIONS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <h3 className="font-['Space_Grotesk'] text-sm font-bold text-[var(--color-text-main)] mb-3">
                      {item.title}
                    </h3>
                    <div className="p-3 rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] mb-3 overflow-x-auto text-[var(--color-accent-blue)]">
                      <MathFormula formula={item.formula} />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-4">
                      {item.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-muted)]">
                    Ref: {item.citation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reproducibility Architecture Matrix */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl mb-12">
              <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text-main)] mb-3">
                End-to-End Scientific Data Pipeline
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                From raw reanalysis data streams to publication-grade CF-1.8 NetCDF packages and IEEE/AGU LaTeX Technical Memorandums.
              </p>
            </div>

            <div className="space-y-3">
              {PIPELINE_STAGES.map((stg, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="flex items-start gap-4">
                    <span className="w-8 h-8 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-xs font-mono font-bold flex items-center justify-center shrink-0 text-[var(--color-accent-blue)]">
                      {stg.step}
                    </span>
                    <div className="space-y-1 max-w-xl">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent-blue)] block font-semibold">
                        {stg.layer}
                      </span>
                      <h3 className="font-['Space_Grotesk'] text-base font-bold text-[var(--color-text-main)]">
                        {stg.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {stg.desc}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-1 shrink-0 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-main)]">
                      {stg.specs}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {stg.throughput} • {stg.format}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Launchpad Banner */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-bg-deep)]">
          <div className="max-w-4xl mx-auto rounded-xl p-8 sm:p-12 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-center shadow-md">
            <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold text-[var(--color-text-main)] mb-3">
              Explore Observational Trends
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xl mx-auto mb-8 leading-relaxed font-mono">
              Query multi-decadal NASA reanalysis, compute non-parametric Kendall τ slopes, inspect Anselin LISA clusters, and export CF-1.8 NetCDF packages.
            </p>
            <div className="flex items-center justify-center">
              <button
                onClick={() => {
                  playTactileClick(800);
                  navigate('/dashboard');
                }}
                className="interface-btn-primary !py-3 !px-6 !text-xs !tracking-wider uppercase font-semibold cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <span>Launch Analysis Workspace</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <StickyMobileCTA mode="landing" />
      <Footer />
    </div>
  );
}
