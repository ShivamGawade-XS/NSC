/**
 * EarthSift Utility Functions
 * Coordinate formatting, color scales, and statistical helpers.
 */

// Coordinate formatting: proper N/S and E/W cardinal directions
export function formatCoords(lat, lon) {
  const ns = lat >= 0 ? `${Math.abs(lat).toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
  const ew = lon >= 0 ? `${Math.abs(lon).toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`;
  return `${ns}, ${ew}`;
}

export function formatCoords1(lat, lon) {
  const ns = lat >= 0 ? `${Math.abs(lat).toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const ew = lon >= 0 ? `${Math.abs(lon).toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return `${ns}, ${ew}`;
}

// Statistical p-value formatter
export function formatPVal(p) {
  if (p === null || p === undefined) return 'N/A';
  if (p < 0.0001) return '< 0.0001';
  return p.toFixed(4);
}

// 5-stop scientific diverging color scale (Blue → Slate → Red)
export function getTrendColor(slope, minVal, maxVal) {
  if (slope === 0 || Math.abs(slope) < 1e-6) return 'rgba(100, 116, 139, 0.4)';
  if (slope > 0) {
    const max = maxVal && maxVal > 0 ? maxVal : 0.5;
    const norm = Math.min(1.0, slope / max);
    let r, g, b;
    if (norm < 0.5) {
      const t = norm / 0.5;
      r = Math.round(100 + (245 - 100) * t);
      g = Math.round(116 + (158 - 116) * t);
      b = Math.round(139 + (11 - 139) * t);
    } else {
      const t = (norm - 0.5) / 0.5;
      r = Math.round(245 + (239 - 245) * t);
      g = Math.round(158 + (68 - 158) * t);
      b = Math.round(11 + (68 - 11) * t);
    }
    return `rgba(${r}, ${g}, ${b}, ${0.5 + 0.45 * norm})`;
  } else {
    const min = minVal && minVal < 0 ? Math.abs(minVal) : 0.5;
    const norm = Math.min(1.0, Math.abs(slope) / min);
    let r, g, b;
    if (norm < 0.5) {
      const t = norm / 0.5;
      r = Math.round(100 + (56 - 100) * t);
      g = Math.round(116 + (189 - 116) * t);
      b = Math.round(139 + (248 - 139) * t);
    } else {
      const t = (norm - 0.5) / 0.5;
      r = Math.round(56 + (37 - 56) * t);
      g = Math.round(189 + (99 - 189) * t);
      b = Math.round(248 + (235 - 248) * t);
    }
    return `rgba(${r}, ${g}, ${b}, ${0.5 + 0.45 * norm})`;
  }
}

// LISA spatial cluster colors
export function getLISAColor(cluster) {
  const colors = {
    HH: '#ef4444', LL: '#38bdf8', HL: '#f59e0b',
    LH: '#10b981', NS: 'rgba(100, 116, 139, 0.35)',
  };
  return colors[cluster] || colors.NS;
}

// Compound hazard type colors
export function getHazardColor(type) {
  const colors = {
    severe_aridification: '#ef4444', compound_aridification: '#ef4444',
    hydrologic_intensification: '#3b82f6', hydrological_intensification: '#3b82f6',
    moderate_drying: '#f59e0b', thermal_buffering: '#10b981',
  };
  return colors[type] || '#64748b';
}

// LISA cluster labels
export const LISA_LABELS = {
  HH: 'HH (High-High Hotspot)', LL: 'LL (Low-Low Coldspot)',
  HL: 'HL (High-Low Spatial Outlier)', LH: 'LH (Low-High Spatial Outlier)',
  NS: 'NS (Not Significant)',
};

// Dataset variables map
export const DATASET_VARIABLES = {
  nasa_power: [
    { id: 'T2M', label: '2-Meter Air Temperature (T2M) [°C]' },
    { id: 'PRECTOTCORR', label: 'Total Corrected Precipitation [mm/day]' },
  ],
  merra2_reanalysis: [
    { id: 'T2M', label: '2-Meter Air Temperature (T2M) [°C]' },
    { id: 'PRECTOT', label: 'Total Precipitation Rate (PRECTOT) [mm/day]' },
  ],
};

// Detective Case Presets
export const DETECTIVE_PRESETS = {
  case1: {
    dataset: 'nasa_power', variable: 'T2M', startYear: 2000, endYear: 2023,
    bbox: [-102.0, 30.0, -94.0, 38.0],
    desc: 'Texas & Southern Plains Heat Acceleration (NASA POWER Verified)',
  },
  case2: {
    dataset: 'merra2_reanalysis', variable: 'T2M', startYear: 2000, endYear: 2020,
    bbox: [-101.0, 31.0, -95.0, 37.0], isCompound: true,
    desc: 'Southwest US Compound Aridification (T + P Dual Hazard)',
  },
  case3: {
    dataset: 'merra2_reanalysis', variable: 'T2M', startYear: 1990, endYear: 2023,
    bbox: [-125.0, 25.0, -65.0, 50.0],
    desc: 'North American Continental Synoptic Footprint',
  },
  case4: {
    dataset: 'nasa_power', variable: 'PRECTOTCORR', startYear: 2000, endYear: 2023,
    bbox: [-100.0, 32.0, -92.0, 40.0],
    desc: 'Agricultural Belt Hydrological Variability',
  },
};
