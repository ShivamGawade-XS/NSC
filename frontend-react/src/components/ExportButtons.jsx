import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import * as api from '../api/client';

export default function ExportButtons() {
  const analysisId = useStore((s) => s.analysisId);

  const handleExport = async (exportFn, label) => {
    if (!analysisId) {
      toast.error('Run an analysis first.');
      return;
    }
    const toastId = toast.loading(`Exporting ${label}...`);
    try {
      const { blob, filename, mime } = await exportFn(analysisId);
      api.downloadBlob(blob, filename, mime);
      toast.success(`${label} downloaded!`, { id: toastId });
    } catch (err) {
      toast.error(`Failed: ${err.message}`, { id: toastId });
    }
  };

  const handleShareLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href)
        .then(() => toast.success('🔗 Link copied to clipboard!'))
        .catch(() => toast('URL: ' + window.location.href));
    } else {
      toast('URL: ' + window.location.href);
    }
  };

  return (
    <div className="glass-card p-4">
      <h3 className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-3">
        Export & Share
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <ExportBtn
          icon="📦"
          label="NetCDF-4"
          sub=".nc"
          onClick={() => handleExport(api.exportNetCDF, 'NetCDF-4')}
        />
        <ExportBtn
          icon="🗺️"
          label="GeoJSON"
          sub=".geojson"
          onClick={() => handleExport(api.exportGeoJSON, 'GeoJSON')}
        />
        <ExportBtn
          icon="📄"
          label="Dossier"
          sub=".md"
          onClick={() => handleExport(api.exportDossier, 'Science Dossier')}
        />
        <ExportBtn
          icon="📓"
          label="Notebook"
          sub=".ipynb"
          onClick={() => handleExport(api.exportNotebook, 'Jupyter Notebook')}
        />
      </div>
      <button
        onClick={handleShareLink}
        className="w-full mt-2 flex items-center justify-center gap-2 bg-bg-elevated border border-border-subtle hover:border-accent-cyan/30 text-text-secondary hover:text-accent-cyan rounded-lg px-3 py-2 text-xs transition-all"
      >
        🔗 Share Deep-Link
      </button>
    </div>
  );
}

function ExportBtn({ icon, label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-bg-elevated border border-border-subtle hover:border-border-hover rounded-lg px-3 py-2 text-left transition-all group"
    >
      <span className="text-sm">{icon}</span>
      <div>
        <div className="text-xs text-text-secondary group-hover:text-text-main transition-colors">{label}</div>
        <div className="text-[9px] text-text-muted font-[var(--font-mono)]">{sub}</div>
      </div>
    </button>
  );
}
