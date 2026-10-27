/**
 * EarthSift 2.0 — Reproducible Analysis Dossier Modal
 * Feature E: Cryptographic provenance manifest with SHA-256 fingerprint,
 * one-click copyable standalone Python replication script, and AGU/AMS BibTeX citations.
 */
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getReproducibilityManifest, downloadBlob } from '../api/client';

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
    if (!data?.python_replication_code) return;
    navigator.clipboard?.writeText(data.python_replication_code)
      .then(() => toast.success('Python replication script copied'))
      .catch(() => toast('Code ready for copy'));
  };

  const handleDownloadCode = () => {
    if (!data?.python_replication_code) return;
    const blob = new Blob([data.python_replication_code], { type: 'text/x-python' });
    downloadBlob(blob, `reproduce_earthsift_${analysisId.slice(0, 8)}.py`, 'text/x-python');
    toast.success('Script downloaded');
  };

  const handleCopyBibtex = () => {
    if (!data?.bibtex_citations?.length) return;
    const text = data.bibtex_citations.join('\n\n');
    navigator.clipboard?.writeText(text)
      .then(() => toast.success('BibTeX citations copied'))
      .catch(() => toast('Citations ready for copy'));
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Reproducible Analysis Dossier">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>📋 Reproducible Analysis Dossier</div>
            <div style={styles.subtitle}>Full cryptographic manifest & executable Python replication recipe</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">✕</button>
        </div>

        <div style={styles.body}>
          {loading && (
            <div style={styles.centered}>
              <div style={styles.spinner}>⟳</div>
              <span style={styles.loadingText}>Generating cryptographic manifest & Python recipe…</span>
            </div>
          )}

          {error && <div style={styles.errorBox}>{error}</div>}

          {data && (
            <>
              {/* SHA-256 Fingerprint Bar */}
              <div style={styles.fingerprintBar}>
                <div style={styles.fpHeader}>
                  <span style={styles.fpLabel}>SHA-256 Analysis Fingerprint</span>
                  <span style={styles.timestampText}>{data.timestamp_utc}</span>
                </div>
                <div style={styles.fpCode}>{data.sha256_fingerprint}</div>
              </div>

              {/* Tab Navigation */}
              <div style={styles.tabBar}>
                {[
                  { id: 'script', label: '🐍 Python Replication Code' },
                  { id: 'parameters', label: '⚙️ Parameters & Environment' },
                  { id: 'bibtex', label: '📚 BibTeX Citations' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      ...styles.tabBtn,
                      ...(activeTab === t.id ? styles.tabBtnActive : {}),
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab: Script */}
              {activeTab === 'script' && (
                <div style={styles.tabContent}>
                  <div style={styles.scriptActions}>
                    <span style={styles.scriptHint}>Standalone runnable script using Scipy, NumPy & Requests</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={handleCopyCode} style={styles.actionBtn}>📋 Copy Code</button>
                      <button onClick={handleDownloadCode} style={{ ...styles.actionBtn, background: '#0066ff', color: '#fff' }}>
                        ⬇ Download .py
                      </button>
                    </div>
                  </div>
                  <pre style={styles.codeBlock}>
                    <code>{data.python_replication_code}</code>
                  </pre>
                </div>
              )}

              {/* Tab: Parameters */}
              {activeTab === 'parameters' && (
                <div style={styles.tabContent}>
                  <div style={styles.metaGrid}>
                    <div style={styles.metaCard}>
                      <span style={styles.metaLabel}>Analysis ID</span>
                      <span style={styles.metaVal}>{data.analysis_id}</span>
                    </div>
                    <div style={styles.metaCard}>
                      <span style={styles.metaLabel}>Software Version</span>
                      <span style={styles.metaVal}>{data.software_version}</span>
                    </div>
                    <div style={styles.metaCard}>
                      <span style={styles.metaLabel}>Dataset</span>
                      <span style={styles.metaVal}>{data.dataset?.name || data.dataset?.id}</span>
                    </div>
                    <div style={styles.metaCard}>
                      <span style={styles.metaLabel}>Dataset DOI</span>
                      <span style={styles.metaVal}>{data.dataset?.doi || 'NASA EarthData'}</span>
                    </div>
                  </div>

                  <div style={styles.card}>
                    <div style={styles.cardTitle}>Execution Parameters</div>
                    <div style={styles.paramList}>
                      {Object.entries(data.analysis_parameters || {}).map(([k, v]) => (
                        <div key={k} style={styles.paramRow}>
                          <span style={styles.paramKey}>{k}</span>
                          <span style={styles.paramVal}>{JSON.stringify(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {data.scientific_summary && (
                    <div style={styles.card}>
                      <div style={styles.cardTitle}>Calculated Summary Results</div>
                      <div style={styles.paramList}>
                        {Object.entries(data.scientific_summary).map(([k, v]) => (
                          <div key={k} style={styles.paramRow}>
                            <span style={styles.paramKey}>{k}</span>
                            <span style={styles.paramVal}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: BibTeX */}
              {activeTab === 'bibtex' && (
                <div style={styles.tabContent}>
                  <div style={styles.scriptActions}>
                    <span style={styles.scriptHint}>Citations for algorithms (Mann-Kendall, Theil-Sen, Benjamini-Hochberg) and datasets</span>
                    <button onClick={handleCopyBibtex} style={styles.actionBtn}>📋 Copy All BibTeX</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.bibtex_citations?.map((c, i) => (
                      <pre key={i} style={styles.bibtexBlock}>
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

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.78)',
    backdropFilter: 'blur(8px)',
    zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'linear-gradient(180deg, #111827 0%, #0f172a 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    width: '100%', maxWidth: 760,
    maxHeight: '90vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.75)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: { fontSize: 19, fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.02em' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  closeBtn: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#9ca3af', borderRadius: 8, width: 32, height: 32,
    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  centered: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 60, color: '#6b7280',
  },
  spinner: { fontSize: 32, animation: 'spin 1s linear infinite' },
  loadingText: { fontSize: 13, color: '#6b7280' },
  errorBox: {
    padding: '12px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 8, color: '#fca5a5', fontSize: 13,
  },
  fingerprintBar: {
    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  fpHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  fpLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 },
  timestampText: { fontSize: 10.5, color: '#9ca3af', fontFamily: 'monospace' },
  fpCode: {
    fontFamily: 'monospace', fontSize: 11.5, color: '#10b981', wordBreak: 'break-all',
    background: 'rgba(16,185,129,0.06)', padding: '6px 8px', borderRadius: 4,
  },
  tabBar: {
    display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 2,
  },
  tabBtn: {
    padding: '8px 14px', fontSize: 11.5, fontWeight: 600,
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: '#6b7280', cursor: 'pointer', transition: 'all 0.15s',
  },
  tabBtnActive: {
    color: '#60a5fa', borderBottomColor: '#60a5fa', background: 'rgba(96,165,250,0.06)',
  },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 12 },
  scriptActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  scriptHint: { fontSize: 11, color: '#9ca3af' },
  actionBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
    fontWeight: 600,
  },
  codeBlock: {
    background: '#090d16', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 14, overflowX: 'auto', maxHeight: 380,
    fontSize: 11, color: '#e5e7eb', fontFamily: 'monospace', lineHeight: 1.5,
  },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 },
  metaCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
  },
  metaLabel: { fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 },
  metaVal: { fontSize: 11.5, fontWeight: 600, color: '#e5e7eb', fontFamily: 'monospace' },
  card: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardTitle: { fontSize: 11.5, fontWeight: 700, color: '#f3f4f6' },
  paramList: { display: 'flex', flexDirection: 'column', gap: 6 },
  paramRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  paramKey: { color: '#9ca3af', fontFamily: 'monospace' },
  paramVal: { color: '#f3f4f6', fontFamily: 'monospace', fontWeight: 600 },
  bibtexBlock: {
    background: '#090d16', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6, padding: 12, overflowX: 'auto', fontSize: 10.5, color: '#93c5fd',
    fontFamily: 'monospace', lineHeight: 1.4, margin: 0,
  },
};
