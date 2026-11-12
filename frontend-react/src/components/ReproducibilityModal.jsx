/**
 * Tellura 2.0 — Reproducible Analysis Dossier Modal
 * Cryptographic provenance manifest with SHA-256 fingerprint,
 * one-click copyable standalone Python replication script, and AGU/AMS BibTeX citations.
 */
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getReproducibilityManifest, downloadBlob } from '../api/client';
import { playTactileClick } from '../utils/audio';

export default function ReproducibilityModal({ analysisId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('script'); // 'script' | 'parameters' | 'bibtex'

  useEffect(() => {
    if (!analysisId) return;
    let isCancelled = false;
    getReproducibilityManifest(analysisId)
      .then((res) => {
        if (!isCancelled) setData(res);
      })
      .catch((e) => {
        if (!isCancelled) setError(e.message || 'Failed to retrieve reproducibility manifest');
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [analysisId]);

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopyCode = () => {
    playTactileClick(700);
    if (!data?.python_replication_code) return;
    navigator.clipboard?.writeText(data.python_replication_code)
      .then(() => toast.success('Python replication script copied'))
      .catch(() => toast('Code ready for copy'));
  };

  const handleDownloadCode = () => {
    playTactileClick(750);
    if (!data?.python_replication_code) return;
    const blob = new Blob([data.python_replication_code], { type: 'text/x-python' });
    downloadBlob(blob, `reproduce_Tellura_${analysisId.slice(0, 8)}.py`, 'text/x-python');
    toast.success('Script downloaded');
  };

  const handleCopyBibtex = () => {
    playTactileClick(700);
    if (!data?.bibtex_citations?.length) return;
    const text = data.bibtex_citations.join('\n\n');
    navigator.clipboard?.writeText(text)
      .then(() => toast.success('BibTeX citations copied'))
      .catch(() => toast('Citations ready for copy'));
  };

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Reproducible Analysis Dossier"
    >
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[var(--color-text-main)] shadow-2xl animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold tracking-tight text-[var(--color-text-main)]">
              Reproducible Analysis Dossier
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
              Full cryptographic manifest & executable Python replication recipe
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              onClose?.();
            }}
            className="w-7 h-7 rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] flex items-center justify-center text-xs font-mono transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs font-mono text-[var(--color-text-muted)]">
              <span className="loading-spinner !w-6 !h-6 !border-2" />
              <span>Generating cryptographic manifest & Python recipe…</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded bg-red-950/20 border border-red-500/40 text-red-300 text-xs font-mono">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* SHA-256 Fingerprint Bar */}
              <div className="p-3.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                    SHA-256 Analysis Fingerprint
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {data.timestamp_utc}
                  </span>
                </div>
                <div className="text-xs text-[var(--color-accent-blue)] break-all select-all font-mono bg-[var(--color-bg-surface)] p-2 rounded border border-[var(--color-border-subtle)]">
                  {data.sha256_fingerprint}
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-[var(--color-border-subtle)] pt-1">
                {[
                  { id: 'script', label: 'Python Replication Code' },
                  { id: 'parameters', label: 'Parameters & Environment' },
                  { id: 'bibtex', label: 'BibTeX Citations' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      playTactileClick(600);
                      setActiveTab(t.id);
                    }}
                    className={`px-3.5 py-2 text-xs font-mono font-semibold border-b-2 transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? 'border-[var(--color-accent-blue)] text-[var(--color-accent-blue)] bg-[var(--color-bg-elevated)] rounded-t'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Script */}
              {activeTab === 'script' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">
                      Standalone runnable script using Scipy, NumPy & Requests
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="interface-btn-secondary !text-xs !py-1.5 !px-3 font-mono"
                      >
                        Copy Code
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadCode}
                        className="interface-btn-primary !text-xs !py-1.5 !px-3 font-mono"
                      >
                        Download .py
                      </button>
                    </div>
                  </div>
                  <pre className="p-4 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] overflow-x-auto text-xs font-mono text-[var(--color-text-secondary)] leading-relaxed max-h-[360px] select-all">
                    <code>{data.python_replication_code}</code>
                  </pre>
                </div>
              )}

              {/* Tab 2: Parameters */}
              {activeTab === 'parameters' && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">Analysis ID</span>
                      <span className="text-xs text-[var(--color-text-main)] block truncate">{data.analysis_id}</span>
                    </div>
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">Version</span>
                      <span className="text-xs text-[var(--color-text-main)] block">{data.software_version}</span>
                    </div>
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">Dataset</span>
                      <span className="text-xs text-[var(--color-text-main)] block truncate">{data.dataset?.name || data.dataset?.id}</span>
                    </div>
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-3 space-y-1">
                      <span className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold block">Dataset DOI</span>
                      <span className="text-xs text-[var(--color-text-main)] block truncate">{data.dataset?.doi || 'NASA EarthData'}</span>
                    </div>
                  </div>

                  <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-4 space-y-2">
                    <div className="font-['Space_Grotesk'] text-xs font-bold text-[var(--color-text-main)]">
                      Execution Parameters
                    </div>
                    <div className="space-y-1 font-mono text-xs">
                      {Object.entries(data.analysis_parameters || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]/50 last:border-b-0">
                          <span className="text-[var(--color-text-muted)]">{k}:</span>
                          <span className="text-[var(--color-text-main)] tabular-nums">{JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {data.scientific_summary && (
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-4 space-y-2">
                      <div className="font-['Space_Grotesk'] text-xs font-bold text-[var(--color-text-main)]">
                        Calculated Summary Results
                      </div>
                      <div className="space-y-1 font-mono text-xs">
                        {Object.entries(data.scientific_summary).map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center py-1 border-b border-[var(--color-border-subtle)]/50 last:border-b-0">
                            <span className="text-[var(--color-text-muted)]">{k}:</span>
                            <span className="text-[var(--color-text-main)] font-semibold tabular-nums">
                              {typeof v === 'number' ? v.toFixed(4) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: BibTeX */}
              {activeTab === 'bibtex' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">
                      Citations for algorithms (Mann-Kendall, Theil-Sen, Benjamini-Hochberg) and NASA datasets
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyBibtex}
                      className="interface-btn-secondary !text-xs !py-1.5 !px-3 font-mono"
                    >
                      Copy All BibTeX
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {data.bibtex_citations?.map((c, i) => (
                      <pre key={i} className="p-3 rounded-lg bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] overflow-x-auto text-xs font-mono text-[var(--color-text-secondary)] leading-relaxed select-all">
                        <code>{c}</code>
                      </pre>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
