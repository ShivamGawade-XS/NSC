import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { playTactileClick } from '../utils/audio';

const HERO_PRESETS = [
  {
    key: 'case1',
    name: 'Texas Basin',
    varName: 'T2M Air Temperature',
    rate: '+0.48 °C / dec',
    tau: '+0.512',
    pVal: '< 0.0001',
    qVal: '0.0002',
    lisa: 'High-High Hotspot',
    lisaColor: '#ef4444',
    cells: [
      { r: 0, c: 0, v: +0.42, sig: true, lisa: 'hh' },
      { r: 0, c: 1, v: +0.48, sig: true, lisa: 'hh' },
      { r: 0, c: 2, v: +0.51, sig: true, lisa: 'hh' },
      { r: 0, c: 3, v: +0.38, sig: true, lisa: 'ns' },
      { r: 1, c: 0, v: +0.39, sig: true, lisa: 'hh' },
      { r: 1, c: 1, v: +0.54, sig: true, lisa: 'hh' },
      { r: 1, c: 2, v: +0.49, sig: true, lisa: 'hh' },
      { r: 1, c: 3, v: +0.44, sig: true, lisa: 'hh' },
      { r: 2, c: 0, v: +0.31, sig: false, lisa: 'ns' },
      { r: 2, c: 1, v: +0.46, sig: true, lisa: 'hh' },
      { r: 2, c: 2, v: +0.52, sig: true, lisa: 'hh' },
      { r: 2, c: 3, v: +0.41, sig: true, lisa: 'hh' },
      { r: 3, c: 0, v: +0.28, sig: false, lisa: 'ns' },
      { r: 3, c: 1, v: +0.36, sig: true, lisa: 'ns' },
      { r: 3, c: 2, v: +0.45, sig: true, lisa: 'hh' },
      { r: 3, c: 3, v: +0.47, sig: true, lisa: 'hh' },
    ],
  },
  {
    key: 'case2',
    name: 'Southwest Arid',
    varName: 'Compound CAI Hazard',
    rate: '+2.18 CAI / dec',
    tau: '+0.634',
    pVal: '< 0.0001',
    qVal: '0.0001',
    lisa: 'Compound Hazard',
    lisaColor: '#f59e0b',
    cells: [
      { r: 0, c: 0, v: +1.84, sig: true, lisa: 'hh' },
      { r: 0, c: 1, v: +2.12, sig: true, lisa: 'hh' },
      { r: 0, c: 2, v: +2.45, sig: true, lisa: 'hh' },
      { r: 0, c: 3, v: +1.92, sig: true, lisa: 'hh' },
      { r: 1, c: 0, v: +2.05, sig: true, lisa: 'hh' },
      { r: 1, c: 1, v: +2.38, sig: true, lisa: 'hh' },
      { r: 1, c: 2, v: +2.61, sig: true, lisa: 'hh' },
      { r: 1, c: 3, v: +2.19, sig: true, lisa: 'hh' },
      { r: 2, c: 0, v: +1.62, sig: true, lisa: 'ns' },
      { r: 2, c: 1, v: +2.24, sig: true, lisa: 'hh' },
      { r: 2, c: 2, v: +2.53, sig: true, lisa: 'hh' },
      { r: 2, c: 3, v: +2.08, sig: true, lisa: 'hh' },
      { r: 3, c: 0, v: +1.41, sig: false, lisa: 'ns' },
      { r: 3, c: 1, v: +1.77, sig: true, lisa: 'ns' },
      { r: 3, c: 2, v: +2.15, sig: true, lisa: 'hh' },
      { r: 3, c: 3, v: +1.98, sig: true, lisa: 'hh' },
    ],
  },
  {
    key: 'case4',
    name: 'Midwest Ag',
    varName: 'PRECTOTCORR Precip',
    rate: '+0.31 mm/d / dec',
    tau: '+0.388',
    pVal: '0.0024',
    qVal: '0.0081',
    lisa: 'Hydro Regime',
    lisaColor: '#06b6d4',
    cells: [
      { r: 0, c: 0, v: +0.22, sig: true, lisa: 'll' },
      { r: 0, c: 1, v: +0.28, sig: true, lisa: 'll' },
      { r: 0, c: 2, v: +0.34, sig: true, lisa: 'll' },
      { r: 0, c: 3, v: +0.31, sig: true, lisa: 'll' },
      { r: 1, c: 0, v: +0.25, sig: true, lisa: 'll' },
      { r: 1, c: 1, v: +0.33, sig: true, lisa: 'll' },
      { r: 1, c: 2, v: +0.39, sig: true, lisa: 'll' },
      { r: 1, c: 3, v: +0.35, sig: true, lisa: 'll' },
      { r: 2, c: 0, v: +0.18, sig: false, lisa: 'ns' },
      { r: 2, c: 1, v: +0.29, sig: true, lisa: 'll' },
      { r: 2, c: 2, v: +0.36, sig: true, lisa: 'll' },
      { r: 2, c: 3, v: +0.30, sig: true, lisa: 'll' },
      { r: 3, c: 0, v: +0.14, sig: false, lisa: 'ns' },
      { r: 3, c: 1, v: +0.21, sig: false, lisa: 'ns' },
      { r: 3, c: 2, v: +0.27, sig: true, lisa: 'ns' },
      { r: 3, c: 3, v: +0.32, sig: true, lisa: 'll' },
    ],
  },
];

export default function WorkstationHeroPreview() {
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState(0);
  const [selectedCellIdx, setSelectedCellIdx] = useState(5);
  const [viewMode, setViewMode] = useState('slope'); // 'slope' | 'lisa'

  const current = HERO_PRESETS[activePreset];
  const activeCell = current.cells[selectedCellIdx] || current.cells[0];

  const handleLaunch = () => {
    playTactileClick(800);
    useStore.getState().loadPreset(current.key);
    navigate('/dashboard');
  };

  return (
    <div className="w-full mt-10 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border-default)] shadow-xl overflow-hidden transition-all">
      {/* Chrome Window Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)] text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]/70" />
          </div>
          <span className="ml-2 text-[var(--color-text-muted)]">tellura-workstation://telemetry-preview</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE</span>
          </span>
          <span className="text-[var(--color-text-muted)]">•</span>
          <span className="text-[10px] text-[var(--color-text-secondary)]">NASA CF-1.8 Engine</span>
        </div>
      </div>

      {/* Preset Ribbon */}
      <div className="px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-mono text-[var(--color-text-muted)] tracking-wider mr-1">Transects:</span>
          {HERO_PRESETS.map((p, idx) => (
            <button
              key={p.key}
              onClick={() => {
                playTactileClick(650);
                setActivePreset(idx);
                setSelectedCellIdx(5);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                activePreset === idx
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold shadow-xs'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-hover)]'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              playTactileClick(600);
              setViewMode(viewMode === 'slope' ? 'lisa' : 'slope');
            }}
            className="px-2.5 py-1 rounded text-[10px] font-mono border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors"
          >
            Mode: {viewMode === 'slope' ? 'Slope Density' : 'LISA Cluster'}
          </button>
          <button
            onClick={handleLaunch}
            className="interface-btn-primary !py-1 !px-3 !text-[11px] font-mono"
          >
            Launch Transect &rarr;
          </button>
        </div>
      </div>

      {/* Workstation Simulation Grid */}
      <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6 items-center bg-[var(--color-bg-deep)]">
        {/* Spatial 4x4 Grid Matrix */}
        <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
          <div className="w-full flex items-center justify-between text-[11px] font-mono text-[var(--color-text-muted)] mb-3">
            <span>Spatial Grid: 4×4 Observational Sub-matrix</span>
            <span>Click cell to inspect</span>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full max-w-md aspect-square">
            {current.cells.map((c, i) => {
              const isSelected = selectedCellIdx === i;
              let bg = 'rgba(255, 255, 255, 0.03)';
              let border = 'var(--color-border-subtle)';
              let textClr = 'var(--color-text-main)';

              if (viewMode === 'slope') {
                if (c.v > 1.0) bg = 'rgba(239, 68, 68, 0.25)';
                else if (c.v > 0.4) bg = 'rgba(239, 68, 68, 0.18)';
                else if (c.v > 0.25) bg = 'rgba(245, 158, 11, 0.15)';
                else bg = 'rgba(6, 182, 212, 0.15)';
              } else {
                if (c.lisa === 'hh') {
                  bg = 'rgba(239, 68, 68, 0.25)';
                  border = 'rgba(239, 68, 68, 0.4)';
                } else if (c.lisa === 'll') {
                  bg = 'rgba(6, 182, 212, 0.25)';
                  border = 'rgba(6, 182, 212, 0.4)';
                } else {
                  bg = 'var(--color-bg-elevated)';
                }
              }

              if (isSelected) {
                border = 'var(--color-accent-blue)';
              }

              return (
                <button
                  key={i}
                  onClick={() => {
                    playTactileClick(700);
                    setSelectedCellIdx(i);
                  }}
                  style={{ background: bg, borderColor: border }}
                  className={`rounded-md p-2 flex flex-col items-center justify-center border transition-all text-center relative group cursor-pointer ${
                    isSelected ? 'ring-2 ring-[var(--color-accent-blue)] scale-[1.03] z-10 shadow-md' : 'hover:scale-[1.01]'
                  }`}
                >
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)] block">
                    [{c.r},{c.c}]
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold tabular-nums" style={{ color: textClr }}>
                    {c.v > 0 ? '+' : ''}{c.v.toFixed(2)}
                  </span>
                  <span className="text-[9px] font-mono mt-0.5" style={{ color: c.sig ? '#10b981' : 'var(--color-text-muted)' }}>
                    {c.sig ? 'q ≤ 0.05' : 'q > 0.05'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Telemetry Inspector Panel */}
        <div className="flex flex-col justify-between space-y-4 p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-xs font-mono h-full">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)] mb-3">
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">Active Cell Telemetry</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-accent-blue-subtle)] text-[var(--color-accent-blue)]">
                [{activeCell.r}, {activeCell.c}]
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block">Observed Parameter:</span>
                <span className="font-semibold text-[var(--color-text-main)]">{current.varName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--color-text-muted)] block">Sen’s Robust Slope:</span>
                <span className="font-bold text-[var(--color-text-main)] text-sm tabular-nums">
                  {activeCell.v > 0 ? '+' : ''}{activeCell.v.toFixed(3)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-border-subtle)]">
                <div>
                  <span className="text-[9px] text-[var(--color-text-muted)] block">Mann-Kendall τ</span>
                  <span className="font-semibold text-[var(--color-accent-blue)] tabular-nums">{current.tau}</span>
                </div>
                <div>
                  <span className="text-[9px] text-[var(--color-text-muted)] block">p-value</span>
                  <span className="font-semibold text-emerald-500 tabular-nums">{current.pVal}</span>
                </div>
              </div>
              <div className="pt-1 border-t border-[var(--color-border-subtle)]">
                <span className="text-[9px] text-[var(--color-text-muted)] block">Spatial Regime:</span>
                <span className="font-semibold text-xs" style={{ color: current.lisaColor }}>
                  {current.lisa}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-2">
            <button
              onClick={handleLaunch}
              className="w-full interface-btn-primary !py-2 !text-xs font-mono justify-center font-semibold"
            >
              Analyze in Workspace &rarr;
            </button>
            <p className="text-[9px] text-[var(--color-text-muted)] text-center leading-normal">
              Direct connection to 44-yr NASA POWER & MERRA-2 observational data streams.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
