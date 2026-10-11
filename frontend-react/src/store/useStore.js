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

  // Actions
  setFormField: (field, value) => set({ [field]: value }),
  setBbox: (bbox) => set({ bbox }),

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
    set({ isLoading: true, error: null });

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
    const { analysisId } = get();
    if (!analysisId) return;
    try {
      const cell = await api.getCellTimeseries(analysisId, lat, lon);
      set({ selectedCell: cell });
    } catch (err) {
      console.error('Failed to load cell:', err);
    }
  },

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
