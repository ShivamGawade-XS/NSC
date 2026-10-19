import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)] py-12 px-4 sm:px-6 text-[var(--color-text-secondary)] text-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        {/* Left: Brand & Tagline */}
        <div className="space-y-2 max-w-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-[var(--color-accent-blue)] flex items-center justify-center text-white font-mono font-bold text-[10px]">
              ES
            </div>
            <span className="font-['Space_Grotesk'] font-bold text-sm text-[var(--color-text-main)]">
              EarthSift
            </span>
            <span className="text-[10px] font-mono text-[var(--color-text-muted)] tracking-wider">
              Earth System Trend Instrument
            </span>
          </div>
          <p className="text-[var(--color-text-muted)] text-[11px] leading-relaxed">
            Evidence-first scientific workbench discovering statistically defensible trends in NASA MERRA-2 and POWER Earth-system data.
          </p>
        </div>

        {/* Center: Standards & Methodology */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
          <div>
            <span className="text-[var(--color-text-muted)] block uppercase tracking-wider text-[9px] mb-1">Standards</span>
            <span className="text-[var(--color-text-main)]">CF-1.8 NetCDF-4</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block uppercase tracking-wider text-[9px] mb-1">Statistics</span>
            <span className="text-[var(--color-text-main)]">Mann-Kendall & Sen Slope</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block uppercase tracking-wider text-[9px] mb-1">Spatial Engine</span>
            <span className="text-[var(--color-text-main)]">Anselin Local Moran's I</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted)] block uppercase tracking-wider text-[9px] mb-1">False Discovery</span>
            <span className="text-[var(--color-text-main)]">Benjamini-Hochberg (q ≤ 0.05)</span>
          </div>
        </div>

        {/* Right: Quick Links */}
        <div className="flex flex-wrap items-center gap-5 font-mono text-[11px]">
          <Link to="/" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors">
            Overview
          </Link>
          <Link to="/dashboard" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors">
            Workspace
          </Link>
          <Link to="/privacy" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors">
            Terms
          </Link>
          <a
            href="https://github.com/ShivamGawade-XS/NSC"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors flex items-center gap-1"
          >
            <span>GitHub</span>
            <span className="text-[var(--color-text-muted)]" aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] text-[var(--color-text-muted)] font-mono">
        <div>
          NASA Space Apps Challenge 2026 • “Be an Earth System Trend Detective”
        </div>
        <div>
          Engineered by Shivam Gawade • Open Science Research
        </div>
      </div>
    </footer>
  );
}
