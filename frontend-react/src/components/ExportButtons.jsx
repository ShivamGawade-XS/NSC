import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import * as api from '../api/client';
import { playTactileClick } from '../utils/audio';

export default function ExportButtons() {
  const analysisId = useStore((s) => s.analysisId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleExport = async (exportFn, label) => {
    playTactileClick(600);
    setDropdownOpen(false);
    if (!analysisId) {
      toast.error('Execute an analysis first.');
      return;
    }
    const toastId = toast.loading(`Exporting ${label}...`);
    try {
      const { blob, filename, mime } = await exportFn(analysisId);
      api.downloadBlob(blob, filename, mime);
      toast.success(`${label} downloaded`, { id: toastId });
    } catch (err) {
      toast.error(`Export failed: ${err.message}`, { id: toastId });
    }
  };

  const handleShareLink = () => {
    playTactileClick(700);
    const shareUrl = useStore.getState().getShareableUrl();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => toast.success('Workspace Permlink copied'))
        .catch(() => toast('URL: ' + shareUrl));
    } else {
      toast('URL: ' + shareUrl);
    }
  };

  return (
    <div className="interface-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="instrument-heading !text-xs">
          Artifacts & Exports
        </h3>
        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
          CF-1.8 & Open Science
        </span>
      </div>

      {/* Primary Action Row with Split Export Menu */}
      <div className="flex items-center gap-1.5" ref={dropdownRef}>
        {/* Primary Gold-Standard Download: NetCDF-4 */}
        <button
          type="button"
          onClick={() => handleExport(api.exportNetCDF, 'NetCDF-4')}
          className="flex-1 interface-btn-secondary !py-1.5 !px-2.5 !text-xs font-mono justify-center flex items-center gap-1.5 hover:border-[var(--color-accent-blue)]/50"
          title="Download CF-1.8 compliant NetCDF-4 scientific grid"
        >
          <svg className="w-3.5 h-3.5 text-[var(--color-accent-blue)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span className="truncate">NetCDF-4</span>
        </button>

        {/* Dropdown Trigger for Other Formats */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              setDropdownOpen(!dropdownOpen);
            }}
            className={`interface-btn-secondary !py-1.5 !px-2 text-xs font-mono flex items-center gap-1 ${
              dropdownOpen ? 'border-[var(--color-accent-blue)] bg-[var(--color-bg-hover)]' : ''
            }`}
            title="More export formats and reproducibility tools"
            aria-expanded={dropdownOpen}
          >
            <span>Formats</span>
            <span className="text-[9px]">▾</span>
          </button>

          {/* Formats Popover Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 sm:left-auto right-0 top-full mt-1.5 z-50 w-56 bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-md shadow-xl py-1 text-xs font-mono animate-in fade-in duration-150">
              <div className="px-2.5 py-1 text-[9px] uppercase font-bold text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)] tracking-wider">
                Scientific Export Suite
              </div>

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  </svg>
                }
                label="GeoJSON Grid"
                sub="FeatureCollection"
                onClick={() => handleExport(api.exportGeoJSON, 'GeoJSON')}
              />

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                }
                label="Science Dossier"
                sub="Markdown Audit"
                onClick={() => handleExport(api.exportDossier, 'Science Dossier')}
              />

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-[var(--color-accent-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                }
                label="Jupyter Notebook"
                sub="Interactive IPYNB"
                onClick={() => handleExport(api.exportNotebook, 'Jupyter Notebook')}
              />

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                }
                label="Technical Memo"
                sub="LaTeX / IEEE Format"
                onClick={() => {
                  setDropdownOpen(false);
                  if (!analysisId) {
                    toast.error('Execute an analysis first.');
                    return;
                  }
                  playTactileClick(700);
                  useStore.getState().setLatexModalOpen(true);
                }}
              />

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                }
                label="Google Colab"
                sub="Cloud Runtime"
                onClick={async () => {
                  setDropdownOpen(false);
                  if (!analysisId) {
                    toast.error('Execute an analysis first.');
                    return;
                  }
                  playTactileClick(700);
                  try {
                    const res = await api.getColabLink(analysisId);
                    window.open(res.colab_launcher_url, '_blank');
                    toast.success('Dispatched to Google Colab');
                  } catch (err) {
                    toast.error(`Colab error: ${err.message}`);
                  }
                }}
              />

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                }
                label="Preprint (PDF)"
                sub="1-Click Publication"
                onClick={() => {
                  setDropdownOpen(false);
                  playTactileClick(750);
                  useStore.getState().setPreprintModalOpen(true);
                }}
              />

              <MenuItem
                icon={
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                label="Reproducibility"
                sub="SHA-256 Checksums"
                onClick={() => {
                  setDropdownOpen(false);
                  if (!analysisId) {
                    toast.error('Execute an analysis first.');
                    return;
                  }
                  playTactileClick(700);
                  useStore.getState().setReproducibilityModalOpen(true);
                }}
              />
            </div>
          )}
        </div>

        {/* Copy Permlink Action Button */}
        <button
          type="button"
          onClick={handleShareLink}
          className="interface-btn-secondary !py-1.5 !px-2.5 text-xs font-mono"
          title="Copy shareable workspace URL with current coordinates and parameters"
        >
          <svg className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0">{icon}</span>
        <span className="text-[11px] text-[var(--color-text-main)] group-hover:text-[var(--color-accent-blue)] truncate font-medium">
          {label}
        </span>
      </div>
      <span className="text-[9px] text-[var(--color-text-muted)] shrink-0 font-mono">
        {sub}
      </span>
    </button>
  );
}
