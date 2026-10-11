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
          Regional Transect Presets
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DETECTIVE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => loadPreset(key)}
              className="preset-pill font-mono text-[11px]"
              title={preset.desc}
            >
              {key === 'case1' && 'Texas Thermal Basin'}
              {key === 'case2' && 'SW Arid Transect'}
              {key === 'case3' && 'Continental CONUS'}
              {key === 'case4' && 'Midwest Ag Corridor'}
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
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md px-4 py-2.5 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isLoading ? (
            <>
              <span className="loading-spinner !w-3.5 !h-3.5 !border-2" />
              Computing Trends...
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Execute Trend Detection
            </span>
          )}
        </button>

        <button
          onClick={executeCompoundAnalysis}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-amber-600/50 text-neutral-300 hover:text-amber-400 rounded-md px-4 py-2 text-xs font-medium transition-all disabled:opacity-50"
        >
          <svg className="w-3.5 h-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
          Compound Hazard Analysis (T & P)
        </button>
      </div>
    </div>
  );
}
