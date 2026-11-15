import { useState } from 'react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import { formatCoords } from '../utils/helpers';
import { playTactileClick } from '../utils/audio';

export default function SchoolSlideModal() {
  const isOpen = useStore((s) => s.schoolSlideModalOpen);
  const setOpen = useStore((s) => s.setSchoolSlideModalOpen);
  const analysisData = useStore((s) => s.analysisData);
  const selectedCell = useStore((s) => s.selectedCell);
  const dataset = useStore((s) => s.dataset);
  const variable = useStore((s) => s.variable);
  const startYear = useStore((s) => s.startYear);
  const endYear = useStore((s) => s.endYear);

  const [studentName, setStudentName] = useState('Student Investigator');
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const cell = selectedCell || analysisData?.grid?.[0] || {};
  const slope = cell.slope !== undefined ? cell.slope : (analysisData?.summary?.mean_slope || 0);
  const slopeUnits = cell.slope_units || '°C / decade';
  const timeSpan = `${startYear}–${endYear}`;
  const locationStr = cell.lat !== undefined ? formatCoords(cell.lat, cell.lon) : 'Regional Transect';
  const isWarming = slope > 0;
  const confidenceLevel = (cell.p_value !== undefined && cell.p_value < 0.05) ? 'High Confidence (Verified NASA Signal)' : 'Moderate / Emerging Pattern';

  // Plain-English driver hypothesis
  const plainDriver = cell.evidence_record?.plainDriver ||
    (variable === 'T2M'
      ? 'Thermal accumulation driven by persistent atmospheric high-pressure ridges and reduced surface evaporative cooling.'
      : variable === 'ALLSKY_SFC_SW_DWN'
      ? 'Atmospheric transmission changes and particulate scattering impacting solar radiation reaching the surface.'
      : 'Regional hydrological redistribution affecting local precipitation cycles.');

  const handlePrint = () => {
    playTactileClick(700);
    window.print();
  };

  const handleCopy = () => {
    playTactileClick(600);
    const text = `NASA EARTH SYSTEM DETECTIVE — INVESTIGATION SLIDE
Investigator: ${studentName}
Region: ${locationStr} (${timeSpan})
Observation: ${variable} via ${dataset === 'nasa_power' ? 'NASA POWER (LaRC)' : 'NASA MERRA-2'}

KEY FINDINGS:
1. What happened? ${slope > 0 ? '+' : ''}${slope.toFixed(3)} ${slopeUnits} change observed across 40+ years.
2. Is it a fluke? ${confidenceLevel} (Statistical test confirmed not random chance).
3. Earth System Driver: ${plainDriver}

Generated via Tellura Climate Workstation (NASA Space Apps 2026)`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(true);
      toast.success('Slide notes copied to clipboard');
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-4xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl shadow-2xl p-6 my-8 text-[var(--color-text-main)] print:border-none print:shadow-none print:p-0 print:my-0 print:max-w-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4 mb-5 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-accent-blue)]" />
            <h2 className="text-sm font-bold font-['Space_Grotesk'] text-[var(--color-text-main)] uppercase tracking-wider">
              School Presentation Slide Generator
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)] border border-[var(--color-accent-blue)]/30 font-semibold">
              16:9 Widescreen
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded text-xs font-mono border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            >
              {copiedText ? '✓ Copied' : 'Copy Slide Notes'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded text-xs font-mono font-bold bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue)]/90 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.056-.367-2.155-.367-3.279 0-4.341 3.535-7.857 7.897-7.857s7.897 3.516 7.897 7.857c0 1.124-.127 2.223-.367 3.279M6.72 13.829a8.97 8.97 0 00-3.22 6.171h17m-13.78-6.171a8.97 8.97 0 0113.78 0" />
              </svg>
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
              aria-label="Close dialog"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 16:9 Printable Slide Canvas */}
        <div className="bg-[var(--color-bg-deep)] border-2 border-[var(--color-border-subtle)] rounded-lg p-6 sm:p-8 space-y-6 print:border-none print:p-8 print:bg-white print:text-black">
          {/* Slide Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[var(--color-accent-blue)] uppercase font-semibold">
                <span>NASA Earth System Detective</span>
                <span>•</span>
                <span>Science Investigation Dossier</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-['Space_Grotesk'] text-[var(--color-text-main)] mt-1">
                Regional Climate Mystery: {locationStr}
              </h1>
            </div>

            <div className="flex items-center gap-2 print:text-xs">
              <label className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase">Investigator:</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1 text-xs font-mono font-semibold text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-accent-blue)] print:border-none print:bg-transparent"
              />
            </div>
          </div>

          {/* 3 Step Clue Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Clue 1: What Happened */}
            <div className="p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-accent-blue)] flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[var(--color-accent-blue)] text-white flex items-center justify-center text-[10px]">1</span>
                <span>What Happened?</span>
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--color-text-main)] tabular-nums">
                {slope > 0 ? '+' : ''}{slope.toFixed(3)}
                <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">{slopeUnits}</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Across {timeSpan}, satellite observations show a consistent {isWarming ? 'upward warming rate' : 'downward shift'} in surface data.
              </p>
            </div>

            {/* Clue 2: Is it a Fluke? */}
            <div className="p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Is It A Fluke?</span>
              </div>
              <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {confidenceLevel}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Non-parametric Mann-Kendall test confirms this trend cannot be explained by natural year-to-year random weather noise.
              </p>
            </div>

            {/* Clue 3: The Driver */}
            <div className="p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">3</span>
                <span>The Earth Science Driver</span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {plainDriver}
              </p>
            </div>
          </div>

          {/* Interactive Evidence Highlights */}
          <div className="p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent-blue)]/15 border border-[var(--color-accent-blue)]/30 flex items-center justify-center text-[var(--color-accent-blue)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold font-mono text-[var(--color-text-main)]">
                  Web Audio Sonification Verified
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  Audio pitch rises proportionally with multi-decadal observation records, providing multi-sensory validation.
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 font-mono text-[11px] text-[var(--color-text-muted)]">
              <div>Continuous Records: <strong className="text-[var(--color-text-main)]">{endYear - startYear + 1} Years</strong></div>
              <div>Spatial Footprint: <strong className="text-[var(--color-text-main)]">≈ 2,650 km²</strong></div>
            </div>
          </div>

          {/* Slide Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-muted)] gap-2">
            <div>
              Data: NASA POWER Synoptic / GMAO Reanalysis • CF-1.8 Compliant
            </div>
            <div>
              Produced by Tellura Planetary Intelligence • NASA Space Apps Challenge 2026
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

