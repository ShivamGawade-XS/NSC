import useStore from '../store/useStore';
import { DATASET_VARIABLES, DETECTIVE_PRESETS } from '../utils/helpers';

export default function AnalysisPanel() {
  const {
    dataset, variable, startYear, endYear, bbox, useFdr, isLoading,
    setFormField, setBbox, clearBbox, executeAnalysis, executeCompoundAnalysis, loadPreset,
  } = useStore();

  const variables = DATASET_VARIABLES[dataset] || DATASET_VARIABLES.nasa_power;
  const yearCount = Math.max(0, endYear - startYear + 1);

  const handleBboxChange = (field, value) => {
    setBbox({ ...bbox, [field]: value });
  };

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Quick Preset Ribbon */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2 font-semibold">
          Quick Investigations
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DETECTIVE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => loadPreset(key)}
              className="preset-pill"
              title={preset.desc}
            >
              {key === 'case1' && '🌡️ Texas Heat'}
              {key === 'case2' && '🔥 SW Drought'}
              {key === 'case3' && '🌎 Continental'}
              {key === 'case4' && '🌧️ Ag Belt'}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-border-subtle" />

      {/* Dataset Selection */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-semibold">
            Data Source
          </label>
          <select
            value={dataset}
            onChange={(e) => {
              setFormField('dataset', e.target.value);
              const vars = DATASET_VARIABLES[e.target.value];
              if (vars?.[0]) setFormField('variable', vars[0].id);
            }}
            className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-main focus:border-accent-cyan focus:outline-none transition-colors"
          >
            <option value="nasa_power">NASA POWER (LaRC)</option>
            <option value="merra2_reanalysis">MERRA-2 Reanalysis (GMAO)</option>
          </select>
          <p className="text-[9px] text-text-muted mt-1 font-[var(--font-mono)]">
            {dataset === 'nasa_power'
              ? 'NASA Langley Research Center • CF-1.8 • DOI: 10.5067/POWER/10.0.0'
              : 'NASA GMAO • CF-1.6 • DOI: 10.5067/A7F0JNNUTWOB'}
          </p>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-semibold">
            Variable
          </label>
          <select
            value={variable}
            onChange={(e) => setFormField('variable', e.target.value)}
            className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-main focus:border-accent-cyan focus:outline-none transition-colors"
          >
            {variables.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-semibold">Start Year</label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setFormField('startYear', parseInt(e.target.value, 10))}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-main font-[var(--font-mono)] focus:border-accent-cyan focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5 font-semibold">End Year</label>
            <input
              type="number"
              value={endYear}
              onChange={(e) => setFormField('endYear', parseInt(e.target.value, 10))}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-main font-[var(--font-mono)] focus:border-accent-cyan focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[9px] text-text-muted font-[var(--font-mono)]">
          {yearCount} consecutive annual records
        </p>

        {/* BBox */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">
              Bounding Box
            </label>
            <button
              onClick={clearBbox}
              className="text-[9px] text-accent-cyan hover:underline"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['minLon', 'Min Lon'],
              ['minLat', 'Min Lat'],
              ['maxLon', 'Max Lon'],
              ['maxLat', 'Max Lat'],
            ].map(([field, label]) => (
              <input
                key={field}
                type="number"
                step="0.1"
                placeholder={label}
                value={bbox[field]}
                onChange={(e) => handleBboxChange(field, e.target.value)}
                className="bg-bg-elevated border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-main font-[var(--font-mono)] placeholder:text-text-muted/50 focus:border-accent-cyan focus:outline-none"
              />
            ))}
          </div>
        </div>

        {/* FDR Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">FDR Correction (q ≤ 0.05)</span>
          <button
            onClick={() => setFormField('useFdr', !useFdr)}
            className={`toggle-switch ${useFdr ? 'active' : ''}`}
          />
        </div>
      </div>

      <div className="w-full h-px bg-border-subtle" />

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          onClick={executeAnalysis}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent-cyan/20 to-accent-blue/20 border border-accent-cyan/30 hover:border-accent-cyan/60 text-accent-cyan rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <span className="loading-spinner !w-4 !h-4 !border-2" />
              Computing Trends...
            </>
          ) : (
            <>⚡ Run Trend Detection</>
          )}
        </button>

        <button
          onClick={executeCompoundAnalysis}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-bg-elevated border border-border-subtle hover:border-accent-warming/40 text-text-secondary hover:text-accent-warming rounded-lg px-4 py-2 text-xs font-medium transition-all disabled:opacity-50"
        >
          🔥 Compound Hazard (T + P)
        </button>
      </div>
    </div>
  );
}
