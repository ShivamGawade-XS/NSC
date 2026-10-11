import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useStore from '../store/useStore';
import { getTrendColor, getLISAColor, getHazardColor, formatCoords } from '../utils/helpers';

export default function TrendMap() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const gridLayerRef = useRef(null);
  const domainBoundsRef = useRef(null);
  const contrastLayerRef = useRef(null);
  const gibsLayerRef = useRef(null);

  const analysisData = useStore((s) => s.analysisData);
  const maskSigOnly = useStore((s) => s.maskSigOnly);
  const showLisa = useStore((s) => s.showLisa);
  const showGibs = useStore((s) => s.showGibs);
  const selectCell = useStore((s) => s.selectCell);
  const endYear = useStore((s) => s.endYear);

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
        fillOpacity: isSig ? 0.88 : 0.45,
        color: isSig ? (showLisa ? '#ffffff' : '#38bdf8') : '#334155',
        weight: isSig ? 1.5 : 0.8,
      });

      const ciText = cell.ci_lower !== undefined && cell.ci_upper !== undefined
        ? `[${cell.ci_lower > 0 ? '+' : ''}${cell.ci_lower.toFixed(3)}, ${cell.ci_upper > 0 ? '+' : ''}${cell.ci_upper.toFixed(3)}]`
        : 'N/A';

      marker.bindTooltip(`
        <div style="font-family: Inter, sans-serif; font-size: 11px;">
          <strong>Coords:</strong> ${formatCoords(cell.lat, cell.lon)}<br/>
          <strong>Slope:</strong> ${cell.slope > 0 ? '+' : ''}${cell.slope.toFixed(4)}<br/>
          <strong>95% CI:</strong> ${ciText}<br/>
          <strong>LISA:</strong> ${cell.lisa_cluster || 'NS'}<br/>
          <strong>p-val:</strong> ${cell.p_value.toFixed(4)} | <strong>FDR q:</strong> ${cell.q_value !== undefined ? cell.q_value.toFixed(4) : 'N/A'}
        </div>
      `);

      marker.on('click', () => selectCell(cell.lat, cell.lon));
      gridLayerRef.current?.addLayer(marker);
    });
  }, [analysisData, maskSigOnly, showLisa, selectCell]);

  const renderCompoundGrid = useCallback((cells) => {
    const canvasRenderer = L.canvas({ padding: 0.5 });
    cells.forEach((cell) => {
      const color = getHazardColor(cell.hazard_type);
      const isHazard = cell.hazard_type !== 'neutral';

      const marker = L.circleMarker([cell.lat, cell.lon], {
        renderer: canvasRenderer,
        radius: isHazard ? 8 : 5,
        fillColor: color,
        fillOpacity: isHazard ? 0.9 : 0.45,
        color: isHazard ? '#ffffff' : '#334155',
        weight: isHazard ? 1.5 : 0.8,
      });

      marker.bindTooltip(`
        <div style="font-family: Inter, sans-serif; font-size: 11px;">
          <strong>Coords:</strong> ${formatCoords(cell.lat, cell.lon)}<br/>
          <strong>Hazard:</strong> <span style="color:${color};font-weight:700;">${cell.hazard_type.replace(/_/g, ' ').toUpperCase()}</span><br/>
          <strong>CAI:</strong> ${cell.cai !== undefined ? cell.cai.toFixed(3) : 'N/A'}<br/>
          <strong>Temp Slope:</strong> ${cell.temp_slope !== undefined ? (cell.temp_slope > 0 ? '+' : '') + cell.temp_slope.toFixed(3) + ' °C/dec' : 'N/A'}
        </div>
      `);
      marker.on('click', () => useStore.getState().selectCompoundCell(cell));
      gridLayerRef.current?.addLayer(marker);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    const container = mapRef.current;
    if (mapInstanceRef.current || !container) return;

    const map = L.map(container, {
      center: [34.0, -98.0],
      zoom: 5,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: true,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, NAVTEQ | NASA Space Apps 2026',
        maxZoom: 16,
      }
    ).addTo(map);

    gridLayerRef.current = L.layerGroup().addTo(map);
    contrastLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      if (container) {
        delete container._leaflet_id;
      }
    };
  }, []);

  // Render grid when analysis data or toggles change
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
        { color: '#38bdf8', weight: 1.5, dashArray: '4, 4', fill: false, interactive: false }
      ).addTo(map);
      map.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [40, 40] });
    }
  }, [analysisData, maskSigOnly, showLisa, renderSpatialGrid, renderCompoundGrid]);

  // GIBS satellite layer toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (gibsLayerRef.current && map.hasLayer(gibsLayerRef.current)) {
      map.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (showGibs) {
      const gibsDate = `${endYear}-07-15`;
      gibsLayerRef.current = L.tileLayer(
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
        { attribution: `Imagery &copy; NASA EOSDIS GIBS (${gibsDate})`, maxZoom: 9, opacity: 0.65 }
      ).addTo(map);

      if (gridLayerRef.current) {
        if (typeof gridLayerRef.current.bringToFront === 'function') {
          gridLayerRef.current.bringToFront();
        } else if (typeof gridLayerRef.current.eachLayer === 'function') {
          gridLayerRef.current.eachLayer((layer) => layer.bringToFront?.());
        }
      }
    }
  }, [showGibs, endYear]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-border-subtle">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '400px' }} />

      {/* Floating HUD Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 glass-card px-4 py-2">
        <button
          onClick={() => useStore.getState().toggleGibs()}
          className={`preset-pill text-[10px] ${showGibs ? 'active' : ''}`}
        >
          🛰️ GIBS
        </button>
        <button
          onClick={() => useStore.getState().toggleLisa()}
          className={`preset-pill text-[10px] ${showLisa ? 'active' : ''}`}
        >
          📊 LISA
        </button>
        <button
          onClick={() => useStore.getState().toggleMask()}
          className={`preset-pill text-[10px] ${maskSigOnly ? 'active' : ''}`}
        >
          🎯 Sig Only
        </button>
        <button
          onClick={() => mapInstanceRef.current?.setView([34.0, -98.0], 5)}
          className="preset-pill text-[10px]"
        >
          🔄 Reset
        </button>
      </div>
    </div>
  );
}
