/**
 * Tellura Workstation Mode — Adaptive Label Mapping
 *
 * Centralised label dictionary that adapts every scientific term
 * to the selected persona:
 *   - detective  (Student / Citizen Scientist)
 *   - policy     (City Planner / Risk Analyst)
 *   - pro        (Climate Scientist / NASA Judge)
 */

const MODE_LABELS = {
  // -- Detective (Student / Citizen) ----------------------------
  detective: {
    // Primary metrics
    slopeLabel:     'Trend Speed',
    pValueLabel:    'Confidence',
    tauLabel:       'Trend Strength',
    qValueLabel:    'Filtered Confidence',

    // Status badges
    hotspotLabel:   'Warming Zone',
    nominalLabel:   'Stable',

    // Evidence panel tabs
    telemetryTab:   'Measurements',
    attributionTab: 'Why It Happens',
    auditTab:       'Deep Dive',

    // Evidence panel headings
    evidenceTitle:         'Investigation Report',
    evidenceStandbyTitle:  'Investigation Report',
    evidenceStandbyDesc:   'Click any dot on the map or pick from the Top Climate Clues to see what the data says about that location.',

    // Secondary metrics
    zLabel:         'Signal Strength',
    ciLabel:        'Confidence Range',
    spatialLabel:   'Neighborhood Pattern',
    spatialSub:     'Warming Neighborhoods',
    footprintLabel: 'Area Covered',
    footprintSub:   'Satellite Pixel Size',

    // SNR / Variance / Tail
    snrTitle:       'Is the Signal Real?',
    varianceTitle:  'Natural Wobble vs. Real Trend',
    tailTitle:      'Extreme Years Increasing?',
    vifLabel:       'Natural Noise Adjustment',

    // Chart labels
    trendlineLabel:  'Trend Line',
    baselineLabel:   'Historical Average',
    ciChartLabel:    'Confidence Band',
    anomalyTrendLabel:   'Trend Line (vs Average)',
    anomalyBaseLabel:    'Zero Reference',
    sonifyBtnLabel:      'Listen to the Climate',
    sonifySubLabel:      'Hear the temperature change over time',
    changepointLabel:    'Big Shift',

    // Signals list
    signalsTitle:        'Top Climate Clues',
    signalsRankedBy:     'Strongest trends first',
    compoundTitle:       'Compound Risk Zones',
    compoundRankedBy:    'Highest risk first',
    discoveryTitle:      'Climate Clues',
    discoveryScanBtn:    'Find Climate Mysteries',

    // Analysis panel
    fdrLabel:            'Filter False Alarms',
    bboxLabel:           'Investigation Zone',
    presetsLabel:        'Ready-Made Mysteries',
    dataStreamLabel:     'Data Source',
    variableLabel:       'What to Measure',
    wizardTitle:         'Data Detective Wizard',
    wizardDesc:          'Answer 3 questions to start your investigation.',
    executeBtn:          'Investigate',
    compoundBtn:         'Multi-Variable Investigation',

    // Attribution
    attributionTitle:    'What Caused This?',
    aiExplainBtn:        'Ask AI to Explain This',
    aiExplainLoading:    'Thinking...',

    // Regime shift ribbon
    changepointRibbon:   'Big Shift Detected',

    // Anomaly mode
    anomalyBtn:          'Compare to Average',
    anomalyActive:       'Comparing to Average: On',

    // Export
    figureExportTitle:   'Save Picture',

    // Keyboard hints
    keyGridNav:          'Move with Arrow Keys',
    keyFdrMask:          'Filter: Press F',
    keyLisa:             'Neighborhoods: Press L',

    // Map tooltips & legend
    mapTooltipSlope:     'Trend Speed',
    mapTooltipCi:        'Confidence Range',
    mapTooltipLisa:      'Neighborhood',
    mapTooltipConf:      'Confidence',
    mapLegendTitle:      'Trend Speed',
    mapPillSignificant:  'Verified Zones',
    mapPillSpatial:      'Neighborhood Pattern',
  },

  // -- Policy (City Planner / Risk Analyst) --------------------
  policy: {
    slopeLabel:     'Rate of Change',
    pValueLabel:    'Statistical Confidence',
    tauLabel:       'Trend Correlation',
    qValueLabel:    'Adjusted Confidence',

    hotspotLabel:   'Risk Zone',
    nominalLabel:   'Within Baseline',

    telemetryTab:   'Risk Metrics',
    attributionTab: 'Drivers & Attribution',
    auditTab:       'Audit Trail',

    evidenceTitle:         'Risk Assessment Report',
    evidenceStandbyTitle:  'Risk Assessment Report',
    evidenceStandbyDesc:   'Select any grid cell on the map or use the Priority Risk Signals panel to inspect localized climate risk indicators.',

    zLabel:         'Significance Score',
    ciLabel:        'Confidence Interval',
    spatialLabel:   'Spatial Risk Cluster',
    spatialSub:     'Spatial Autocorrelation',
    footprintLabel: 'Coverage Area',
    footprintSub:   'Resolution Footprint',

    snrTitle:       'Signal-to-Noise Assessment',
    varianceTitle:  'Natural Variability Decoupling',
    tailTitle:      'Extreme Event Acceleration',
    vifLabel:       'Variance Inflation Factor',

    trendlineLabel:  'Trend Projection',
    baselineLabel:   'Historical Baseline',
    ciChartLabel:    'Confidence Envelope',
    anomalyTrendLabel:   'Trend (Anomaly)',
    anomalyBaseLabel:    'Baseline Reference',
    sonifyBtnLabel:      'Sonify Climate Signal',
    sonifySubLabel:      'Acoustic pitch mapping',
    changepointLabel:    'Regime Shift',

    signalsTitle:        'Priority Risk Signals',
    signalsRankedBy:     'Ranked by trend strength',
    compoundTitle:       'Compound Risk Hotspots',
    compoundRankedBy:    'Ranked by CAI Risk',
    discoveryTitle:      'Risk Signals',
    discoveryScanBtn:    'Multi-Variable Risk Scan',

    fdrLabel:            'Multiple Testing Correction',
    bboxLabel:           'Analysis Region',
    presetsLabel:        'Regional Case Studies',
    dataStreamLabel:     'Data Source',
    variableLabel:       'Climate Variable',
    wizardTitle:         'Data Detective Wizard',
    wizardDesc:          'Guided hypothesis builder for evaluators.',
    executeBtn:          'Run Risk Analysis',
    compoundBtn:         'Compound Hazard Analysis',

    attributionTitle:    'Event Attribution (FAR)',
    aiExplainBtn:        'AI-Powered Driver Analysis',
    aiExplainLoading:    'Querying Physical Drivers...',

    changepointRibbon:   'Abrupt Regime Shift',

    anomalyBtn:          'Delta Anomaly Mode',
    anomalyActive:       'Anomaly Mode: Active',

    figureExportTitle:   'Export Figure',

    keyGridNav:          'Grid Navigation: Arrow Keys',
    keyFdrMask:          'FDR Significance Mask: Key [F]',
    keyLisa:             'Spatial Risk Clusters: Key [L]',

    // Map tooltips & legend
    mapTooltipSlope:     'Rate of Change',
    mapTooltipCi:        'Confidence Interval',
    mapTooltipLisa:      'Risk Cluster',
    mapTooltipConf:      'Adjusted Sig.',
    mapLegendTitle:      'Rate of Change',
    mapPillSignificant:  'Elevated Risk Cells',
    mapPillSpatial:      'Spatial Autocorrelation',
  },

  // -- Pro (Climate Scientist / NASA Judge) --------------------
  pro: {
    slopeLabel:     "Sen's Slope",
    pValueLabel:    'p-value',
    tauLabel:       'Kendall τ',
    qValueLabel:    'q-value (BH)',

    hotspotLabel:   'HOTSPOT',
    nominalLabel:   'NOMINAL',

    telemetryTab:   'Telemetry',
    attributionTab: 'Attribution & AI',
    auditTab:       'Audit & Labs',

    evidenceTitle:         'Evidence & Diagnostic Record',
    evidenceStandbyTitle:  'Evidence & Diagnostic Record',
    evidenceStandbyDesc:   'Select any observation cell on the GIS map or pick from the signal rankings to inspect localized empirical evidence, statistical significance, and physical literature drivers.',

    zLabel:         'Standardized Z',
    ciLabel:        'Gilbert 95% CI',
    spatialLabel:   'Spatial Regime',
    spatialSub:     "Anselin Moran's I",
    footprintLabel: 'Ground Footprint',
    footprintSub:   'Cosine-calibrated',

    snrTitle:       'Signal-to-Noise Ratio (SNR)',
    varianceTitle:  'Natural Oscillation Decoupling (ENSO/PDO)',
    tailTitle:      'Tail Acceleration (≥ 1.5σ Anomalies)',
    vifLabel:       'Hamed-Rao Variance Inflation',

    trendlineLabel:  "Sen's Robust Trendline",
    baselineLabel:   'Climatology Baseline (μ)',
    ciChartLabel:    '95% CI (Gilbert 1987)',
    anomalyTrendLabel:   "Sen's Trend (Anomaly Space)",
    anomalyBaseLabel:    'Baseline Zero Reference',
    sonifyBtnLabel:      'Sonify Atmosphere',
    sonifySubLabel:      'Acoustic Pitch Mapping (Section 508)',
    changepointLabel:    'Regime Shift',

    signalsTitle:        'Top Discovery Signals',
    signalsRankedBy:     'Ranked by Kendall τ',
    compoundTitle:       'Compound Hazard Hotspots',
    compoundRankedBy:    'Ranked by CAI Index',
    discoveryTitle:      'Discovery Signals',
    discoveryScanBtn:    'Autonomous Discovery Scan',

    fdrLabel:            'FDR Correction (q ≤ 0.05)',
    bboxLabel:           'Spatial Bounding Box',
    presetsLabel:        'Exemplar Transect Presets',
    dataStreamLabel:     'Data Stream',
    variableLabel:       'Variable',
    wizardTitle:         'Data Detective Wizard',
    wizardDesc:          'Guided hypothesis builder for students & evaluators.',
    executeBtn:          'Execute Trend Detection',
    compoundBtn:         'Compound Hazard Analysis (T & P)',

    attributionTitle:    'Event Attribution (FAR)',
    aiExplainBtn:        'Literature Mechanism & Drivers',
    aiExplainLoading:    'Querying Physical Drivers...',

    changepointRibbon:   'Abrupt Changepoint',

    anomalyBtn:          'Delta Anomaly Mode',
    anomalyActive:       'Anomaly Mode: Active',

    figureExportTitle:   'Figure',

    keyGridNav:          'Grid Navigation: Arrow Keys (↑↓←→)',
    keyFdrMask:          'FDR Significance Mask: Key [F]',
    keyLisa:             'Anselin LISA Regimes: Key [L]',

    // Map tooltips & legend
    mapTooltipSlope:     'Slope',
    mapTooltipCi:        '95% CI',
    mapTooltipLisa:      'LISA',
    mapTooltipConf:      'p-val / FDR q',
    mapLegendTitle:      'Theil-Sen Trend Rate',
    mapPillSignificant:  'FDR Sig (q ≤ 0.05)',
    mapPillSpatial:      'Moran’s I',
  },
};

/**
 * Get the label dictionary for the current workstation mode.
 * Falls back to 'pro' for unknown modes.
 */
export function getLabels(mode) {
  return MODE_LABELS[mode] || MODE_LABELS.pro;
}

/**
 * Returns true if the mode should hide advanced scientific details
 * behind an expandable section.
 */
export function shouldSimplify(mode) {
  return mode === 'detective';
}

/**
 * Returns true if the mode should emphasise risk / compound
 * hazard framing over pure scientific nomenclature.
 */
export function isRiskMode(mode) {
  return mode === 'policy';
}

export default MODE_LABELS;

