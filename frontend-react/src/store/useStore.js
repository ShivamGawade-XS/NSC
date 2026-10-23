/**
 * EarthSift Zustand Store
 * Global state management for analysis, map, and UI state.
 */
import { create } from 'zustand';
import * as api from '../api/client';
import { DETECTIVE_PRESETS } from '../utils/helpers';

const useStore = create((set, get) => ({
  // Analysis state
  analysisId: null,
  analysisData: null,
  selectedCell: null,
  candidateSignals: [],
  isLoading: false,
  error: null,

  // Form state
  dataset: 'nasa_power',
  variable: 'T2M',
  startYear: 2000,
  endYear: 2023,
  bbox: { minLon: '', minLat: '', maxLon: '', maxLat: '' },
  useFdr: true,
  maskSigOnly: false,
  showLisa: false,
  showGibs: false,
  gibsLayerId: 'MODIS_Terra_CorrectedReflectance_TrueColor',
  gibsOpacity: 0.70,
  isAnomalyMode: false,

  // Omni-Scale Championship Features
  velocityData: null,
  isVelocityMode: false,
  showCurtainMode: false,
  curtainSplit: 50, // 0 - 100 percentage
  timeScrubberYear: null,
  isTimelinePlaying: false,

  // Dual-location comparison mode (Pin A vs Pin B)
  compareMode: false,
  comparePinA: null, // { lat, lon }
  comparePinB: null, // { lat, lon }
  comparisonResult: null,

  // Curated Regional Case Studies Tour
  isCaseStudyTourOpen: false,
  tourStepIndex: 0,
  // Backward compatibility alias
  isJudgeTourActive: false,
  judgeTourStep: 0,

  // Modals
  nlqModalOpen: false,
  latexModalOpen: false,
  latexContent: '',
  colabData: null,
  customDataModalOpen: false,
  preprintModalOpen: false,

  // Actions
  setFormField: (field, value) => {
    const updates = { [field]: value };
    if (['dataset', 'variable', 'startYear', 'endYear'].includes(field)) {
      updates.comparePinA = null;
      updates.comparePinB = null;
      updates.comparisonResult = null;
    }
    set(updates);
  },
  setBbox: (bbox) => set({ bbox }),
  setCurtainSplit: (val) => set({ curtainSplit: val }),
  toggleCurtainMode: () => set((s) => ({ showCurtainMode: !s.showCurtainMode })),

  closeAllModals: () => set({
    nlqModalOpen: false,
    latexModalOpen: false,
    customDataModalOpen: false,
    preprintModalOpen: false,
    isCaseStudyTourOpen: false,
    isJudgeTourActive: false,
  }),
  setNlqModalOpen: (open) => set({
    nlqModalOpen: open,
    ...(open ? { latexModalOpen: false, customDataModalOpen: false, preprintModalOpen: false, isCaseStudyTourOpen: false, isJudgeTourActive: false } : {})
  }),
  setLatexModalOpen: (open) => set({
    latexModalOpen: open,
    ...(open ? { nlqModalOpen: false, customDataModalOpen: false, preprintModalOpen: false, isCaseStudyTourOpen: false, isJudgeTourActive: false } : {})
  }),
  setCustomDataModalOpen: (open) => set({
    customDataModalOpen: open,
    ...(open ? { nlqModalOpen: false, latexModalOpen: false, preprintModalOpen: false, isCaseStudyTourOpen: false, isJudgeTourActive: false } : {})
  }),
  setPreprintModalOpen: (open) => set({
    preprintModalOpen: open,
    ...(open ? { nlqModalOpen: false, latexModalOpen: false, customDataModalOpen: false, isCaseStudyTourOpen: false, isJudgeTourActive: false } : {})
  }),
  loadCustomGridData: (customData) => set({
    analysisData: customData,
    analysisId: customData.analysis_id,
    selectedCell: customData.grid?.[0] || null,
    timeScrubberYear: customData.summary?.start_year || 2000,
    startYear: customData.summary?.start_year || 2000,
    endYear: customData.summary?.end_year || 2023,
    customDataModalOpen: false,
    comparePinA: null,
    comparePinB: null,
    comparisonResult: null,
  }),

  loadPreset: (presetKey, options = {}) => {
    const preset = DETECTIVE_PRESETS[presetKey];
    if (!preset) return;

    set({
      dataset: preset.dataset,
      variable: preset.variable,
      startYear: preset.startYear,
      endYear: preset.endYear,
      comparePinA: null,
      comparePinB: null,
      comparisonResult: null,
      bbox: {
        minLon: preset.bbox[0],
        minLat: preset.bbox[1],
        maxLon: preset.bbox[2],
        maxLat: preset.bbox[3],
      },
    });

    if (preset.isCompound) {
      get().executeCompoundAnalysis(options);
    } else {
      get().executeAnalysis(options);
    }
  },

  getShareableUrl: () => {
    const { dataset, variable, startYear, endYear, useFdr, bbox, analysisData, selectedCell } = get();
    const isCompound = Boolean(analysisData?.isCompound);
    const params = new URLSearchParams();

    if (dataset) params.set('dataset', dataset);
    if (variable) params.set('var', variable);
    if (startYear) params.set('start', String(startYear));
    if (endYear) params.set('end', String(endYear));
    if (useFdr !== undefined) params.set('fdr', String(Boolean(useFdr)));
    if (isCompound) params.set('compound', 'true');

    if (
      bbox &&
      bbox.minLon !== '' &&
      bbox.minLat !== '' &&
      bbox.maxLon !== '' &&
      bbox.maxLat !== '' &&
      bbox.minLon !== undefined &&
      bbox.minLat !== undefined &&
      bbox.maxLon !== undefined &&
      bbox.maxLat !== undefined
    ) {
      params.set('bbox', `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`);
    }

    if (selectedCell && selectedCell.lat !== undefined && selectedCell.lon !== undefined) {
      const latVal = Number(selectedCell.lat).toFixed(4).replace(/\.?0+$/, '');
      const lonVal = Number(selectedCell.lon).toFixed(4).replace(/\.?0+$/, '');
      params.set('lat', latVal);
      params.set('lon', lonVal);
    }

    const base = typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '/dashboard';

    return `${base}?${params.toString()}`;
  },

  syncUrl: () => {
    if (typeof window === 'undefined') return;
    try {
      if (window.location.pathname.includes('/dashboard') || window.location.pathname === '/') {
        const shareUrl = get().getShareableUrl();
        window.history.replaceState(null, '', shareUrl);
      }
    } catch (err) {
      console.warn('Failed to update window.history:', err);
    }
  },

  executeAnalysis: async (options = {}) => {
    const { dataset, variable, startYear, endYear, bbox, useFdr } = get();
    set({ isLoading: true, error: null, timeScrubberYear: startYear });

    const payload = {
      dataset_id: dataset,
      variable_id: variable,
      start_year: startYear,
      end_year: endYear,
      alpha: 0.05,
      use_fdr: useFdr,
    };

    if (bbox.minLon !== '' && bbox.minLat !== '' && bbox.maxLon !== '' && bbox.maxLat !== '') {
      payload.bbox = [
        parseFloat(bbox.minLon), parseFloat(bbox.minLat),
        parseFloat(bbox.maxLon), parseFloat(bbox.maxLat),
      ];
    }

    try {
      const data = await api.runAnalysis(payload);
      // Load signals
      let signals = [];
      try {
        const sigData = await api.getSignals(data.analysis_id);
        signals = sigData.signals || [];
      } catch { /* signals optional */ }

      // Fetch climate velocity in background
      try {
        const vel = await api.getClimateVelocity(data.analysis_id);
        set({ velocityData: vel });
      } catch { /* optional */ }

      set({
        analysisData: data,
        analysisId: data.analysis_id,
        candidateSignals: signals,
        isLoading: false,
      });

      // Target selection: prefer caller-specified target, otherwise auto-select best cell
      let targetLat = options?.targetLat;
      let targetLon = options?.targetLon;

      if (targetLat !== undefined && targetLon !== undefined && data.grid?.length > 0) {
        let closest = data.grid[0];
        let minDist = Infinity;
        for (const c of data.grid) {
          const dist = (c.lat - targetLat) ** 2 + (c.lon - targetLon) ** 2;
          if (dist < minDist) {
            minDist = dist;
            closest = c;
          }
        }
        targetLat = closest.lat;
        targetLon = closest.lon;
      } else if (targetLat === undefined || targetLon === undefined) {
        targetLat = signals[0]?.lat ?? data.grid?.find(c => c.is_significant_fdr)?.lat ?? data.grid?.[0]?.lat;
        targetLon = signals[0]?.lon ?? data.grid?.find(c => c.is_significant_fdr)?.lon ?? data.grid?.[0]?.lon;
      }

      if (targetLat !== undefined && targetLon !== undefined) {
        await get().selectCell(targetLat, targetLon);
      }
      get().syncUrl();
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },

  executeCompoundAnalysis: async (options = {}) => {
    const { dataset, startYear, endYear, bbox } = get();
    set({ isLoading: true, error: null });

    const payload = {
      dataset_id: dataset,
      temp_variable_id: 'T2M',
      precip_variable_id: dataset === 'nasa_power' ? 'PRECTOTCORR' : 'PRECTOT',
      start_year: startYear,
      end_year: endYear,
      alpha: 0.05,
    };

    if (bbox.minLon !== '' && bbox.minLat !== '') {
      payload.bbox = [
        parseFloat(bbox.minLon), parseFloat(bbox.minLat),
        parseFloat(bbox.maxLon), parseFloat(bbox.maxLat),
      ];
    }

    try {
      const data = await api.runCompoundAnalysis(payload);
      set({
        analysisData: { ...data, isCompound: true },
        analysisId: data.analysis_id,
        candidateSignals: [],
        isLoading: false,
      });

      if (data.cells && data.cells.length > 0) {
        let targetCell = data.cells[0];
        if (options?.targetLat !== undefined && options?.targetLon !== undefined) {
          let closest = data.cells[0];
          let minDist = Infinity;
          for (const c of data.cells) {
            const dist = (c.lat - options.targetLat) ** 2 + (c.lon - options.targetLon) ** 2;
            if (dist < minDist) {
              minDist = dist;
              closest = c;
            }
          }
          targetCell = closest;
        }
        get().selectCompoundCell(targetCell);
      }
      get().syncUrl();
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },

  selectCompoundCell: (cell) => {
    set({
      selectedCell: {
        lat: cell.lat,
        lon: cell.lon,
        isCompound: true,
        variable_name: 'Compound Hazard (T + P)',
        display_units: '°C & mm/day',
        slope_units: '°C / decade',
        slope: cell.temp_slope,
        temp_slope: cell.temp_slope,
        precip_slope: cell.precip_slope,
        p_value: cell.temp_p_value,
        q_value: cell.temp_q_value,
        precip_p_value: cell.precip_p_value,
        precip_q_value: cell.precip_q_value,
        tau: cell.cai,
        significant: cell.temp_significant || cell.precip_significant,
        direction: cell.hazard_type,
        years: cell.years || [],
        observations: cell.temp_observations || [],
        fitted_values: cell.temp_fitted_values || [],
        precip_observations: cell.precip_observations || [],
        precip_fitted_values: cell.precip_fitted_values || [],
        lisa_cluster: cell.hazard_class,
        evidence_record: {
          observation: `Compound Hazard Classification: ${(cell.hazard_type || '').replace(/_/g, ' ').toUpperCase()}`,
          magnitude: `Temp Trend: ${cell.temp_slope > 0 ? '+' : ''}${cell.temp_slope} °C/dec | Precip: ${cell.precip_slope > 0 ? '+' : ''}${cell.precip_slope} mm/day/dec`,
          significance: `Climate Aridification Index (CAI): ${cell.cai} | Temp p: ${cell.temp_p_value}, Precip p: ${cell.precip_p_value}`,
          coverage: 'Joint Bivariate Spatiotemporal Grid',
          method: 'Compound Hazard Classification & Aridification Index',
          source: 'NASA Ingestion',
          scientific_limitation: 'Multivariate divergence metric across observed temporal period.'
        }
      }
    });
    get().syncUrl();
  },

  selectCell: async (lat, lon) => {
    const { analysisId, compareMode, comparePinA, comparePinB } = get();
    if (!analysisId) return;

    if (compareMode) {
      if (!comparePinA) {
        set({ comparePinA: { lat, lon } });
        return;
      }
      if (!comparePinB) {
        set({ comparePinB: { lat, lon } });
        get().runComparison({ lat: comparePinA.lat, lon: comparePinA.lon }, { lat, lon });
        return;
      }
      // If both set, reset Pin A
      set({ comparePinA: { lat, lon }, comparePinB: null, comparisonResult: null });
      return;
    }

    try {
      const cell = await api.getCellTimeseries(analysisId, lat, lon);
      set({ selectedCell: cell });
      get().syncUrl();
    } catch (err) {
      console.error('Failed to load cell:', err);
    }
  },

  toggleVelocityMode: async () => {
    const { isVelocityMode, analysisId, velocityData } = get();
    if (!isVelocityMode && !velocityData && analysisId) {
      try {
        const vel = await api.getClimateVelocity(analysisId);
        set({ velocityData: vel, isVelocityMode: true });
        return;
      } catch (err) {
        console.error('Failed to load velocity vectors:', err);
      }
    }
    set((s) => ({ isVelocityMode: !s.isVelocityMode }));
  },

  toggleCompareMode: () => {
    set((s) => ({
      compareMode: !s.compareMode,
      comparePinA: null,
      comparePinB: null,
      comparisonResult: null,
    }));
  },

  runComparison: async (pinA, pinB) => {
    const { analysisId } = get();
    if (!analysisId) return;
    try {
      const res = await api.compareLocations({
        analysis_id: analysisId,
        lat_a: pinA.lat,
        lon_a: pinA.lon,
        lat_b: pinB.lat,
        lon_b: pinB.lon,
      });
      set({ comparisonResult: res });
    } catch (err) {
      console.error('Comparison error:', err);
    }
  },

  // 4D Timeline Scrubbing
  setTimeScrubberYear: (year) => set({ timeScrubberYear: year }),
  toggleTimelinePlay: () => set((s) => ({ isTimelinePlaying: !s.isTimelinePlaying })),

  // Curated Regional Case Studies Tour
  openCaseStudyTour: () => set({
    isCaseStudyTourOpen: true,
    isJudgeTourActive: true,
    tourStepIndex: 0,
    judgeTourStep: 0,
    nlqModalOpen: false,
    latexModalOpen: false,
    customDataModalOpen: false,
    preprintModalOpen: false,
  }),
  closeCaseStudyTour: () => set({ isCaseStudyTourOpen: false, isJudgeTourActive: false, tourStepIndex: 0, judgeTourStep: 0 }),
  nextCaseStudyStep: () => set((s) => ({ tourStepIndex: s.tourStepIndex + 1, judgeTourStep: s.judgeTourStep + 1 })),
  // Aliases
  startJudgeTour: () => set({
    isCaseStudyTourOpen: true,
    isJudgeTourActive: true,
    tourStepIndex: 0,
    judgeTourStep: 0,
    nlqModalOpen: false,
    latexModalOpen: false,
    customDataModalOpen: false,
    preprintModalOpen: false,
  }),
  stopJudgeTour: () => set({ isCaseStudyTourOpen: false, isJudgeTourActive: false, tourStepIndex: 0, judgeTourStep: 0 }),
  nextJudgeTourStep: () => set((s) => ({ tourStepIndex: s.tourStepIndex + 1, judgeTourStep: s.judgeTourStep + 1 })),

  toggleAnomalyMode: () => set((s) => ({ isAnomalyMode: !s.isAnomalyMode })),
  toggleLisa: () => set((s) => ({ showLisa: !s.showLisa })),
  toggleGibs: () => set((s) => ({ showGibs: !s.showGibs })),
  setGibsLayerId: (gibsLayerId) => set({ gibsLayerId }),
  setGibsOpacity: (gibsOpacity) => set({ gibsOpacity }),
  toggleMask: () => set((s) => ({ maskSigOnly: !s.maskSigOnly })),
  toggleFdr: () => set((s) => ({ useFdr: !s.useFdr })),

  clearBbox: () => set({
    bbox: { minLon: '', minLat: '', maxLon: '', maxLat: '' },
  }),
}));

if (typeof window !== 'undefined') {
  window.__earthsift_store__ = useStore;
}

export default useStore;
