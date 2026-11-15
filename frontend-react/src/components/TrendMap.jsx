import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useStore from '../store/useStore';
import { getTrendColor, getLISAColor, getHazardColor, formatCoords, escapeHtml } from '../utils/helpers';
import { getLabels } from '../utils/modeLabels';
import JudgeTourOverlay from './JudgeTourOverlay';
import PlanetaryGlobe3D from './PlanetaryGlobe3D';
import { playTactileClick } from '../utils/audio';

const NASA_GIBS_PRESETS = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    name: 'MODIS Terra True-Color',
    sub: 'NASA Terra 250m Surface Radiance',
    badge: 'TrueColor'
  },
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    name: 'VIIRS Suomi NPP True-Color',
    sub: 'Ultra-High Res Multi-Spectral Pass',
    badge: 'VIIRS HD'
  },
  {
    id: 'MODIS_Terra_SurfaceReflectance_Bands721',
    name: 'MODIS SWIR Bands 7-2-1',
    sub: 'Infrared Arid Soil & Burn Scars',
    badge: 'SWIR 721'
  },
  {
    id: 'VIIRS_SNPP_DayNightBand_ENCC',
    name: 'VIIRS Day/Night Band',
    sub: 'Thermal & Nocturnal Radiative Flux',
    badge: 'Nocturnal'
  }
];

export default function TrendMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const gridLayerRef = useRef(null);
  const velocityLayerRef = useRef(null);
  const compareLayerRef = useRef(null);
  const domainBoundsRef = useRef(null);
  const gibsLayerRef = useRef(null);
  const selectionLayerRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [isRasterMode, setIsRasterMode] = useState(true);

  const analysisData = useStore((s) => s.analysisData);
  const selectedCell = useStore((s) => s.selectedCell);
  const maskSigOnly = useStore((s) => s.maskSigOnly);
  const showLisa = useStore((s) => s.showLisa);
  const showGibs = useStore((s) => s.showGibs);
  const gibsLayerId = useStore((s) => s.gibsLayerId);
  const gibsOpacity = useStore((s) => s.gibsOpacity);
  const isVelocityMode = useStore((s) => s.isVelocityMode);
  const velocityData = useStore((s) => s.velocityData);
  const showCurtainMode = useStore((s) => s.showCurtainMode);
  const curtainSplit = useStore((s) => s.curtainSplit);
  const setCurtainSplit = useStore((s) => s.setCurtainSplit);
  const compareMode = useStore((s) => s.compareMode);
  const comparePinA = useStore((s) => s.comparePinA);
  const comparePinB = useStore((s) => s.comparePinB);
  const timeScrubberYear = useStore((s) => s.timeScrubberYear);
  const isTimelinePlaying = useStore((s) => s.isTimelinePlaying);
  const startYear = useStore((s) => s.startYear);
  const endYear = useStore((s) => s.endYear);
  const selectCell = useStore((s) => s.selectCell);
  const toggleCompareMode = useStore((s) => s.toggleCompareMode);
  const workstationMode = useStore((s) => s.workstationMode);
  const L_map = getLabels(workstationMode);
  const [showGlobe3D, setShowGlobe3D] = useState(false);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [gisToolsOpen, setGisToolsOpen] = useState(false);

function inferGridStep(grid) {
  if (!grid || grid.length < 2) return { dLat: 0.5, dLon: 0.5 };

  const lats = Array.from(new Set(grid.map((c) => c.lat))).sort((a, b) => a - b);
  const lons = Array.from(new Set(grid.map((c) => c.lon))).sort((a, b) => a - b);

  let dLat = 0.5;
  let dLon = 0.5;

  if (lats.length >= 2) {
    let minDiffLat = Infinity;
    for (let i = 1; i < lats.length; i++) {
      const diff = Math.abs(lats[i] - lats[i - 1]);
      if (diff > 0.05 && diff < minDiffLat) minDiffLat = diff;
    }
    if (minDiffLat !== Infinity) {
      dLat = minDiffLat;
    }
  }

  if (lons.length >= 2) {
    let minDiffLon = Infinity;
    for (let i = 1; i < lons.length; i++) {
      const diff = Math.abs(lons[i] - lons[i - 1]);
      if (diff > 0.05 && diff < minDiffLon) minDiffLon = diff;
    }
    if (minDiffLon !== Infinity) {
      dLon = minDiffLon;
    }
  }

  // Snap to standard climate grid steps (0.5° or 1.0°) if close
  if (Math.abs(dLat - 0.5) < 0.15) dLat = 0.5;
  else if (Math.abs(dLat - 1.0) < 0.15) dLat = 1.0;

  if (Math.abs(dLon - 0.5) < 0.15) dLon = 0.5;
  else if (Math.abs(dLon - 1.0) < 0.15) dLon = 1.0;

  return { dLat, dLon };
}

  // 1. Render Spatial Trend Grid (Continuous Raster Cells or Point Matrix)
  const renderSpatialGrid = useCallback((grid) => {
    if (!analysisData?.summary) return;
    const canvasRenderer = L.canvas({ padding: 0.5 });
    const useFdr = useStore.getState().useFdr;
    const { min_slope: minSlope, max_slope: maxSlope } = analysisData.summary;

    const { dLat, dLon } = inferGridStep(grid);

    const activeYear = timeScrubberYear || endYear || 2023;
    const progress = (endYear && startYear && endYear > startYear)
      ? Math.max(0.15, Math.min(1.0, (activeYear - startYear) / (endYear - startYear)))
      : 1.0;

    grid.forEach((cell) => {
      const isSig = useFdr ? cell.is_significant_fdr : cell.is_significant_raw;
      if (maskSigOnly && !isSig) return;

      const color = showLisa ? getLISAColor(cell.lisa_cluster) : getTrendColor(cell.slope, minSlope, maxSlope);
      const baseOpacity = isSig ? 0.90 : 0.35;
      const dynamicFillOpacity = Math.max(0.12, baseOpacity * (0.25 + 0.75 * progress));

      const marker = isRasterMode
        ? L.rectangle(
            [
              [cell.lat - dLat / 2, cell.lon - dLon / 2],
              [cell.lat + dLat / 2, cell.lon + dLon / 2],
            ],
            {
              renderer: canvasRenderer,
              fillColor: color,
              fillOpacity: dynamicFillOpacity,
              color: isSig ? (showLisa ? '#ffffff' : '#38bdf8') : 'transparent',
              weight: isSig ? 1 : 0,
            }
          )
        : L.circleMarker([cell.lat, cell.lon], {
            renderer: canvasRenderer,
            radius: isSig ? (6 + 3 * progress) : (3.5 + 2 * progress),
            fillColor: color,
            fillOpacity: dynamicFillOpacity,
            color: isSig ? (showLisa ? '#ffffff' : '#38bdf8') : '#334155',
            weight: isSig ? 2 : 0.8,
          });

      const accumulatedShift = cell.slope !== undefined && startYear
        ? (cell.slope * (activeYear - startYear) / 10).toFixed(4)
        : '0.0000';

      const ciText = cell.ci_lower !== undefined && cell.ci_upper !== undefined
        ? `[${cell.ci_lower > 0 ? '+' : ''}${cell.ci_lower.toFixed(3)}, ${cell.ci_upper > 0 ? '+' : ''}${cell.ci_upper.toFixed(3)}]`
        : 'N/A';

      const confText = workstationMode === 'detective'
        ? (cell.q_value !== undefined && cell.q_value <= 0.05 ? 'High Confidence (Verified)' : 'Normal Variation')
        : workstationMode === 'policy'
          ? (cell.q_value !== undefined && cell.q_value <= 0.05 ? `Significant (q=${cell.q_value.toFixed(3)})` : `Baseline (q=${cell.q_value !== undefined ? cell.q_value.toFixed(3) : 'N/A'})`)
          : `<strong>p-val:</strong> ${escapeHtml(cell.p_value !== undefined ? cell.p_value.toFixed(4) : 'N/A')} | <strong>FDR q:</strong> ${escapeHtml(cell.q_value !== undefined ? cell.q_value.toFixed(4) : 'N/A')}`;

      const lisaText = workstationMode === 'detective'
        ? (cell.lisa_cluster === 'High-High' ? 'Warming Neighborhood (Hotspot)' : cell.lisa_cluster === 'Low-Low' ? 'Cooling Neighborhood (Refugia)' : cell.lisa_cluster || 'Normal')
        : (cell.lisa_cluster || 'NS');

      marker.bindTooltip(`
        <div style="font-family: var(--font-sans, system-ui, sans-serif); font-size: 11px;">
          <strong>Coords:</strong> ${escapeHtml(formatCoords(cell.lat, cell.lon))}<br/>
          <strong>${escapeHtml(L_map.mapTooltipSlope)}:</strong> ${escapeHtml((cell.slope > 0 ? '+' : '') + cell.slope.toFixed(4))}<br/>
          <strong>${escapeHtml(L_map.mapTooltipCi)}:</strong> ${escapeHtml(ciText)}<br/>
          <strong>${escapeHtml(L_map.mapTooltipLisa)}:</strong> ${escapeHtml(lisaText)}<br/>
          <strong>${escapeHtml(L_map.mapTooltipConf)}:</strong> ${confText}<br/>
          <span style="color: #38bdf8; display: inline-block; margin-top: 3px; padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.15);">
            <strong>4D Epoch (${escapeHtml(activeYear)}):</strong> Net Shift: ${escapeHtml((accumulatedShift > 0 ? '+' : '') + accumulatedShift)} ${escapeHtml(cell.slope_units || '')}
          </span>
        </div>
      `);

      marker.on('click', () => {
        playTactileClick(650);
        selectCell(cell.lat, cell.lon);
      });
      gridLayerRef.current?.addLayer(marker);
    });
  }, [analysisData, maskSigOnly, showLisa, selectCell, isRasterMode, timeScrubberYear, startYear, endYear, workstationMode, L_map]);

  // 2. Render Compound Grid
  const renderCompoundGrid = useCallback((cells) => {
    const canvasRenderer = L.canvas({ padding: 0.5 });
    const { dLat, dLon } = inferGridStep(cells);

    cells.forEach((cell) => {
      const color = getHazardColor(cell.hazard_type);
      const isHazard = cell.hazard_type !== 'neutral';

      const marker = isRasterMode
        ? L.rectangle(
            [
              [cell.lat - dLat / 2, cell.lon - dLon / 2],
              [cell.lat + dLat / 2, cell.lon + dLon / 2],
            ],
            {
              renderer: canvasRenderer,
              fillColor: color,
              fillOpacity: isHazard ? 0.90 : 0.35,
              color: isHazard ? '#ffffff' : 'transparent',
              weight: isHazard ? 1.2 : 0,
            }
          )
        : L.circleMarker([cell.lat, cell.lon], {
            renderer: canvasRenderer,
            radius: isHazard ? 8 : 5,
            fillColor: color,
            fillOpacity: isHazard ? 0.92 : 0.45,
            color: isHazard ? '#ffffff' : '#334155',
            weight: isHazard ? 1.5 : 0.8,
          });

      marker.bindTooltip(`
        <div style="font-family: var(--font-sans, system-ui, sans-serif); font-size: 11px;">
          <strong>Coords:</strong> ${escapeHtml(formatCoords(cell.lat, cell.lon))}<br/>
          <strong>Hazard:</strong> <span style="color:${color};font-weight:700;">${escapeHtml(String(cell.hazard_type || '').replace(/_/g, ' ').toUpperCase())}</span><br/>
          <strong>CAI:</strong> ${escapeHtml(cell.cai !== undefined ? cell.cai.toFixed(3) : 'N/A')}<br/>
          <strong>Temp Slope:</strong> ${escapeHtml(cell.temp_slope !== undefined ? (cell.temp_slope > 0 ? '+' : '') + cell.temp_slope.toFixed(3) + ' °C/dec' : 'N/A')}
        </div>
      `);
      marker.on('click', () => {
        playTactileClick(650);
        useStore.getState().selectCompoundCell(cell);
      });
      gridLayerRef.current?.addLayer(marker);
    });
  }, [isRasterMode]);

  // 3. Render Climate Velocity Vectors (Burrows et al. Nature 2011)
  const renderVelocityVectors = useCallback(() => {
    if (!velocityLayerRef.current) return;
    velocityLayerRef.current.clearLayers();
    if (!isVelocityMode || !velocityData?.vectors) return;

    velocityData.vectors.forEach((vec) => {
      const start = [vec.lat, vec.lon];
      // Scale length by velocity
      const scale = 0.45;
      const end = [
        vec.lat + vec.v * scale,
        vec.lon + vec.u * scale
      ];

      // Draw vector streamline arrow line
      const line = L.polyline([start, end], {
        color: '#00f0ff',
        weight: 2,
        opacity: 0.9,
      });

      // Arrowhead dot at head
      const head = L.circleMarker(end, {
        radius: 3.5,
        color: '#00f0ff',
        fillColor: '#ffffff',
        fillOpacity: 1,
        weight: 1
      });

      const tooltipContent = `
        <div style="font-family: monospace; font-size: 11px;">
          <strong>Velocity:</strong> ${escapeHtml(vec.velocity_km_decade)} km/decade<br/>
          <strong>Bearing:</strong> ${escapeHtml(vec.bearing_deg)}° (${escapeHtml(vec.cardinal)})<br/>
          <strong>Gradient:</strong> ${escapeHtml(vec.spatial_gradient)} / km
        </div>
      `;
      line.bindTooltip(tooltipContent);
      head.bindTooltip(tooltipContent);

      velocityLayerRef.current.addLayer(line);
      velocityLayerRef.current.addLayer(head);
    });
  }, [isVelocityMode, velocityData]);

  // 4. Render Dual Compare Pins (Pin A and Pin B)
  const renderComparePins = useCallback(() => {
    if (!compareLayerRef.current) return;
    compareLayerRef.current.clearLayers();
    if (!compareMode) return;

    if (comparePinA) {
      const pinA = L.circleMarker([comparePinA.lat, comparePinA.lon], {
        radius: 12,
        fillColor: '#00f0ff',
        fillOpacity: 0.85,
        color: '#ffffff',
        weight: 2.5,
      }).bindTooltip(`<strong>Location A:</strong> ${escapeHtml(formatCoords(comparePinA.lat, comparePinA.lon))}`);
      compareLayerRef.current.addLayer(pinA);
    }

    if (comparePinB) {
      const pinB = L.circleMarker([comparePinB.lat, comparePinB.lon], {
        radius: 12,
        fillColor: '#ff9f1c',
        fillOpacity: 0.85,
        color: '#ffffff',
        weight: 2.5,
      }).bindTooltip(`<strong>Location B:</strong> ${escapeHtml(formatCoords(comparePinB.lat, comparePinB.lon))}`);
      compareLayerRef.current.addLayer(pinB);
    }
  }, [compareMode, comparePinA, comparePinB]);

  // Initialize Leaflet Map
  useEffect(() => {
    const container = mapRef.current;
    if (mapInstanceRef.current || !container) return;

    const map = L.map(container, {
      center: [34.0, -98.0],
      zoom: 5,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: true,
      preferCanvas: true,
    });

    const isDark = document.documentElement.classList.contains('dark');
    const getTileUrl = (dark) =>
      dark
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

    const baseTileLayer = L.tileLayer(getTileUrl(isDark), {
      attribution: '&copy; Esri, NASA Space Apps 2026',
      maxZoom: 16,
    }).addTo(map);

    // Dynamic theme observer for basemap tiles
    const observer = new MutationObserver(() => {
      const darkNow = document.documentElement.classList.contains('dark');
      baseTileLayer.setUrl(getTileUrl(darkNow));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    gridLayerRef.current = L.layerGroup().addTo(map);
    velocityLayerRef.current = L.layerGroup().addTo(map);
    compareLayerRef.current = L.layerGroup().addTo(map);
    selectionLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setMapInstance(map);
    setMapReady(true);

    const initTimer = setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 150);

    // Attach ResizeObserver to auto-invalidate map dimensions on container resize / devtools open
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      resizeObserver.observe(container);
    }

    return () => {
      clearTimeout(initTimer);
      if (resizeObserver) resizeObserver.disconnect();
      observer.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      setMapInstance(null);
      setMapReady(false);
      if (container) delete container._leaflet_id;
    };
  }, []);

  // When switching back from 3D Globe to 2D Leaflet map, invalidate container dimensions
  useEffect(() => {
    if (!showGlobe3D && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize({ animate: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showGlobe3D]);

  // Update Grid
  useEffect(() => {
    if (!gridLayerRef.current || !analysisData) return;
    gridLayerRef.current.clearLayers();

    const map = mapInstanceRef.current;
    if (!map) return;
    const isCompound = analysisData.isCompound;

    if (isCompound && analysisData.cells) {
      renderCompoundGrid(analysisData.cells);
    } else if (analysisData.grid) {
      renderSpatialGrid(analysisData.grid);
    }

    // Fit bounds
    const bbox = analysisData.summary?.bounding_box || analysisData.bbox;
    if (bbox && bbox.length === 4) {
      if (domainBoundsRef.current && map.hasLayer(domainBoundsRef.current)) {
        map.removeLayer(domainBoundsRef.current);
      }
      domainBoundsRef.current = L.rectangle(
        [[bbox[1], bbox[0]], [bbox[3], bbox[2]]],
        { color: '#00f0ff', weight: 1.5, dashArray: '4, 4', fill: false, interactive: false }
      ).addTo(map);
      map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [40, 40] });
    }
  }, [analysisData, maskSigOnly, showLisa, timeScrubberYear, renderSpatialGrid, renderCompoundGrid]);

  // Selected Cell Reticle Highlight
  useEffect(() => {
    if (!selectionLayerRef.current) return;
    selectionLayerRef.current.clearLayers();
    if (!selectedCell || selectedCell.lat === undefined || selectedCell.lon === undefined) return;

    const lat = selectedCell.lat;
    const lon = selectedCell.lon;

    // Outer dashed target ring
    const outerRing = L.circleMarker([lat, lon], {
      radius: 13,
      color: '#00f0ff',
      weight: 2,
      dashArray: '3, 3',
      fill: false,
      interactive: false,
    });

    // Inner bright center reticle dot
    const innerDot = L.circleMarker([lat, lon], {
      radius: 3.5,
      fillColor: '#ffffff',
      fillOpacity: 1,
      color: '#00f0ff',
      weight: 1.5,
      interactive: false,
    });

    selectionLayerRef.current.addLayer(outerRing);
    selectionLayerRef.current.addLayer(innerDot);
  }, [selectedCell]);

  // Velocity update
  useEffect(() => {
    renderVelocityVectors();
  }, [renderVelocityVectors]);

  // Compare pins update
  useEffect(() => {
    renderComparePins();
  }, [renderComparePins]);

  // GIBS Satellite Layer toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (gibsLayerRef.current && map.hasLayer(gibsLayerRef.current)) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (showGibs || showCurtainMode) {
      const rawYear = timeScrubberYear || endYear || 2023;
      const effectiveYear = rawYear < 2000 ? 2000 : rawYear;
      const gibsDate = `${effectiveYear}-07-15`;
      const currentLayerId = gibsLayerId || 'MODIS_Terra_CorrectedReflectance_TrueColor';
      const currentOpacity = showCurtainMode ? 0.95 : (gibsOpacity ?? 0.70);

      gibsLayerRef.current = L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${currentLayerId}/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        {
          attribution: `NASA EOSDIS GIBS (${currentLayerId.split('_')[0]}, ${gibsDate})`,
          maxZoom: 9,
          opacity: currentOpacity,
          errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        }
      ).addTo(map);

      gridLayerRef.current?.bringToFront?.();
      velocityLayerRef.current?.bringToFront?.();
      compareLayerRef.current?.bringToFront?.();
      selectionLayerRef.current?.bringToFront?.();
    }
  }, [showGibs, showCurtainMode, gibsLayerId, gibsOpacity, timeScrubberYear, endYear]);

  // Curtain Split Pane Clipping
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const overlayPane = map.getPane('overlayPane');
    if (!overlayPane) return;

    if (showCurtainMode) {
      overlayPane.style.clipPath = `polygon(${curtainSplit}% 0, 100% 0, 100% 100%, ${curtainSplit}% 100%)`;
      overlayPane.style.webkitClipPath = `polygon(${curtainSplit}% 0, 100% 0, 100% 100%, ${curtainSplit}% 100%)`;
    } else {
      overlayPane.style.clipPath = '';
      overlayPane.style.webkitClipPath = '';
    }

    return () => {
      overlayPane.style.clipPath = '';
      overlayPane.style.webkitClipPath = '';
    };
  }, [showCurtainMode, curtainSplit]);

  // 4D Timeline playback timer
  useEffect(() => {
    if (!isTimelinePlaying) return;
    const interval = setInterval(() => {
      const current = useStore.getState().timeScrubberYear || startYear;
      if (current >= endYear) {
        useStore.getState().setTimeScrubberYear(startYear);
      } else {
        useStore.getState().setTimeScrubberYear(current + 1);
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [isTimelinePlaying, startYear, endYear]);

  const handleCurtainPointerDown = (e) => {
    e.preventDefault();
    const container = mapRef.current;
    if (!container) return;
    try {
      e.target.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignored if target does not support pointer capture
    }

    const onMove = (moveEv) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.max(5, Math.min(95, ((moveEv.clientX - rect.left) / rect.width) * 100));
      setCurtainSplit(Math.round(pct));
    };

    const onUp = (upEv) => {
      try {
        e.target.releasePointerCapture?.(upEv.pointerId);
      } catch {
        // Ignored if pointer capture was already released
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="relative isolate w-full h-full rounded overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)]">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '100%', height: '100%' }} />

      {/* 3D Planetary Orthographic Globe View */}
      {showGlobe3D && (
        <div className="absolute inset-0 z-[1050]">
          <PlanetaryGlobe3D
            grid={analysisData?.grid || []}
            bbox={analysisData?.bbox}
            selectedCell={selectedCell}
            onSelectCell={(lat, lon) => selectCell(lat, lon)}
            onClose={() => setShowGlobe3D(false)}
          />
        </div>
      )}

      {/* Exemplar Transect Tour Overlay */}
      {mapReady && mapInstance && <JudgeTourOverlay mapInstance={mapInstance} />}

      {/* Curtain Comparison Slider Overlay */}
      {showCurtainMode && (
        <div
          className="absolute inset-0 pointer-events-none z-[800]"
          style={{
            clipPath: `polygon(${curtainSplit}% 0, 100% 0, 100% 100%, ${curtainSplit}% 100%)`,
            backdropFilter: 'contrast(1.15) brightness(1.1)'
          }}
        >
          <div className="absolute top-12 left-14 bg-[var(--color-bg-deep)]/90 text-[var(--color-accent-blue)] font-mono text-[9px] px-2 py-0.5 rounded border border-[var(--color-accent-blue)]/30 tracking-wider shadow-sm">
            RIGHT: COMPUTED TREND RASTER
          </div>
        </div>
      )}

      {showCurtainMode && (
        <div className="absolute top-3 left-14 z-[900] bg-[var(--color-bg-deep)]/90 text-[#f59e0b] font-mono text-[9px] px-2 py-0.5 rounded border border-[#f59e0b]/30 tracking-wider shadow-sm">
          LEFT: NASA GIBS SATELLITE TILES
        </div>
      )}

      {/* Curtain Slider Handle */}
      {showCurtainMode && (
        <div
          onPointerDown={handleCurtainPointerDown}
          className="absolute top-0 bottom-0 z-[1000] w-1 bg-[var(--color-accent-blue)] cursor-ew-resize flex items-center justify-center border-x border-white/30 shadow-md touch-none select-none"
          style={{ left: `${curtainSplit}%`, touchAction: 'none' }}
          role="slider"
          aria-label="Satellite Imagery Curtain Splitter"
          aria-valuenow={curtainSplit}
          aria-valuemin={5}
          aria-valuemax={95}
        >
          <div className="w-6 h-6 rounded bg-[var(--color-accent-blue)] text-white flex items-center justify-center text-[10px] font-bold shadow pointer-events-auto select-none">
            ↔
          </div>
        </div>
      )}

      {/* Spatiotemporal 4D Timeline Scrubber Docked at Bottom-Left */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 max-w-[calc(100%-1.5rem)] overflow-x-auto bg-[var(--color-bg-surface)]/95 border border-[var(--color-border-strong)] px-2.5 py-1.5 rounded shadow-2xl backdrop-blur-md text-xs font-mono text-[var(--color-text-main)] select-none">
        <button
          type="button"
          onClick={() => {
            playTactileClick(600);
            useStore.getState().toggleTimelinePlay();
          }}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors text-[11px] ${
            isTimelinePlaying
              ? 'bg-[var(--color-accent-blue)] text-white font-bold shadow'
              : 'bg-[var(--color-accent-blue)]/15 hover:bg-[var(--color-accent-blue)]/25 text-[var(--color-accent-blue)] border border-[var(--color-accent-blue)]/30'
          }`}
          title="Play continuous 4D temporal evolution of warming & aridification"
        >
          {isTimelinePlaying ? (
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          <span>{isTimelinePlaying ? 'PAUSE' : 'PLAY 4D'}</span>
        </button>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--color-text-secondary)]">YEAR:</span>
          <span className="font-bold text-[var(--color-text-main)] text-xs tracking-wider tabular-nums bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)]">
            {timeScrubberYear || endYear || 2023}
          </span>
        </div>

        <input
          id="timeline-year-scrubber"
          name="timelineYearScrubber"
          type="range"
          min={startYear || 2000}
          max={endYear || 2023}
          value={timeScrubberYear || endYear || 2023}
          onChange={(e) => useStore.getState().setTimeScrubberYear(parseInt(e.target.value, 10))}
          className="w-20 sm:w-28 md:w-32 accent-[var(--color-accent-blue)] cursor-pointer h-1.5"
          aria-label="4D Timeline Year Scrubber"
        />

        {/* Quick Epoch Milestone Jump Buttons */}
        <div className="hidden md:flex items-center gap-1 border-l border-[var(--color-border-subtle)] pl-1.5">
          <button
            type="button"
            onClick={() => useStore.getState().setTimeScrubberYear(startYear || 2000)}
            className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]"
          >
            {startYear || 2000}
          </button>
          <button
            type="button"
            onClick={() => useStore.getState().setTimeScrubberYear(Math.round(((startYear || 2000) + (endYear || 2023)) / 2))}
            className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]"
          >
            Mid
          </button>
          <button
            type="button"
            onClick={() => useStore.getState().setTimeScrubberYear(endYear || 2023)}
            className="px-1 py-0.5 rounded text-[10px] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]"
          >
            {endYear || 2023}
          </button>
        </div>
      </div>

      {/* GIS Instrument Toolstrip Docked at Top-Right (Persona Aware & Responsive) */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-[var(--color-bg-surface)]/95 border border-[var(--color-border-strong)] p-1.5 rounded shadow-lg backdrop-blur-md max-w-[calc(100%-4rem)] overflow-x-visible">
        {workstationMode === 'detective' ? (
          <>
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                useStore.getState().toggleMask();
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                maskSigOnly
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
              }`}
            >
              {maskSigOnly ? '✓ Real Trends Only' : 'Filter Flukes'}
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(800);
                setShowGlobe3D(!showGlobe3D);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                showGlobe3D
                  ? 'bg-cyan-500 text-black font-bold shadow-md'
                  : 'bg-[var(--color-bg-elevated)] text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 border border-cyan-500/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showGlobe3D ? 'bg-black' : 'bg-cyan-400'}`} />
              <span>{showGlobe3D ? '2D Map' : '3D Globe'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(500);
                mapInstanceRef.current?.setView([34.0, -98.0], 5);
              }}
              className="px-2 py-1 rounded text-[11px] font-mono bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)] transition-colors"
            >
              Reset View
            </button>
          </>
        ) : workstationMode === 'policy' ? (
          <>
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                useStore.getState().toggleLisa();
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                showLisa
                  ? 'bg-rose-600 text-white font-semibold'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
              }`}
            >
              High-Risk Hotspots
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(750);
                useStore.getState().toggleCompareMode();
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                compareMode
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
              }`}
            >
              Compare Jurisdictions
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                useStore.getState().toggleMask();
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                maskSigOnly
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
              }`}
            >
              Verified Trends
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(800);
                setShowGlobe3D(!showGlobe3D);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                showGlobe3D
                  ? 'bg-cyan-500 text-black font-bold shadow-md'
                  : 'bg-[var(--color-bg-elevated)] text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 border border-cyan-500/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showGlobe3D ? 'bg-black' : 'bg-cyan-400'}`} />
              <span>{showGlobe3D ? '2D Map' : '3D Globe'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(500);
                mapInstanceRef.current?.setView([34.0, -98.0], 5);
              }}
              className="px-2 py-1 rounded text-[11px] font-mono bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)] transition-colors"
            >
              Reset View
            </button>
          </>
        ) : (
          /* Pro Scientific Workstation */
          <>
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                useStore.getState().toggleMask();
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                maskSigOnly
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
              }`}
            >
              {maskSigOnly ? '✓ Real Trends Only' : 'Filter Flukes'}
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                useStore.getState().toggleLisa();
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                showLisa
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
              }`}
            >
              LISA Clusters
            </button>
            <button
              type="button"
              onClick={() => {
                playTactileClick(800);
                setShowGlobe3D(!showGlobe3D);
              }}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                showGlobe3D
                  ? 'bg-cyan-500 text-black font-bold shadow-md'
                  : 'bg-[var(--color-bg-elevated)] text-cyan-500 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 border border-cyan-500/40'
              }`}
              title="Toggle 3D Planetary Orthographic Globe View"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showGlobe3D ? 'bg-black' : 'bg-cyan-400'}`} />
              <span>{showGlobe3D ? '2D GIS' : '3D Globe'}</span>
            </button>

            {/* GIS Instruments Popover Menu for Pro Mode */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  playTactileClick(500);
                  setGisToolsOpen(!gisToolsOpen);
                }}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                  gisToolsOpen || showCurtainMode || showGibs || isVelocityMode || compareMode || !isRasterMode
                    ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-accent-blue)] border border-[var(--color-accent-blue)] font-semibold'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] border border-[var(--color-border-subtle)]'
                }`}
                title="Advanced GIS Instrumentation (NASA GIBS, Climate Velocity, Curtain Wipe, Dual Compare)"
                aria-expanded={gisToolsOpen}
              >
                {(showCurtainMode || showGibs || isVelocityMode || compareMode) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-blue)] animate-pulse" />
                )}
                <span>Instruments</span>
                <span className="text-[9px]">▾</span>
              </button>

              {gisToolsOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-[1100] w-56 bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] rounded-md shadow-2xl p-1.5 font-mono text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1 text-[9px] uppercase font-bold text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)] tracking-wider mb-1">
                    GIS Instrumentation Tray
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(650);
                      useStore.getState().toggleGibs();
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      showGibs ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-text-main)] font-semibold' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${showGibs ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      NASA GIBS Satellite
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{showGibs ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(700);
                      useStore.getState().toggleVelocityMode();
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      isVelocityMode ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-text-main)] font-semibold' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isVelocityMode ? 'bg-cyan-400' : 'bg-slate-500'}`} />
                      Climate Velocity
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{isVelocityMode ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(650);
                      useStore.getState().toggleCurtainMode();
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      showCurtainMode ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-text-main)] font-semibold' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${showCurtainMode ? 'bg-amber-400' : 'bg-slate-500'}`} />
                      Curtain Wipe
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{showCurtainMode ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(750);
                      useStore.getState().toggleCompareMode();
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      compareMode ? 'bg-[var(--color-accent-blue)]/20 text-[var(--color-text-main)] font-semibold' : 'hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${compareMode ? 'bg-amber-400' : 'bg-slate-500'}`} />
                      Dual Compare
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{compareMode ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playTactileClick(600);
                      setIsRasterMode(!isRasterMode);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] cursor-pointer"
                  >
                    <span>Grid Style</span>
                    <span className="text-[10px] text-[var(--color-accent-blue)] font-semibold">
                      {isRasterMode ? 'Raster' : 'Stipple'}
                    </span>
                  </button>

                  <div className="pt-1 mt-1 border-t border-[var(--color-border-subtle)]">
                    <button
                      type="button"
                      onClick={() => {
                        playTactileClick(500);
                        mapInstanceRef.current?.setView([34.0, -98.0], 5);
                        setGisToolsOpen(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] text-[11px] cursor-pointer"
                    >
                      Reset Map Extent
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Prominent Compare Mode HUD Banner */}
      {compareMode && (
        <div className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 z-[1000] bg-[var(--color-bg-surface)]/95 border-2 border-amber-400 text-[var(--color-text-main)] text-xs px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg backdrop-blur-md font-mono flex items-center gap-2 sm:gap-3 shadow-2xl animate-in fade-in slide-in-from-top duration-200 max-w-[95%] sm:max-w-md">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
          <div className="font-semibold tracking-wide text-[11px] truncate">
            {!comparePinA ? (
              <span>COMPARISON MODE: Click Pin A on map</span>
            ) : !comparePinB ? (
              <span>Now click Pin B to compare regimes</span>
            ) : (
              <span>Comparing Pin A vs Pin B (click cell to reset)</span>
            )}
          </div>
          <button
            onClick={() => toggleCompareMode()}
            className="ml-auto px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded border border-amber-500/50 transition-colors shrink-0 cursor-pointer text-[10px]"
          >
            Exit
          </button>
        </div>
      )}

      {/* GIBS Satellite Clamping Warning Badge */}
      {(showGibs || showCurtainMode) && (timeScrubberYear || endYear) < 2000 && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[1000] bg-cyan-950/90 border border-cyan-500/50 text-cyan-200 px-3 py-1.5 rounded shadow-lg backdrop-blur-md text-[11px] font-mono flex items-center gap-2 max-w-[90%]">
          <svg className="w-3.5 h-3.5 shrink-0 text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          <span className="truncate">MODIS Terra imagery available 2000–Present; clamped to 2000</span>
        </div>
      )}

      {/* NASA GIBS Live Satellite Instrument Tray */}
      {showGibs && (
        <div className="absolute top-12 sm:top-14 right-3 z-[1000] w-72 max-w-[calc(100%-1.5rem)] bg-[var(--color-bg-surface)]/95 border border-[var(--color-accent-blue)]/50 rounded shadow-2xl backdrop-blur-md p-3 font-mono text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span className="font-semibold text-[var(--color-text-main)] tracking-wider">NASA EOSDIS GIBS</span>
            </div>
            <span className="text-[10px] bg-[var(--color-accent-blue)]/15 text-[var(--color-accent-blue)] px-1.5 py-0.5 rounded border border-[var(--color-accent-blue)]/30 font-bold">
              WMTS EPSG:3857
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label htmlFor="gibs-satellite-layer-select" className="text-[10px] text-[var(--color-text-secondary)] block mb-1">
                SATELLITE SENSOR & PRODUCT:
              </label>
              <select
                id="gibs-satellite-layer-select"
                name="gibsLayerId"
                aria-label="Satellite Sensor and Product"
                value={gibsLayerId}
                onChange={(e) => useStore.getState().setGibsLayerId(e.target.value)}
                className="w-full bg-[var(--color-bg-elevated)] text-[var(--color-text-main)] text-xs rounded border border-[var(--color-border-subtle)] px-2 py-1.5 focus:outline-none focus:border-[var(--color-accent-blue)]"
              >
                {NASA_GIBS_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({preset.badge})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)] mb-1">
                <label htmlFor="gibs-satellite-opacity">SATELLITE OPACITY:</label>
                <span className="text-[var(--color-text-main)] font-bold">{Math.round((gibsOpacity ?? 0.7) * 100)}%</span>
              </div>
              <input
                id="gibs-satellite-opacity"
                name="gibsOpacity"
                aria-label="Satellite Opacity"
                type="range"
                min="0.10"
                max="1.0"
                step="0.05"
                value={gibsOpacity ?? 0.7}
                onChange={(e) => useStore.getState().setGibsOpacity(parseFloat(e.target.value))}
                className="w-full accent-[var(--color-accent-blue)] cursor-pointer h-1.5"
              />
            </div>

            <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[9px] text-[var(--color-text-muted)]">
              <span>CAPTURE: {timeScrubberYear || endYear || 2023}-07-15</span>
              <span>LEVEL-9 PIXEL MATCH</span>
            </div>
          </div>
        </div>
      )}

      {/* Scientific Calibrated Colorbar Legend */}
      {analysisData && (
        isLegendCollapsed ? (
          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              setIsLegendCollapsed(false);
            }}
            className="absolute bottom-[58px] right-3 sm:bottom-[54px] z-[990] bg-[var(--color-bg-surface)]/95 border border-[var(--color-border-strong)] px-2.5 py-1 rounded shadow-md backdrop-blur-md text-[10px] font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Expand Colorbar Legend"
            aria-label="Expand Colorbar Legend"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-blue)]" />
            <span>Legend ▴</span>
          </button>
        ) : (
          <div className="absolute bottom-[58px] right-3 sm:bottom-[54px] z-[990] bg-[var(--color-bg-surface)]/95 border border-[var(--color-border-strong)] px-3 py-2 rounded shadow-lg backdrop-blur-md text-xs font-mono text-[var(--color-text-main)] pointer-events-auto max-w-[260px] sm:max-w-[280px]">
            <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
              <span>{showLisa ? 'Spatial Regimes (LISA)' : analysisData.isCompound ? 'Compound Hazard (CAI)' : (L_map.mapLegendTitle || 'Theil-Sen Trend Rate')}</span>
              <button
                type="button"
                onClick={() => {
                  playTactileClick(500);
                  setIsLegendCollapsed(true);
                }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] px-1 -mr-1 rounded text-[11px] leading-none cursor-pointer"
                title="Collapse Legend"
                aria-label="Collapse Legend"
              >
                −
              </button>
            </div>
            {showLisa ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444] shrink-0" />
                  <span className="truncate">High-High (Hotspot)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4] shrink-0" />
                  <span className="truncate">Low-Low (Refugia)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] shrink-0" />
                  <span className="truncate">Spatial Outlier</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#64748b]/40 border border-[#64748b]/50 shrink-0" />
                  <span className="truncate">Non-Significant</span>
                </div>
              </div>
            ) : analysisData.isCompound ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626] shrink-0" />
                  <span className="truncate">Severe Aridification</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] shrink-0" />
                  <span className="truncate">Moderate Stress</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#0066ff] shrink-0" />
                  <span className="truncate">Hydrological Shift</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#64748b]/40 border border-[#64748b]/50 shrink-0" />
                  <span className="truncate">Neutral Baseline</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[9px] text-[var(--color-text-secondary)] mb-1">
                  <span className="text-[9px] text-[var(--color-text-muted)]">{analysisData.variable || 'Variable'}</span>
                  <span>{analysisData.slope_units || '°C / dec'}</span>
                </div>
                <div
                  className="w-full h-2 rounded-sm mb-1"
                  style={{
                    background: 'linear-gradient(to right, #06b6d4 0%, #38bdf8 25%, #64748b 50%, #f59e0b 75%, #ef4444 100%)'
                  }}
                />
                {workstationMode === 'detective' ? (
                  <div className="flex items-center justify-between text-[9px] text-[var(--color-text-secondary)] font-mono font-medium">
                    <span>❄️ Cooling</span>
                    <span className="text-[var(--color-text-muted)]">Normal</span>
                    <span>Heating Up 🔥</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[9px] text-[var(--color-text-secondary)] font-mono tabular-nums">
                    <span>{analysisData.summary?.min_slope !== undefined ? `${analysisData.summary.min_slope > 0 ? '+' : ''}${analysisData.summary.min_slope.toFixed(2)}` : '-0.50'}</span>
                    <span className="text-[var(--color-text-muted)]">0.00</span>
                    <span>{analysisData.summary?.max_slope !== undefined ? `+${analysisData.summary.max_slope.toFixed(2)}` : '+0.50'}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
