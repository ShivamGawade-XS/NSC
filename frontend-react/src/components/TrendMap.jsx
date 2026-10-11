import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useStore from '../store/useStore';
import { getTrendColor, getLISAColor, getHazardColor, formatCoords, escapeHtml } from '../utils/helpers';
import JudgeTourOverlay from './JudgeTourOverlay';
import { playTactileClick } from '../utils/audio';

export default function TrendMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const gridLayerRef = useRef(null);
  const velocityLayerRef = useRef(null);
  const compareLayerRef = useRef(null);
  const domainBoundsRef = useRef(null);
  const gibsLayerRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);

  const analysisData = useStore((s) => s.analysisData);
  const maskSigOnly = useStore((s) => s.maskSigOnly);
  const showLisa = useStore((s) => s.showLisa);
  const showGibs = useStore((s) => s.showGibs);
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

  // 1. Render Spatial Trend Grid
  const renderSpatialGrid = useCallback((grid) => {
    if (!analysisData?.summary) return;
    const canvasRenderer = L.canvas({ padding: 0.5 });
    const useFdr = useStore.getState().useFdr;
    const { min_slope: minSlope, max_slope: maxSlope } = analysisData.summary;

    grid.forEach((cell) => {
      const isSig = useFdr ? cell.is_significant_fdr : cell.is_significant_raw;
      if (maskSigOnly && !isSig) return;

      const color = showLisa ? getLISAColor(cell.lisa_cluster) : getTrendColor(cell.slope, minSlope, maxSlope);

      const marker = L.circleMarker([cell.lat, cell.lon], {
        renderer: canvasRenderer,
        radius: isSig ? 9 : 6,
        fillColor: color,
        fillOpacity: isSig ? 0.90 : 0.45,
        color: isSig ? (showLisa ? '#ffffff' : '#38bdf8') : '#334155',
        weight: isSig ? 1.5 : 0.8,
      });

      const ciText = cell.ci_lower !== undefined && cell.ci_upper !== undefined
        ? `[${cell.ci_lower > 0 ? '+' : ''}${cell.ci_lower.toFixed(3)}, ${cell.ci_upper > 0 ? '+' : ''}${cell.ci_upper.toFixed(3)}]`
        : 'N/A';

      marker.bindTooltip(`
        <div style="font-family: Inter, sans-serif; font-size: 11px;">
          <strong>Coords:</strong> ${escapeHtml(formatCoords(cell.lat, cell.lon))}<br/>
          <strong>Slope:</strong> ${cell.slope > 0 ? '+' : ''}${cell.slope.toFixed(4)}<br/>
          <strong>95% CI:</strong> ${escapeHtml(ciText)}<br/>
          <strong>LISA:</strong> ${escapeHtml(cell.lisa_cluster || 'NS')}<br/>
          <strong>p-val:</strong> ${cell.p_value.toFixed(4)} | <strong>FDR q:</strong> ${cell.q_value !== undefined ? cell.q_value.toFixed(4) : 'N/A'}
        </div>
      `);

      marker.on('click', () => {
        playTactileClick(650);
        selectCell(cell.lat, cell.lon);
      });
      gridLayerRef.current?.addLayer(marker);
    });
  }, [analysisData, maskSigOnly, showLisa, selectCell]);

  // 2. Render Compound Grid
  const renderCompoundGrid = useCallback((cells) => {
    const canvasRenderer = L.canvas({ padding: 0.5 });
    cells.forEach((cell) => {
      const color = getHazardColor(cell.hazard_type);
      const isHazard = cell.hazard_type !== 'neutral';

      const marker = L.circleMarker([cell.lat, cell.lon], {
        renderer: canvasRenderer,
        radius: isHazard ? 8 : 5,
        fillColor: color,
        fillOpacity: isHazard ? 0.92 : 0.45,
        color: isHazard ? '#ffffff' : '#334155',
        weight: isHazard ? 1.5 : 0.8,
      });

      marker.bindTooltip(`
        <div style="font-family: Inter, sans-serif; font-size: 11px;">
          <strong>Coords:</strong> ${escapeHtml(formatCoords(cell.lat, cell.lon))}<br/>
          <strong>Hazard:</strong> <span style="color:${color};font-weight:700;">${escapeHtml(String(cell.hazard_type || '').replace(/_/g, ' ').toUpperCase())}</span><br/>
          <strong>CAI:</strong> ${cell.cai !== undefined ? cell.cai.toFixed(3) : 'N/A'}<br/>
          <strong>Temp Slope:</strong> ${cell.temp_slope !== undefined ? (cell.temp_slope > 0 ? '+' : '') + cell.temp_slope.toFixed(3) + ' °C/dec' : 'N/A'}
        </div>
      `);
      marker.on('click', () => {
        playTactileClick(650);
        useStore.getState().selectCompoundCell(cell);
      });
      gridLayerRef.current?.addLayer(marker);
    });
  }, []);

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
          <strong>Velocity:</strong> ${vec.velocity_km_decade} km/decade<br/>
          <strong>Bearing:</strong> ${vec.bearing_deg}° (${vec.cardinal})<br/>
          <strong>Gradient:</strong> ${vec.spatial_gradient} / km
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
      }).bindTooltip(`<strong>Location A:</strong> ${formatCoords(comparePinA.lat, comparePinA.lon)}`);
      compareLayerRef.current.addLayer(pinA);
    }

    if (comparePinB) {
      const pinB = L.circleMarker([comparePinB.lat, comparePinB.lon], {
        radius: 12,
        fillColor: '#ff9f1c',
        fillOpacity: 0.85,
        color: '#ffffff',
        weight: 2.5,
      }).bindTooltip(`<strong>Location B:</strong> ${formatCoords(comparePinB.lat, comparePinB.lon)}`);
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
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, NASA Space Apps 2026',
        maxZoom: 16,
      }
    ).addTo(map);

    gridLayerRef.current = L.layerGroup().addTo(map);
    velocityLayerRef.current = L.layerGroup().addTo(map);
    compareLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
      if (container) delete container._leaflet_id;
    };
  }, []);

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
  }, [analysisData, maskSigOnly, showLisa, renderSpatialGrid, renderCompoundGrid]);

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
      const year = timeScrubberYear || endYear;
      const gibsDate = `${year}-07-15`;
      gibsLayerRef.current = L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        { attribution: `NASA GIBS (${gibsDate})`, maxZoom: 9, opacity: showCurtainMode ? 0.95 : 0.65 }
      ).addTo(map);

      gridLayerRef.current?.bringToFront?.();
      velocityLayerRef.current?.bringToFront?.();
      compareLayerRef.current?.bringToFront?.();
    }
  }, [showGibs, showCurtainMode, timeScrubberYear, endYear]);

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

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-[#040711] shadow-2xl">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '400px' }} />

      {/* Autonomous Judge Tour Overlay */}
      {mapReady && <JudgeTourOverlay mapInstance={mapInstanceRef.current} />}

      {/* Curtain Comparison Slider Overlay */}
      {showCurtainMode && (
        <div
          className="absolute inset-0 pointer-events-none z-[800]"
          style={{
            clipPath: `polygon(${curtainSplit}% 0, 100% 0, 100% 100%, ${curtainSplit}% 100%)`,
            backdropFilter: 'contrast(1.15) brightness(1.1)'
          }}
        >
          <div className="absolute top-4 right-4 bg-black/80 text-cyan-400 font-mono text-[10px] px-2.5 py-1 rounded border border-cyan-500/30">
            RIGHT: COMPUTED TREND RASTER
          </div>
        </div>
      )}

      {showCurtainMode && (
        <div className="absolute top-4 left-4 z-[900] bg-black/80 text-amber-300 font-mono text-[10px] px-2.5 py-1 rounded border border-amber-500/30">
          LEFT: NASA GIBS SATELLITE TILES
        </div>
      )}

      {/* Curtain Slider Handle */}
      {showCurtainMode && (
        <div
          className="absolute top-0 bottom-0 z-[1000] w-1 bg-cyan-400 cursor-ew-resize flex items-center justify-center shadow-[0_0_15px_#00f0ff]"
          style={{ left: `${curtainSplit}%` }}
        >
          <div className="w-7 h-7 rounded-full bg-cyan-400 text-black flex items-center justify-center text-xs font-bold shadow-lg pointer-events-auto">
            ↔
          </div>
        </div>
      )}

      {/* 4D Spatiotemporal Timeline Scrubber Dock */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-[#060a16]/90 border border-white/15 px-4 py-2 rounded-xl backdrop-blur-md shadow-xl">
        <button
          onClick={() => {
            playTactileClick(600);
            useStore.getState().toggleTimelinePlay();
          }}
          className="text-xs px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 font-mono"
        >
          {isTimelinePlaying ? '⏸ Pause' : '▶ Play 4D'}
        </button>
        <span className="text-xs font-mono text-white font-bold tracking-wider">
          {timeScrubberYear || startYear}
        </span>
        <input
          type="range"
          min={startYear}
          max={endYear}
          value={timeScrubberYear || startYear}
          onChange={(e) => useStore.getState().setTimeScrubberYear(parseInt(e.target.value, 10))}
          className="w-32 accent-cyan-400 cursor-pointer"
        />
        <span className="text-[10px] font-mono text-zinc-400">
          {startYear}–{endYear}
        </span>
      </div>

      {/* Bottom Floating Mission HUD Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 bg-[#060a16]/90 border border-white/15 px-3 py-1.5 rounded-xl backdrop-blur-md shadow-2xl">
        <button
          onClick={() => {
            playTactileClick(650);
            useStore.getState().toggleCurtainMode();
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
            showCurtainMode
              ? 'bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20'
              : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          🪟 Curtain
        </button>

        <button
          onClick={() => {
            playTactileClick(700);
            useStore.getState().toggleVelocityMode();
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
            isVelocityMode
              ? 'bg-cyan-400 text-black font-bold shadow-md shadow-cyan-400/20'
              : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          🧭 Velocity
        </button>

        <button
          onClick={() => {
            playTactileClick(750);
            useStore.getState().toggleCompareMode();
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
            compareMode
              ? 'bg-purple-400 text-black font-bold shadow-md shadow-purple-400/20'
              : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          📍 Compare A/B
        </button>

        <button
          onClick={() => {
            playTactileClick(600);
            useStore.getState().toggleLisa();
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
            showLisa
              ? 'bg-emerald-400 text-black font-bold'
              : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          📊 LISA
        </button>

        <button
          onClick={() => {
            playTactileClick(600);
            useStore.getState().toggleMask();
          }}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
            maskSigOnly
              ? 'bg-blue-400 text-black font-bold'
              : 'bg-white/5 text-zinc-300 hover:text-white border border-white/10'
          }`}
        >
          🎯 Sig Only
        </button>

        <button
          onClick={() => {
            playTactileClick(500);
            mapInstanceRef.current?.setView([34.0, -98.0], 5);
          }}
          className="px-2.5 py-1 rounded text-[11px] font-mono bg-white/5 text-zinc-400 hover:text-white border border-white/10"
        >
          🔄 Reset
        </button>
      </div>

      {/* Compare Mode Prompt Banner */}
      {compareMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-purple-950/90 border border-purple-400/50 text-purple-200 text-xs px-4 py-2 rounded-xl backdrop-blur-md font-mono flex items-center gap-2 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
          {!comparePinA
            ? 'Click anywhere on map to drop Pin A (Cyan)'
            : !comparePinB
            ? 'Click second location to drop Pin B (Amber) and inspect divergence'
            : 'Both locations active. View differential analysis in side panel.'}
        </div>
      )}
    </div>
  );
}
