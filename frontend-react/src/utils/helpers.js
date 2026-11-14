/**
 * Tellura Utility Functions
 * Coordinate formatting, color scales, and statistical helpers.
 */

// XSS sanitization helper for safe DOM and Leaflet tooltip insertion
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

// Dataset variables map with high school & student friendly Detective Field Guides
export const DATASET_VARIABLES = {
  nasa_power: [
    {
      id: 'T2M',
      label: '2-Meter Air Temperature (T2M) [°C]',
      plainName: 'Surface Air Temperature (2m)',
      domain: 'Thermal & Temperature',
      units: '°C',
      description: 'Surface air temperature 2m above ground level',
      eli5: 'The temperature of the air at head-height (2 meters above ground). This is the ambient temperature humans, livestock, and crops physically experience.',
      earthSystemRole: 'Direct indicator of Earth\'s surface energy budget and greenhouse thermal accumulation.',
      detectiveClue: 'Rising = accelerated warming or heatwaves; Falling = local thermal cooling or marine buffering.',
      missions: 'Assimilated from MODIS (Terra/Aqua), AIRS, and NASA GMAO GEOS-5 FP-IT atmospheric models.',
    },
    {
      id: 'PRECTOTCORR',
      label: 'Total Corrected Precipitation [mm/day]',
      plainName: 'Daily Precipitation Rate',
      domain: 'Hydrology & Precipitation',
      units: 'mm/day',
      description: 'Precipitation rate corrected for gauge undercatch',
      eli5: 'The total amount of rain, drizzle, and snow falling each day, mathematically corrected for wind blowoff around rain gauges.',
      earthSystemRole: 'Drives freshwater availability, river streamflow, soil moisture recharge, and flood risk.',
      detectiveClue: 'Rising = intensified rainfall and flood hazards; Falling = prolonged agricultural or meteorological drought.',
      missions: 'Integrated from Global Precipitation Measurement (GPM), GPCP satellite precipitation grids, and MERRA-2.',
    },
    {
      id: 'ALLSKY_SFC_SW_DWN',
      label: 'Solar Irradiance (ALLSKY_SFC_SW_DWN) [MJ/m²/day]',
      plainName: 'All-Sky Downward Solar Energy',
      domain: 'Radiative & Solar Energy',
      units: 'MJ/m²/day',
      description: 'All-sky downward shortwave flux (2000/2001 sensor transition)',
      eli5: 'The total solar sunlight energy reaching Earth\'s surface each day under actual cloud conditions (clear, overcast, and hazy).',
      earthSystemRole: 'Powers photosynthesis, surface heating, cloud dynamics, and solar photovoltaic energy production.',
      detectiveClue: 'Rising = solar brightening or cloud thinning; Falling = solar dimming or increased cloud/aerosol reflection.',
      missions: 'Measured by Clouds and the Earth\'s Radiant Energy System (CERES) and GEWEX Surface Radiation Budget (SRB).',
      discontinuityWarning: 'Crosses GEWEX SRB to CERES SYN1deg satellite transition in 2000.',
    },
    {
      id: 'WS10M',
      label: '10-Meter Wind Speed (WS10M) [m/s]',
      plainName: '10-Meter Surface Wind Velocity',
      domain: 'Atmospheric Dynamics',
      units: 'm/s',
      description: 'Surface wind velocity at 10m altitude from GEOS-5 FP-IT',
      eli5: 'How fast the wind is blowing at 10 meters (about the height of a two-story building or wind turbine hub).',
      earthSystemRole: 'Controls turbulent heat exchange between land and air, wildfire spread rates, and wind energy yields.',
      detectiveClue: 'Rising = storminess or enhanced pressure gradients; Falling = atmospheric stilling.',
      missions: 'NASA GMAO GEOS-5 FP-IT atmospheric assimilation system.',
    },
    {
      id: 'RH2M',
      label: '2-Meter Relative Humidity (RH2M) [%]',
      plainName: 'Relative Humidity at 2m',
      domain: 'Moisture & Humidity',
      units: '%',
      description: 'Surface relative humidity percentage',
      eli5: 'How close the air is to being completely saturated with water vapor. 100% means fog or rain; low percentages mean dry, thirsty air.',
      earthSystemRole: 'Regulates human heat index, plant transpiration stress, and wildfire fuel dryness.',
      detectiveClue: 'Falling = atmospheric aridification and flash drought; Rising = increased boundary layer moisture.',
      missions: 'NASA GMAO GEOS-5 FP-IT surface atmospheric assimilation.',
    },
  ],
  merra2_reanalysis: [
    {
      id: 'T2M',
      label: '2-Meter Air Temperature (T2M) [°C]',
      plainName: 'MERRA-2 Reanalysis Temperature',
      domain: 'Thermal & Temperature',
      units: '°C',
      description: 'GMAO GEOS-5 Atmospheric Data Assimilation System 2m temperature',
      eli5: 'Continuously modeled 2-meter air temperature combining decades of weather balloon, satellite sounder, and ground station data.',
      earthSystemRole: 'Synoptic-scale continental temperature monitoring with global physical conservation laws.',
      detectiveClue: 'Rising = macro-scale polar or continental warming amplification.',
      missions: 'NASA Goddard Earth Observing System Version 5 (GEOS-5) ADAS.',
    },
    {
      id: 'PRECTOT',
      label: 'Total Precipitation Rate (PRECTOT) [mm/day]',
      plainName: 'MERRA-2 Total Precipitation',
      domain: 'Hydrology & Precipitation',
      units: 'mm/day',
      description: 'Total convective and large-scale precipitation flux',
      eli5: 'Total precipitation generated by convective storm clouds plus broad large-scale weather fronts.',
      earthSystemRole: 'Captures continental atmospheric water cycles and monsoonal moisture transports.',
      detectiveClue: 'Rising = convective storm intensification; Falling = sub-continental drying.',
      missions: 'NASA GMAO GEOS-5 atmospheric assimilation with satellite radar/gauge integration.',
    },
  ],
  planetary_computer: [
    {
      id: 'NDVI',
      label: 'Normalized Difference Vegetation Index (NDVI) [30m / 10m]',
      plainName: 'Canopy Greenness & Vegetation Health',
      domain: 'Biosphere & Terrestrial Vegetation',
      units: 'index [-1, 1]',
      description: 'Photosynthetic canopy vigor derived from Landsat 8/9 & Sentinel-2 L2A surface reflectance',
      eli5: 'A measure of how green and healthy plants are, calculated from how leaves reflect near-infrared sunlight.',
      earthSystemRole: 'Direct proxy for terrestrial primary productivity, forest biomass, and agricultural vigor.',
      detectiveClue: 'Rising = vegetative greening or agricultural expansion; Falling = canopy dieback, deforestation, or drought stress.',
      missions: 'USGS/NASA Landsat 8/9 Collection 2 & ESA Copernicus Sentinel-2 via Planetary Computer STAC (Global Offer 2026).',
    },
    {
      id: 'NDWI',
      label: 'Normalized Difference Water Index (NDWI) [30m / 10m]',
      plainName: 'Surface Water & Canopy Moisture',
      domain: 'Hydrology & Surface Water',
      units: 'index [-1, 1]',
      description: 'Surface water delineation and leaf moisture content (Green & NIR reflectance)',
      eli5: 'Highlights open water bodies, wetlands, and water content inside plant leaves.',
      earthSystemRole: 'Monitors reservoir levels, wetland retreat, and surface hydrological changes.',
      detectiveClue: 'Falling = drying reservoirs and shrinking wetlands; Rising = flooding and inundation expansion.',
      missions: 'USGS/NASA Landsat 8/9 & ESA Sentinel-2 via Planetary Computer STAC (Global Offer 2026).',
    },
  ],
};

// Official WMO / GCOS Essential Climate Variable (ECV) Taxonomy Mapping
export const GCOS_ECV_MAP = {
  T2M: 'GCOS ECV-A.1: Atmospheric Surface Temperature',
  PRECTOT: 'GCOS ECV-A.2: Surface Precipitation (Flux)',
  PRECTOTCORR: 'GCOS ECV-A.2: Surface Precipitation (Wind-Corrected)',
  ALLSKY_SFC_SW_DWN: 'GCOS ECV-A.5: Surface Radiation Budget (Shortwave)',
  WS10M: 'GCOS ECV-A.3: Surface Wind Speed & Dynamics',
  RH2M: 'GCOS ECV-A.4: Atmospheric Water Vapor (2m RH)',
  NDVI: 'GCOS ECV-T.1: Terrestrial Vegetation Greenness (Planetary STAC 30m/10m)',
  NDWI: 'GCOS ECV-T.2: Terrestrial Surface Water Index (Planetary STAC 30m/10m)',
  Compound: 'WCRP Compound Climate Hazard (Copula Bivariate)',
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
  case5: {
    dataset: 'nasa_power', variable: 'T2M', startYear: 2000, endYear: 2023,
    bbox: [-103.0, 26.0, -93.0, 36.0],
    desc: 'Opposing Synoptic Contrasts (Inland Thermal Spikes vs Coastal Marine Buffering)',
  },
};
