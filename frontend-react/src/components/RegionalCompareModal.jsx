/**
 * Tellura 2.0 — Side-by-Side Regional Trend Detective Modal
 * Feature C: Compares climate trend trajectories across two geographic regions
 * with formal two-sample hypothesis testing for trend divergence.
 */
import { useState } from 'react';
import { compareRegions } from '../api/client';
import useStore from '../store/useStore';

const REGION_PRESETS = [
  {
    name: 'Arctic Amplification vs Tropics',
    dataset: 'nasa_power',
    variable: 'T2M',
    startYear: 2000,
    endYear: 2023,
    regionA: { name: 'Western Arctic', bbox: [-170, 60, -120, 75] },
    regionB: { name: 'Tropical Pacific', bbox: [-170, -10, -120, 10] },
  },
  {
    name: 'Sahel vs Mediterranean Basin',
    dataset: 'nasa_power',
    variable: 'T2M',
    startYear: 2000,
    endYear: 2023,
    regionA: { name: 'Sahel Transition Zone', bbox: [-10, 10, 30, 18] },
    regionB: { name: 'Mediterranean Basin', bbox: [-5, 35, 30, 45] },
  },
  {
    name: 'Amazon Rainforest vs Cerrado',
    dataset: 'nasa_power',
    variable: 'T2M',
    startYear: 2000,
    endYear: 2023,
    regionA: { name: 'Amazon Core', bbox: [-70, -10, -55, 0] },
    regionB: { name: 'Cerrado Savannah', bbox: [-50, -18, -40, -10] },
  },
];

export default function RegionalCompareModal({ onClose }) {
  const currentDataset = useStore((s) => s.dataset) || 'nasa_power';
  const currentVar = useStore((s) => s.variable) || 'T2M';
  const currentStart = useStore((s) => s.startYear) || 2000;
  const currentEnd = useStore((s) => s.endYear) || 2023;

  const [dataset, setDataset] = useState(currentDataset);
  const [variable, setVariable] = useState(currentVar);
  const [startYear, setStartYear] = useState(currentStart);
  const [endYear, setEndYear] = useState(currentEnd);

  // Region A
  const [nameA, setNameA] = useState('Western Arctic');
  const [bboxA, setBboxA] = useState('-170, 60, -120, 75');

  // Region B
  const [nameB, setNameB] = useState('Tropical Pacific');
  const [bboxB, setBboxB] = useState('-170, -10, -120, 10');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const parseBbox = (str) => {
    const parts = str.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    return parts;
  };

  const handleApplyPreset = (p) => {
    setDataset(p.dataset);
    setVariable(p.variable);
    setStartYear(p.startYear);
    setEndYear(p.endYear);
    setNameA(p.regionA.name);
    setBboxA(p.regionA.bbox.join(', '));
    setNameB(p.regionB.name);
    setBboxB(p.regionB.bbox.join(', '));
    setError(null);
  };

  const handleRunComparison = async (e) => {
    e?.preventDefault();
    const boxA = parseBbox(bboxA);
    const boxB = parseBbox(bboxB);

    if (!boxA) {
      setError('Region A bounding box must have 4 coordinates: minLon, minLat, maxLon, maxLat');
      return;
    }
    if (!boxB) {
      setError('Region B bounding box must have 4 coordinates: minLon, minLat, maxLon, maxLat');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        dataset_id: dataset,
        variable_id: variable,
        start_year: parseInt(startYear, 10),
        end_year: parseInt(endYear, 10),
        region_a_name: nameA,
        region_a_bbox: boxA,
        region_b_name: nameB,
        region_b_bbox: boxB,
        alpha: 0.05,
      };
      const data = await compareRegions(payload);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Comparison request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Regional Trend Detective">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Regional Trend Detective</div>
            <div style={styles.subtitle}>Side-by-side comparative trend analysis with Welch’s two-sample divergence test</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">✕</button>
        </div>

        <div style={styles.body}>
          {/* Presets ribbon */}
          <div style={styles.presetSection}>
            <span style={styles.sectionLabel}>Curated Exemplar Comparisons:</span>
            <div style={styles.presetRow}>
              {REGION_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  style={styles.presetBtn}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRunComparison} style={styles.form}>
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Dataset ID</label>
                <select
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  style={styles.input}
                >
                  <option value="nasa_power">NASA POWER (0.5°)</option>
                  <option value="merra2_reanalysis">MERRA-2 Reanalysis</option>
                  <option value="gibs_modis_temperature">GIBS MODIS L3</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Variable ID</label>
                <input
                  type="text"
                  value={variable}
                  onChange={(e) => setVariable(e.target.value)}
                  style={styles.input}
                  placeholder="T2M"
                />
              </div>
            </div>

            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Start Year</label>
                <input
                  type="number"
                  value={startYear}
                  min={1981}
                  max={2026}
                  onChange={(e) => setStartYear(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>End Year</label>
                <input
                  type="number"
                  value={endYear}
                  min={1981}
                  max={2026}
                  onChange={(e) => setEndYear(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            {/* Region A & B side-by-side config */}
            <div style={styles.grid2}>
              <div style={styles.regionConfigBox}>
                <div style={{ ...styles.regionHeader, color: 'var(--color-accent-blue)' }}>
                  <span>Region A</span>
                </div>
                <label style={styles.label}>Label</label>
                <input
                  type="text"
                  value={nameA}
                  onChange={(e) => setNameA(e.target.value)}
                  style={styles.input}
                  placeholder="Region A Name"
                />
                <label style={{ ...styles.label, marginTop: 8 }}>Bounding Box (minLon, minLat, maxLon, maxLat)</label>
                <input
                  type="text"
                  value={bboxA}
                  onChange={(e) => setBboxA(e.target.value)}
                  style={{ ...styles.input, fontFamily: 'monospace' }}
                  placeholder="-170, 60, -120, 75"
                />
              </div>

              <div style={styles.regionConfigBox}>
                <div style={{ ...styles.regionHeader, color: '#f59e0b' }}>
                  <span>Region B</span>
                </div>
                <label style={styles.label}>Label</label>
                <input
                  type="text"
                  value={nameB}
                  onChange={(e) => setNameB(e.target.value)}
                  style={styles.input}
                  placeholder="Region B Name"
                />
                <label style={{ ...styles.label, marginTop: 8 }}>Bounding Box (minLon, minLat, maxLon, maxLat)</label>
                <input
                  type="text"
                  value={bboxB}
                  onChange={(e) => setBboxB(e.target.value)}
                  style={{ ...styles.input, fontFamily: 'monospace' }}
                  placeholder="-170, -10, -120, 10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitBtn,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Evaluating Regional Divergence…' : 'Run Regional Trend Detective'}
            </button>
          </form>

          {error && <div style={styles.errorBox}>{error}</div>}

          {/* Result view */}
          {result && (
            <div style={styles.resultContainer}>
              {/* Divergence banner */}
              <div
                style={{
                  ...styles.divergenceBanner,
                  borderColor: result.is_divergence_significant ? 'rgba(16,185,129,0.4)' : 'rgba(107,114,128,0.4)',
                  background: result.is_divergence_significant ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={styles.divergenceHeader}>
                  <span
                    style={{
                      ...styles.divergenceBadge,
                      color: result.is_divergence_significant ? '#10b981' : '#9ca3af',
                    }}
                  >
                    {result.is_divergence_significant ? '✓ STATISTICALLY SIGNIFICANT DIVERGENCE' : 'EQUIVALENT TREND REGIMES (NO DIVERGENCE)'}
                  </span>
                  <span style={styles.zStatText}>
                    Z = {result.z_statistic != null ? result.z_statistic.toFixed(3) : '—'} (p = {result.p_value != null ? result.p_value.toFixed(4) : '—'})
                  </span>
                </div>
                <p style={styles.divergenceNarrative}>{result.divergence_interpretation}</p>
              </div>

              {/* Side-by-side cards */}
              <div style={styles.grid2}>
                {/* Card A */}
                <div style={{ ...styles.card, borderTop: '3px solid #60a5fa' }}>
                  <div style={styles.cardHeader}>
                    <span style={{ ...styles.cardTitle, color: '#60a5fa' }}>{result.region_a?.name || 'Region A'}</span>
                    <span style={styles.badge}>{result.region_a?.cell_count ?? 0} cells</span>
                  </div>
                  <div style={styles.statList}>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Mean Decadal Slope</span>
                      <span style={{ ...styles.statVal, color: (result.region_a?.mean_slope || 0) > 0 ? '#f87171' : '#60a5fa' }}>
                        {(result.region_a?.mean_slope || 0) > 0 ? '+' : ''}{(result.region_a?.mean_slope || 0).toFixed(4)} {result.slope_units}
                      </span>
                    </div>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Median Slope</span>
                      <span style={styles.statVal}>
                        {(result.region_a?.median_slope || 0) > 0 ? '+' : ''}{(result.region_a?.median_slope || 0).toFixed(4)}
                      </span>
                    </div>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Significant Cells (FDR)</span>
                      <span style={styles.statVal}>
                        {((result.region_a?.significant_fraction || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Mean Kendall Tau</span>
                      <span style={styles.statVal}>{result.region_a?.tau_mean?.toFixed(3) ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Card B */}
                <div style={{ ...styles.card, borderTop: '3px solid #f59e0b' }}>
                  <div style={styles.cardHeader}>
                    <span style={{ ...styles.cardTitle, color: '#f59e0b' }}>{result.region_b?.name || 'Region B'}</span>
                    <span style={styles.badge}>{result.region_b?.cell_count ?? 0} cells</span>
                  </div>
                  <div style={styles.statList}>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Mean Decadal Slope</span>
                      <span style={{ ...styles.statVal, color: (result.region_b?.mean_slope || 0) > 0 ? '#f87171' : '#60a5fa' }}>
                        {(result.region_b?.mean_slope || 0) > 0 ? '+' : ''}{(result.region_b?.mean_slope || 0).toFixed(4)} {result.slope_units}
                      </span>
                    </div>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Median Slope</span>
                      <span style={styles.statVal}>
                        {(result.region_b?.median_slope || 0) > 0 ? '+' : ''}{(result.region_b?.median_slope || 0).toFixed(4)}
                      </span>
                    </div>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Significant Cells (FDR)</span>
                      <span style={styles.statVal}>
                        {((result.region_b?.significant_fraction || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={styles.statRow}>
                      <span style={styles.statLabel}>Mean Kendall Tau</span>
                      <span style={styles.statVal}>{result.region_b?.tau_mean?.toFixed(3) ?? '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slope Difference Callout */}
              <div style={styles.deltaBox}>
                <span style={styles.deltaLabel}>Slope Difference (A − B):</span>
                <span style={{ ...styles.deltaVal, color: result.slope_difference > 0 ? '#f87171' : '#60a5fa' }}>
                  {result.slope_difference > 0 ? '+' : ''}{result.slope_difference?.toFixed(4)} {result.slope_units}
                </span>
              </div>

              {/* Spatial compatibility notes */}
              {result.spatial_compatibility_notes?.length > 0 && (
                <div style={styles.notesBox}>
                  <div style={styles.notesTitle}>Spatial Compatibility Audit</div>
                  <ul style={styles.notesList}>
                    {result.spatial_compatibility_notes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 12,
    width: '100%', maxWidth: 780,
    maxHeight: '90vh', overflow: 'auto',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
    color: 'var(--color-text-main)',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--color-border-subtle)',
    background: 'var(--color-bg-elevated)',
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--color-text-main)', letterSpacing: '-0.02em', fontFamily: 'Space Grotesk, sans-serif' },
  subtitle: { fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 },
  closeBtn: {
    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-muted)', borderRadius: 6, width: 28, height: 28,
    cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 },
  presetSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', fontWeight: 700, fontFamily: 'monospace' },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  presetBtn: {
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-secondary)', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
    transition: 'all 0.15s ease', fontFamily: 'monospace',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  label: { fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4, fontWeight: 500 },
  input: {
    width: '100%', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 6, padding: '7px 10px', color: 'var(--color-text-main)', fontSize: 12,
    outline: 'none', boxSizing: 'border-box',
  },
  regionConfigBox: {
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column',
  },
  regionHeader: { fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: '0.04em', fontFamily: 'monospace' },
  submitBtn: {
    background: 'var(--color-accent-blue)',
    border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 6,
    fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer',
    transition: 'all 0.2s ease', marginTop: 4,
  },
  errorBox: {
    padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 6, color: '#fca5a5', fontSize: 12,
  },
  resultContainer: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 },
  divergenceBanner: {
    borderRadius: 8, padding: 14, border: '1px solid', display: 'flex', flexDirection: 'column', gap: 6,
  },
  divergenceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  divergenceBadge: { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', fontFamily: 'monospace' },
  zStatText: { fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace' },
  divergenceNarrative: { fontSize: 12, color: 'var(--color-text-main)', lineHeight: 1.6, margin: 0 },
  card: {
    background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--color-text-main)', fontFamily: 'Space Grotesk, sans-serif' },
  badge: {
    background: 'var(--color-bg-surface)', borderRadius: 4, padding: '2px 6px',
    fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace', border: '1px solid var(--color-border-subtle)',
  },
  statList: { display: 'flex', flexDirection: 'column', gap: 8 },
  statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 },
  statLabel: { color: 'var(--color-text-muted)' },
  statVal: { color: 'var(--color-text-main)', fontFamily: 'monospace', fontWeight: 600 },
  deltaBox: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
    borderRadius: 6, padding: '10px 14px',
  },
  deltaLabel: { fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 },
  deltaVal: { fontSize: 13, fontFamily: 'monospace', fontWeight: 700 },
  notesBox: {
    background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)',
    borderRadius: 6, padding: 12,
  },
  notesTitle: { fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 4 },
  notesList: { margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 },
};
