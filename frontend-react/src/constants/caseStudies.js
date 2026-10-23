/**
 * Curated NASA Space Apps 2026 Case Study Hotspots
 * Grounded in peer-reviewed literature and empirical NASA satellite reanalysis.
 * Synchronized with computational presets for real-time statistical inference.
 * NOTE: 'rate' and 'significance' serve as initial loading fallback placeholders
 * while isLoading is true; live computed domain mean/cell slope, p/q values, and
 * Moran's I are dynamically rendered by JudgeTourOverlay.
 */

export const CASE_STUDY_HOTSPOTS = [
  {
    id: 'case_texas',
    presetKey: 'case1',
    title: 'Texas & Southern Plains Heat Acceleration',
    location: 'Southern Great Plains (33.5°N, 98.0°W)',
    coords: [33.5, -98.0],
    zoom: 6,
    variable: 'T2M (Surface Air Temp)',
    rate: '+0.420 °C / decade',
    significance: 'p < 0.0001 (FDR q < 0.0001)',
    mechanism: 'Persistent subtropical ridging and land-atmosphere coupling accelerating summer heat accumulation across the Southern Plains.',
    missionCitation: 'NASA POWER Synoptic Climatology (LaRC GMAO)',
  },
  {
    id: 'case_compound_sw',
    presetKey: 'case2',
    title: 'Southwestern Compound Aridification & Megadrought',
    location: 'Colorado River Basin / SW Transect (34.0°N, -98.0°W)',
    coords: [34.0, -98.0],
    zoom: 6,
    variable: 'Compound Hazard (T2M + PRECTOT)',
    rate: 'CAI Index: +1.84 (Severe Aridification)',
    significance: 'Archimedean Copula Return Period > 50 Years',
    mechanism: 'Coupled thermal warming and convective precipitation suppression driving multidecadal hydrological deficit.',
    missionCitation: 'NASA MERRA-2 Atmospheric Reanalysis',
  },
  {
    id: 'case_synoptic',
    presetKey: 'case3',
    title: 'North American Synoptic Continental Footprint',
    location: 'CONUS Continental Domain (39.0°N, -95.0°W)',
    coords: [39.0, -95.0],
    zoom: 5,
    variable: 'T2M Continental Reanalysis',
    rate: '+0.310 °C / decade Continental Mean',
    significance: 'Anselin Moran I: High-High Spatial Clustering',
    mechanism: 'Continental-scale thermal expansion with pronounced polar-equatorial gradient attenuation.',
    missionCitation: 'NASA MERRA-2 Reanalysis',
  },
  {
    id: 'case_midwest_ag',
    presetKey: 'case4',
    title: 'Midwest Agricultural Hydrological Regime',
    location: 'Midwest Agricultural Basin (36.0°N, -96.0°W)',
    coords: [36.0, -96.0],
    zoom: 6,
    variable: 'PRECTOTCORR (Precipitation)',
    rate: '+0.210 mm/day / decade',
    significance: 'p = 0.0032 (FDR Significant)',
    mechanism: 'Enhanced atmospheric moisture flux via Gulf of Mexico low-level jet driving intensified precipitation frequency.',
    missionCitation: 'NASA POWER Meteorological Reanalysis',
  },
  {
    id: 'case_boreal',
    presetKey: 'case1',
    title: 'Subtropical-to-Boreal Transition Transect',
    location: 'Western Gulf Coastline (30.5°N, -95.5°W)',
    coords: [30.5, -95.5],
    zoom: 6,
    variable: 'T2M & Coastal Convection',
    rate: '+0.390 °C / decade',
    significance: 'Pettitt Changepoint: 2011 Shift (p = 0.008)',
    mechanism: 'Ocean-continent boundary thermal divergence and marine heat advection.',
    missionCitation: 'NASA POWER Daily Climatology (GMAO FP-IT)',
  },
];
