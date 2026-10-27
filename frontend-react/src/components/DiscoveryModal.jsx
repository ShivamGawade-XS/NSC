/**
 * EarthSift 2.0 — Earth System Trend Discovery Modal
 * Feature B: Autonomous exploratory multi-variable scan across Earth system domains.
 * Identifies high-velocity warming, extreme hydrologic shifts, and radiation trends
 * under rigorous Benjamini-Hochberg FDR multiplicity control.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { discoverTrends } from '../api/client';
import useStore from '../store/useStore';

const DISCOVERY_REGIONS = [
  { name: 'Northern High Latitudes (Arctic)', bbox: [-170, 60, -60, 75] },
  { name: 'Mediterranean & North Africa', bbox: [-10, 25, 40, 45] },
  { name: 'Amazon Basin & Tropical South America', bbox: [-80, -20, -40, 5] },
  { name: 'South & East Asia Monsoon Zone', bbox: [70, 10, 125, 35] },
];

export default function DiscoveryModal({ onClose }) {
  const currentDataset = useStore((s) => s.dataset) || 'nasa_power';
  const currentStart = useStore((s) => s.startYear) || 2000;
  const currentEnd = useStore((s) => s.endYear) || 2023;
  const storeBbox = useStore((s) => s.bbox);

  const defaultBboxStr = (storeBbox?.minLon !== '' && storeBbox?.maxLat !== '')
    ? `${storeBbox.minLon}, ${storeBbox.minLat}, ${storeBbox.maxLon}, ${storeBbox.maxLat}`
    : '-170, 60, -60, 75';

  const [dataset, setDataset] = useState(currentDataset);
  const [startYear, setStartYear] = useState(currentStart);
  const [endYear, setEndYear] = useState(currentEnd);
  const [bboxStr, setBboxStr] = useState(defaultBboxStr);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const parseBbox = (str) => {
    const parts = str.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    return parts;
  };

  const handleRunScan = async (e) => {
    e?.preventDefault();
    const parsed = parseBbox(bboxStr);
    if (!parsed) {
      setError('Please provide 4 valid bounding coordinates: minLon, minLat, maxLon, maxLat');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        dataset_id: dataset,
        bbox: parsed,
        start_year: parseInt(startYear, 10),
        end_year: parseInt(endYear, 10),
        alpha: 0.05,
      };
      const data = await discoverTrends(payload);
      setResults(data);
      if (data.ranked_candidates?.length === 0) {
        toast('No trends met the FDR threshold in this region.');
      } else {
        toast.success(`Discovered ${data.ranked_candidates?.length} significant trend candidates!`);
      }
    } catch (err) {
      setError(err.message || 'Discovery scan failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCandidate = async (candidate) => {
    useStore.setState({
      dataset,
      variable: candidate.variable_id,
      startYear: parseInt(startYear, 10),
      endYear: parseInt(endYear, 10),
    });
    toast.success(`Switched workspace to ${candidate.variable_name}`);
    onClose?.();
    // Trigger analysis
    useStore.getState().executeAnalysis({
      targetLat: candidate.lat,
      targetLon: candidate.lon,
    });
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Earth System Trend Discovery">
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>🔭 Autonomous Earth System Trend Discovery</div>
            <div style={styles.subtitle}>Multi-variable exploratory scan across physical domains under Benjamini-Hochberg FDR control</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close modal">✕</button>
        </div>

        <div style={styles.body}>
          {/* Quick Regions */}
          <div style={styles.presetSection}>
            <span style={styles.sectionLabel}>Region Transects:</span>
            <div style={styles.presetRow}>
              {DISCOVERY_REGIONS.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setBboxStr(r.bbox.join(', '))}
                  style={styles.presetBtn}
                >
                  🌐 {r.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRunScan} style={styles.form}>
            <div style={styles.grid3}>
              <div>
                <label style={styles.label}>Dataset</label>
                <select
                  value={dataset}
                  onChange={(e) => setDataset(e.target.value)}
                  style={styles.input}
                >
                  <option value="nasa_power">NASA POWER (0.5° Grid)</option>
                  <option value="merra2_reanalysis">MERRA-2 Reanalysis</option>
                </select>
              </div>
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

            <div>
              <label style={styles.label}>Scan Bounding Box (minLon, minLat, maxLon, maxLat)</label>
              <input
                type="text"
                value={bboxStr}
                onChange={(e) => setBboxStr(e.target.value)}
                style={{ ...styles.input, fontFamily: 'monospace' }}
                placeholder="-170, 60, -60, 75"
              />
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
              {loading ? 'Scanning Earth System Variables…' : 'Launch Autonomous Multi-Variable Scan'}
            </button>
          </form>

          {error && <div style={styles.errorBox}>{error}</div>}

          {/* Results list */}
          {results && (
            <div style={styles.resultsContainer}>
              <div style={styles.summaryBar}>
                <div>
                  <span style={styles.summaryTitle}>Scan Multiplicity Telemetry: </span>
                  <span style={styles.summarySub}>
                    {results.fdr_discovery_count} Significant Signals Discovered from {results.total_tests_conducted} Hypothesis Tests
                  </span>
                </div>
                <span style={styles.fdrBadge}>FDR q ≤ 0.05</span>
              </div>

              {results.ranked_candidates?.length > 0 ? (
                <div style={styles.candidateList}>
                  {results.ranked_candidates.map((c, idx) => (
                    <div key={idx} style={styles.candidateCard}>
                      <div style={styles.candHeader}>
                        <div style={styles.candTitleGroup}>
                          <span style={styles.candRank}>#{idx + 1}</span>
                          <div>
                            <span style={styles.candVarName}>{c.variable_name}</span>
                            <span style={styles.candDomain}> • {c.physical_domain}</span>
                          </div>
                        </div>
                        <span style={styles.badgeLabel}>{c.discovery_badge}</span>
                      </div>

                      <div style={styles.candStatsRow}>
                        <div style={styles.candStat}>
                          <span style={styles.candStatLabel}>Decadal Slope</span>
                          <span style={{ ...styles.candStatVal, color: c.slope > 0 ? '#f87171' : '#60a5fa' }}>
                            {c.slope > 0 ? '+' : ''}{c.slope.toFixed(4)} {c.slope_units}
                          </span>
                        </div>
                        <div style={styles.candStat}>
                          <span style={styles.candStatLabel}>FDR q-value</span>
                          <span style={{ ...styles.candStatVal, color: '#10b981' }}>
                            {c.q_value != null ? c.q_value.toFixed(4) : '—'}
                          </span>
                        </div>
                        <div style={styles.candStat}>
                          <span style={styles.candStatLabel}>Kendall τ</span>
                          <span style={styles.candStatVal}>{c.tau?.toFixed(3) ?? '—'}</span>
                        </div>
                        <div style={styles.candStat}>
                          <span style={styles.candStatLabel}>Coordinates</span>
                          <span style={styles.candStatVal}>{c.lat?.toFixed(1)}°, {c.lon?.toFixed(1)}°</span>
                        </div>
                        <div style={styles.candStat}>
                          <span style={styles.candStatLabel}>Discovery Score</span>
                          <span style={{ ...styles.candStatVal, color: '#f59e0b' }}>{c.discovery_score?.toFixed(1)}</span>
                        </div>
                      </div>

                      <p style={styles.candRationale}>{c.ranking_rationale}</p>

                      <div style={styles.candFooter}>
                        <button
                          type="button"
                          onClick={() => handleSelectCandidate(c)}
                          style={styles.inspectBtn}
                        >
                          🗺️ Load Variable & Inspect Coordinate in Workspace →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.emptyNotice}>
                  No candidates passed the multi-testing FDR threshold at α=0.05 for this spatiotemporal window.
                </div>
              )}

              <p style={styles.disclaimerText}>{results.methodology_disclaimer}</p>
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
    width: '100%', maxWidth: 840,
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
  presetSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 },
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  presetBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 11, cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  label: { fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4, fontWeight: 500 },
  input: {
    width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, padding: '7px 10px', color: '#f3f4f6', fontSize: 12,
    outline: 'none', boxSizing: 'border-box',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #0066ff 0%, #004ecc 100%)',
    border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 6,
    fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer',
    transition: 'all 0.2s ease', marginTop: 4,
  },
  errorBox: {
    padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 6, color: '#fca5a5', fontSize: 12,
  },
  resultsContainer: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 },
  summaryBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap', gap: 8,
  },
  summaryTitle: { fontSize: 12, fontWeight: 700, color: '#f3f4f6' },
  summarySub: { fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' },
  fdrBadge: {
    background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
  },
  candidateList: { display: 'flex', flexDirection: 'column', gap: 10 },
  candidateCard: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    transition: 'border-color 0.2s',
  },
  candHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  candTitleGroup: { display: 'flex', alignItems: 'center', gap: 8 },
  candRank: {
    background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontWeight: 800,
    fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace',
  },
  candVarName: { fontSize: 13, fontWeight: 700, color: '#f9fafb' },
  candDomain: { fontSize: 11, color: '#6b7280' },
  badgeLabel: {
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
    color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.04em',
  },
  candStatsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8,
    background: 'rgba(0,0,0,0.25)', padding: '8px 12px', borderRadius: 6,
  },
  candStat: { display: 'flex', flexDirection: 'column', gap: 2 },
  candStatLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', fontWeight: 700 },
  candStatVal: { fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: '#d1d5db' },
  candRationale: { fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5, margin: 0 },
  candFooter: { display: 'flex', justifyContent: 'flex-end' },
  inspectBtn: {
    background: 'rgba(0,102,255,0.12)', border: '1px solid rgba(0,102,255,0.35)',
    color: '#60a5fa', borderRadius: 6, padding: '6px 12px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s ease',
  },
  emptyNotice: {
    padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 12,
    background: 'rgba(255,255,255,0.02)', borderRadius: 8,
  },
  disclaimerText: { fontSize: 10, color: '#6b7280', fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1.4 },
};
