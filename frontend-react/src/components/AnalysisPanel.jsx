import { useState } from 'react';
import useStore from '../store/useStore';
import { DATASET_VARIABLES, DETECTIVE_PRESETS } from '../utils/helpers';
import { playTactileClick } from '../utils/audio';

export default function AnalysisPanel() {
  const {
    dataset, variable, startYear, endYear, bbox, useFdr, isLoading,
    setFormField, setBbox, clearBbox, executeAnalysis, executeCompoundAnalysis, loadPreset,
    setCustomDataModalOpen,
  } = useStore();

  const [validationError, setValidationError] = useState('');
  const [isCooldown, setIsCooldown] = useState(false);

  const variables = DATASET_VARIABLES[dataset] || DATASET_VARIABLES.nasa_power;
  const yearCount = Math.max(0, endYear - startYear + 1);

  const handleBboxChange = (field, value) => {
    setValidationError('');
    setBbox({ ...bbox, [field]: value });
  };

  const validateInputs = () => {
    // Year validation
    if (isNaN(startYear) || isNaN(endYear)) {
      return 'Please specify valid numeric calendar years.';
    }
    if (startYear < 1980 || endYear > 2026) {
      return 'Observation temporal window must fall between 1980 and 2026.';
    }
    if (startYear > endYear) {
      return `Start year (${startYear}) cannot be greater than end year (${endYear}).`;
    }
    if (yearCount < 3) {
      return 'At least 3 consecutive annual observations are required for Mann-Kendall trend testing.';
    }

    // BBox validation if coordinates entered
    const { minLon, minLat, maxLon, maxLat } = bbox;
    const hasAnyCoord = minLon !== '' || minLat !== '' || maxLon !== '' || maxLat !== '';

    if (hasAnyCoord) {
      const minLo = parseFloat(minLon);
      const minLa = parseFloat(minLat);
      const maxLo = parseFloat(maxLon);
      const maxLa = parseFloat(maxLat);

      if (isNaN(minLo) || isNaN(minLa) || isNaN(maxLo) || isNaN(maxLa)) {
        return 'All 4 spatial bounding coordinates (min/max latitude and longitude) must be provided.';
      }
      if (minLa < -90 || minLa > 90 || maxLa < -90 || maxLa > 90) {
        return 'Latitude coordinates must fall between -90° and +90°.';
      }
      if (minLo < -180 || minLo > 180 || maxLo < -180 || maxLo > 180) {
        return 'Longitude coordinates must fall between -180° and +180°.';
      }
      if (minLa >= maxLa) {
        return `Minimum latitude (${minLa}°) must be less than maximum latitude (${maxLa}°).`;
      }
      if (minLo >= maxLo) {
        return `Minimum longitude (${minLo}°) must be less than maximum longitude (${maxLo}°).`;
      }
    }

    return '';
  };

  const handleExecute = (isCompound = false) => {
    if (isLoading || isCooldown) return;

    const errorMsg = validateInputs();
    if (errorMsg) {
      setValidationError(errorMsg);
      playTactileClick(350);
      return;
    }

    setValidationError('');
    setIsCooldown(true);
    setTimeout(() => setIsCooldown(false), 1200);

    if (isCompound) {
      playTactileClick(800);
      executeCompoundAnalysis();
    } else {
      playTactileClick(850);
      executeAnalysis();
    }
  };

  return (
    <div className="interface-card p-4 space-y-4">
      {/* Quick Preset Ribbon */}
      <div>
        <div className="eyebrow-label mb-2">
          Exemplar Transect Presets
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(DETECTIVE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => {
                setValidationError('');
                playTactileClick(700);
                loadPreset(key);
              }}
              className="preset-pill font-mono text-[10px]"
              title={preset.desc}
            >
              {key === 'case1' && 'Texas Basin'}
              {key === 'case2' && 'SW Transect'}
              {key === 'case3' && 'CONUS Continental'}
              {key === 'case4' && 'Midwest Ag'}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-[var(--color-border-subtle)]" />

      {/* Dataset Selection */}
      <div className="space-y-3.5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="eyebrow-label" htmlFor="data-stream-select">
              Data Stream
            </label>
            <button
              type="button"
              onClick={() => {
                playTactileClick(700);
                setCustomDataModalOpen(true);
              }}
              className="text-[10px] text-[var(--color-accent-blue)] hover:underline font-mono flex items-center gap-1 cursor-pointer"
              title="Upload your own GeoJSON/JSON dataset"
            >
              <span>+ Ingest Data</span>
            </button>
          </div>
          <select
            id="data-stream-select"
            value={dataset}
            onChange={(e) => {
              setFormField('dataset', e.target.value);
              const vars = DATASET_VARIABLES[e.target.value];
              if (vars?.[0]) setFormField('variable', vars[0].id);
            }}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-2 text-xs text-[var(--color-text-main)] focus:border-[var(--color-accent-blue)] focus:outline-none transition-colors"
          >
            <option value="nasa_power">NASA POWER (LaRC Synoptic)</option>
            <option value="merra2_reanalysis">MERRA-2 Reanalysis (GMAO)</option>
          </select>
          <p className="text-[9px] text-[var(--color-text-muted)] mt-1 font-mono">
            {dataset === 'nasa_power'
              ? 'NASA Langley Research Center • CF-1.8 • DOI: 10.5067/POWER/10.0.0'
              : 'NASA GMAO Atmospheric • CF-1.6 • DOI: 10.5067/A7F0JNNUTWOB'}
          </p>
        </div>

        <div>
          <label className="eyebrow-label block mb-1.5" htmlFor="variable-select">
            Variable
          </label>
          <select
            id="variable-select"
            value={variable}
            onChange={(e) => setFormField('variable', e.target.value)}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-3 py-2 text-xs text-[var(--color-text-main)] focus:border-[var(--color-accent-blue)] focus:outline-none transition-colors"
          >
            {variables.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="eyebrow-label block mb-1" htmlFor="start-year-input">Start Year</label>
            <input
              id="start-year-input"
              type="number"
              min="1980"
              max="2026"
              value={startYear}
              onChange={(e) => {
                setValidationError('');
                setFormField('startYear', parseInt(e.target.value, 10));
              }}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
            />
          </div>
          <div>
            <label className="eyebrow-label block mb-1" htmlFor="end-year-input">End Year</label>
            <input
              id="end-year-input"
              type="number"
              min="1980"
              max="2026"
              value={endYear}
              onChange={(e) => {
                setValidationError('');
                setFormField('endYear', parseInt(e.target.value, 10));
              }}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-main)] font-mono focus:border-[var(--color-accent-blue)] focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[9px] text-[var(--color-text-muted)] font-mono">
          {yearCount} consecutive annual observations
        </p>

        {/* BBox */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="eyebrow-label">
              Spatial Bounding Box
            </span>
            <button
              type="button"
              onClick={() => {
                playTactileClick(500);
                setValidationError('');
                clearBbox();
              }}
              className="text-[9px] font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['minLon', 'Min Lon', 'Longitude: -180 to +180'],
              ['minLat', 'Min Lat', 'Latitude: -90 to +90'],
              ['maxLon', 'Max Lon', 'Longitude: -180 to +180'],
              ['maxLat', 'Max Lat', 'Latitude: -90 to +90'],
            ].map(([field, label, title]) => (
              <input
                key={field}
                type="number"
                step="0.1"
                placeholder={label}
                title={title}
                value={bbox[field]}
                onChange={(e) => handleBboxChange(field, e.target.value)}
                className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-main)] font-mono placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-blue)] focus:outline-none"
              />
            ))}
          </div>
        </div>

        {/* FDR Toggle */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-[var(--color-text-secondary)] font-mono">FDR Correction (q ≤ 0.05)</span>
          <button
            type="button"
            onClick={() => {
              playTactileClick(600);
              setFormField('useFdr', !useFdr);
            }}
            className={`toggle-switch ${useFdr ? 'active' : ''}`}
            aria-label="Toggle Benjamini-Hochberg False Discovery Rate Correction"
          />
        </div>
      </div>

      {/* Inline Form Validation Error Alert */}
      {validationError && (
        <div
          role="alert"
          className="p-2.5 rounded bg-red-950/20 border border-red-500/40 text-red-300 text-[11px] flex items-start gap-2 leading-tight"
        >
          <svg className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="font-mono">{validationError}</span>
        </div>
      )}

      <div className="w-full h-px bg-[var(--color-border-subtle)]" />

      {/* Action Buttons with Spam Protection / Cooldown */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => handleExecute(false)}
          disabled={isLoading || isCooldown}
          className="w-full interface-btn-primary !py-2.5 !text-xs !tracking-wider uppercase font-semibold disabled:opacity-50 disabled:cursor-not-allowed justify-center"
        >
          {isLoading ? (
            <>
              <span className="loading-spinner !w-3 !h-3 !border-2" />
              <span>Computing Trends...</span>
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              <span>{isCooldown ? 'Cooldown Active...' : 'Execute Trend Detection'}</span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleExecute(true)}
          disabled={isLoading || isCooldown}
          className="w-full interface-btn-secondary !py-2 !text-xs font-mono justify-center hover:border-[#f59e0b]/40 hover:text-[#f59e0b] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-3.5 h-3.5 shrink-0 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
          <span>Compound Hazard Analysis (T & P)</span>
        </button>
      </div>
    </div>
  );
}
