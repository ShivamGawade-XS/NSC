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

  // Actions
  setFormField: (field, value) => set({ [field]: value }),
  setBbox: (bbox) => set({ bbox }),
  setCurtainSplit: (val) => set({ curtainSplit: val }),
  toggleCurtainMode: () => set((s) => ({ showCurtainMode: !s.showCurtainMode })),
  setNlqModalOpen: (open) => set({ nlqModalOpen: open }),
  setLatexModalOpen: (open) => set({ latexModalOpen: open }),

  loadPreset: (presetKey) => {
    const preset = DETECTIVE_PRESETS[presetKey];
    if (!preset) return;

    set({
      dataset: preset.dataset,
      variable: preset.variable,
      startYear: preset.startYear,
      endYear: preset.endYear,
      bbox: {
        minLon: preset.bbox[0],
        minLat: preset.bbox[1],
        maxLon: preset.bbox[2],
        maxLat: preset.bbox[3],
      },
    });

    if (preset.isCompound) {
      get().executeCompoundAnalysis();
    } else {
      get().executeAnalysis();
    }
  },

  executeAnalysis: async () => {
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

      // Auto-select best cell
      if (signals.length > 0) {
        get().selectCell(signals[0].lat, signals[0].lon);
      } else {
        const target = data.grid?.find(c => c.is_significant_fdr) || data.grid?.[0];
        if (target) get().selectCell(target.lat, target.lon);
      }
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },

  executeCompoundAnalysis: async () => {
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
        get().selectCompoundCell(data.cells[0]);
      }
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },

  selectCompoundCell: (cell) => {
    set({
      selectedCell: {
        lat: cell.lat,
        lon: cell.lon,
        variable_name: 'Compound Hazard (T + P)',
        display_units: 'CAI',
        slope_units: '°C / decade',
        slope: cell.temp_slope,
        p_value: cell.temp_significant ? 0.01 : 0.2,
        q_value: cell.temp_significant ? 0.01 : 0.2,
        tau: cell.cai,
        significant: cell.temp_significant || cell.precip_significant,
        direction: cell.hazard_type,
        years: [],
        observations: [],
        fitted_values: [],
        lisa_cluster: cell.hazard_class,
        evidence_record: {
          observation: `Compound Hazard Classification: ${cell.hazard_type.replace(/_/g, ' ').toUpperCase()}`,
          magnitude: `Temp Trend: ${cell.temp_slope > 0 ? '+' : ''}${cell.temp_slope} °C/dec | Precip: ${cell.precip_slope > 0 ? '+' : ''}${cell.precip_slope} mm/day/dec`,
          significance: `Climate Aridification Index (CAI): ${cell.cai}`,
          coverage: 'Joint Bivariate Spatiotemporal Grid',
          method: 'Compound Hazard Classification & Aridification Index',
          source: 'NASA Ingestion',
          scientific_limitation: 'Multivariate divergence metric across observed temporal period.'
        }
      }
    });
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
  openCaseStudyTour: () => set({ isCaseStudyTourOpen: true, isJudgeTourActive: true, tourStepIndex: 0, judgeTourStep: 0 }),
  closeCaseStudyTour: () => set({ isCaseStudyTourOpen: false, isJudgeTourActive: false, tourStepIndex: 0, judgeTourStep: 0 }),
  nextCaseStudyStep: () => set((s) => ({ tourStepIndex: s.tourStepIndex + 1, judgeTourStep: s.judgeTourStep + 1 })),
  // Aliases
  startJudgeTour: () => set({ isCaseStudyTourOpen: true, isJudgeTourActive: true, tourStepIndex: 0, judgeTourStep: 0 }),
  stopJudgeTour: () => set({ isCaseStudyTourOpen: false, isJudgeTourActive: false, tourStepIndex: 0, judgeTourStep: 0 }),
  nextJudgeTourStep: () => set((s) => ({ tourStepIndex: s.tourStepIndex + 1, judgeTourStep: s.judgeTourStep + 1 })),

  toggleAnomalyMode: () => set((s) => ({ isAnomalyMode: !s.isAnomalyMode })),
  toggleLisa: () => set((s) => ({ showLisa: !s.showLisa })),
  toggleGibs: () => set((s) => ({ showGibs: !s.showGibs })),
  toggleMask: () => set((s) => ({ maskSigOnly: !s.maskSigOnly })),
  toggleFdr: () => set((s) => ({ useFdr: !s.useFdr })),

  clearBbox: () => set({
    bbox: { minLon: '', minLat: '', maxLon: '', maxLat: '' },
  }),
}));

export default useStore;
