import { useState } from 'react';
import { Link } from 'react-router-dom';
import ContactModal from './ContactModal';
import { playTactileClick } from '../utils/audio';

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)] py-12 px-4 sm:px-6 text-[var(--color-text-secondary)] text-xs transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        {/* Left: Brand & Tagline */}
        <div className="space-y-3 max-w-sm">
          <Link to="/" className="inline-block" aria-label="Tellura Home">
            <img
              src="/tellura_primary_lockup_transparent.png"
              alt="Tellura — Planetary Intelligence"
              className="h-7 sm:h-8 w-auto object-contain brightness-0 dark:brightness-100 transition-all"
              height="32"
            />
          </Link>
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
          <button
            type="button"
            onClick={() => {
              playTactileClick(600);
              setContactOpen(true);
            }}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent-blue)] transition-colors"
          >
            Contact
          </button>
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
        <div className="flex flex-wrap items-center gap-3">
          <span>Engineered by Shivam Gawade</span>
          <span>•</span>
          <a href="mailto:nsc26cs@gmail.com" className="hover:text-[var(--color-accent-blue)] transition-colors">
            nsc26cs@gmail.com
          </a>
        </div>
      </div>
    </footer>
    <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
  </>
  );
}
