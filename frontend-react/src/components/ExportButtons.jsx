import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import * as api from '../api/client';
import { playTactileClick } from '../utils/audio';

export default function ExportButtons() {
  const analysisId = useStore((s) => s.analysisId);

  const handleExport = async (exportFn, label) => {
    playTactileClick(600);
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
    <div className="interface-card p-4">
      <h3 className="eyebrow-label mb-3">
        Artifacts & Reproducibility
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-[#0066ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          }
          label="NetCDF-4"
          sub="CF-1.8 Compliant"
          onClick={() => handleExport(api.exportNetCDF, 'NetCDF-4')}
        />
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          }
          label="GeoJSON"
          sub="FeatureCollection"
          onClick={() => handleExport(api.exportGeoJSON, 'GeoJSON')}
        />
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          }
          label="Science Dossier"
          sub="Markdown Audit"
          onClick={() => handleExport(api.exportDossier, 'Science Dossier')}
        />
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-[#0066ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          }
          label="Jupyter Notebook"
          sub="Interactive IPYNB"
          onClick={() => handleExport(api.exportNotebook, 'Jupyter Notebook')}
        />
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          }
          label="Technical Memo"
          sub="AGU / IEEE LaTeX"
          onClick={() => {
            if (!analysisId) {
              toast.error('Execute an analysis first.');
              return;
            }
            playTactileClick(700);
            useStore.getState().setLatexModalOpen(true);
          }}
        />
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-[#f59e0b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          }
          label="Google Colab"
          sub="Cloud Runtime"
          onClick={async () => {
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
        <ExportBtn
          svgIcon={
            <svg className="w-4 h-4 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
          }
          label="AGU Preprint (PDF)"
          sub="1-Click Publication"
          onClick={() => {
            playTactileClick(750);
            useStore.getState().setPreprintModalOpen(true);
          }}
        />
      </div>
      <button
        onClick={handleShareLink}
        className="w-full mt-3 interface-btn-secondary !py-2 !text-xs font-mono justify-center"
      >
        <svg className="w-3.5 h-3.5 text-[var(--color-text-secondary)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span>Copy Workspace Permlink</span>
      </button>
    </div>
  );
}

function ExportBtn({ svgIcon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] rounded p-2.5 text-left transition-all group shadow-2xs"
    >
      <div className="mt-0.5 shrink-0" aria-hidden="true">{svgIcon}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--color-text-main)] group-hover:text-[var(--color-accent-blue)] transition-colors truncate font-['Space_Grotesk']">{label}</div>
        <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{sub}</div>
      </div>
    </button>
  );
}
