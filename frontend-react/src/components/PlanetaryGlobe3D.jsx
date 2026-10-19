import { useRef, useEffect, useState, useCallback } from 'react';
import { playTactileClick } from '../utils/audio';

// World Coastline Simplified Points [lon, lat] for high-speed zero-dependency vector landmasses
const CONTINENT_OUTLINES = [
  // North America
  [[-168, 65], [-140, 70], [-125, 50], [-124, 38], [-117, 32], [-105, 20], [-80, 8], [-77, 9], [-82, 23], [-80, 25], [-75, 35], [-70, 42], [-60, 46], [-64, 50], [-78, 63], [-95, 70], [-120, 72], [-168, 65]],
  // South America
  [[-80, 8], [-77, -5], [-71, -15], [-73, -40], [-70, -55], [-65, -55], [-50, -35], [-35, -5], [-50, 0], [-60, 10], [-75, 12], [-80, 8]],
  // Europe & Asia
  [[-10, 36], [0, 43], [10, 45], [15, 38], [25, 40], [30, 31], [35, 32], [50, 25], [60, 25], [70, 20], [80, 15], [90, 22], [100, 15], [105, 20], [120, 23], [122, 30], [125, 40], [130, 42], [140, 50], [160, 55], [170, 65], [180, 67], [170, 70], [140, 73], [100, 76], [70, 73], [50, 68], [30, 70], [20, 60], [10, 55], [5, 60], [0, 50], [-5, 48], [-10, 36]],
  // Africa
  [[-17, 30], [-17, 15], [10, 4], [10, -5], [18, -34], [28, -33], [35, -20], [40, -10], [50, 12], [43, 12], [32, 31], [25, 32], [10, 37], [-5, 36], [-17, 30]],
  // Australia
  [[114, -22], [115, -34], [135, -35], [140, -38], [150, -35], [153, -28], [145, -15], [135, -12], [125, -15], [114, -22]]
];

export default function PlanetaryGlobe3D({
  grid = [],
  bbox = null,
  selectedCell = null,
  onSelectCell = () => {},
  onClose = () => {}
}) {
  const canvasRef = useRef(null);

  // Initial center based on bbox
  const getInitialCenter = () => {
    if (bbox && bbox.length === 4) {
      return {
        lon: (bbox[0] + bbox[2]) / 2,
        lat: (bbox[1] + bbox[3]) / 2
      };
    }
    return { lon: -98.0, lat: 38.0 }; // Default CONUS
  };

  const [center, setCenter] = useState(getInitialCenter);
  const [radius, setRadius] = useState(210);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const centerRef = useRef(center);
  const radiusRef = useRef(radius);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    radiusRef.current = radius;
  }, [radius]);

  // Spherical Orthographic Projection Math
  const project = useCallback((lonDeg, latDeg, cLonDeg, cLatDeg, r, cx, cy) => {
    const lambda = (lonDeg * Math.PI) / 180;
    const phi = (latDeg * Math.PI) / 180;
    const lambda0 = (cLonDeg * Math.PI) / 180;
    const phi0 = (cLatDeg * Math.PI) / 180;

    const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0);
    const visible = cosC > 0;

    const x = cx + r * Math.cos(phi) * Math.sin(lambda - lambda0);
    const y = cy - r * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0));

    return { x, y, visible, depth: cosC };
  }, []);

  // Main Render Loop
  const renderGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const r = radiusRef.current;
    const cLon = centerRef.current.lon;
    const cLat = centerRef.current.lat;

    // 1. Clear & Space Background
    ctx.fillStyle = '#06080c';
    ctx.fillRect(0, 0, width, height);

    // Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 40; i++) {
      const sx = (Math.sin(i * 99) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 33) * 0.5 + 0.5) * height;
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    // 2. Atmospheric Outer Glow
    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.15);
    glowGrad.addColorStop(0, 'rgba(0, 102, 255, 0.35)');
    glowGrad.addColorStop(0.5, 'rgba(0, 195, 255, 0.12)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // 3. Globe Sphere Body (Oceans with spherical shading)
    const oceanGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    oceanGrad.addColorStop(0, '#1a365d'); // Sunlit ocean
    oceanGrad.addColorStop(0.7, '#0f172a');
    oceanGrad.addColorStop(1, '#020617'); // Dark limb
    ctx.fillStyle = oceanGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Clip to globe circle for land & graticule
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // 4. Lat/Lon Graticule Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    // Parallels
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else { ctx.lineTo(p.x, p.y); }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }
    // Meridians
    for (let lon = -180; lon <= 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else { ctx.lineTo(p.x, p.y); }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // 5. Continent Outlines (Landmasses)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1.25;

    CONTINENT_OUTLINES.forEach((poly) => {
      ctx.beginPath();
      let started = false;
      poly.forEach(([lon, lat]) => {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else { ctx.lineTo(p.x, p.y); }
        }
      });
      ctx.fill();
      ctx.stroke();
    });

    // 6. Analyzed Spatial Grid Cells (Plotted in 3D Spherical Space)
    grid.forEach((cell) => {
      const p = project(cell.lon, cell.lat, cLon, cLat, r, cx, cy);
      if (!p.visible) return;

      const slope = cell.slope ?? cell.temp_slope ?? 0;
      const isWarm = slope > 0;
      const baseRadius = 4.5 * p.depth;

      // Color mapping
      let color = isWarm ? 'rgba(239, 68, 68, 0.85)' : 'rgba(6, 182, 212, 0.85)';
      if (cell.lisa_cluster === 'HH') color = 'rgba(245, 158, 11, 0.95)';

      // Glow halo
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, baseRadius), 0, Math.PI * 2);
      ctx.fill();

      // Extruded elevation pin for significant warming hotspots
      if (cell.is_significant_fdr && p.depth > 0.3) {
        const pinHeight = Math.min(22, Math.max(6, Math.abs(slope) * 35)) * p.depth;
        ctx.strokeStyle = isWarm ? 'rgba(245, 158, 11, 0.9)' : 'rgba(6, 182, 212, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - pinHeight);
        ctx.stroke();

        ctx.fillStyle = isWarm ? '#f59e0b' : '#06b6d4';
        ctx.beginPath();
        ctx.arc(p.x, p.y - pinHeight, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 7. Selected Cell Reticle
    if (selectedCell) {
      const sp = project(selectedCell.lon, selectedCell.lat, cLon, cLat, r, cx, cy);
      if (sp.visible) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore(); // Restore from globe circle clip

    // 8. Globe Rim Edge Highlight
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }, [project, grid, selectedCell]);

  // Handle Canvas Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      renderGlobe();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [renderGlobe]);

  // Auto-Rotation animation loop
  useEffect(() => {
    if (!autoRotate) return;
    let frameId;
    const loop = () => {
      setCenter((prev) => ({
        ...prev,
        lon: (prev.lon + 0.35) % 360
      }));
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [autoRotate]);

  // Re-render when center or radius changes
  useEffect(() => {
    renderGlobe();
  }, [center, radius, renderGlobe]);

  // Mouse Drag / Touch Rotation Handlers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      const sens = 0.45;
      setCenter((prev) => ({
        lon: (prev.lon - dx * sens) % 360,
        lat: Math.max(-85, Math.min(85, prev.lat + dy * sens))
      }));
    } else {
      // Raycast hover check against grid points
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = radiusRef.current;
      const cLon = centerRef.current.lon;
      const cLat = centerRef.current.lat;

      let found = null;
      for (const cell of grid) {
        const p = project(cell.lon, cell.lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          const dist = Math.hypot(p.x - mx, p.y - my);
          if (dist < 10) {
            found = { ...cell, screenX: p.x, screenY: p.y };
            break;
          }
        }
      }
      setHoveredCell(found);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 18 : -18;
    setRadius((prev) => Math.max(120, Math.min(480, prev + delta)));
  };

  const handleClick = () => {
    if (hoveredCell) {
      playTactileClick(850);
      onSelectCell(hoveredCell.lat, hoveredCell.lon);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#06080c] select-none overflow-hidden font-mono">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating HUD Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-lg p-3 text-xs text-slate-200 shadow-xl max-w-xs">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold tracking-wide uppercase text-[10px] text-cyan-400 font-sans">
              3D Orthographic Planetary Globe
            </span>
          </div>
          <div className="text-[10px] text-slate-400 space-y-0.5 font-mono">
            <div>Center: {Math.abs(Math.round(center.lat * 10) / 10)}°{center.lat >= 0 ? 'N' : 'S'}, {Math.abs(Math.round(center.lon * 10) / 10)}°{center.lon >= 0 ? 'E' : 'W'}</div>
            <div>Grid Points Rendered: {grid.length}</div>
            <div className="text-[9px] text-slate-500 pt-1">Drag to rotate • Scroll to zoom</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playTactileClick(600);
              setAutoRotate(!autoRotate);
            }}
            className={`px-3 py-1.5 rounded text-xs border backdrop-blur-md font-mono transition-all ${
              autoRotate
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {autoRotate ? '⏸ Pause Orbit' : '▶ Auto Orbit'}
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileClick(600);
              setCenter(getInitialCenter());
              setRadius(210);
            }}
            className="px-3 py-1.5 rounded text-xs bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all font-mono"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* Close / Return to 2D GIS Map */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={() => {
            playTactileClick(700);
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-lg transition-all"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          <span>Return to 2D GIS Map</span>
        </button>
      </div>

      {/* Hovered Cell Tooltip on 3D Globe */}
      {hoveredCell && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded bg-slate-950/95 border border-cyan-500/40 text-slate-200 text-xs shadow-2xl backdrop-blur-md"
          style={{ left: hoveredCell.screenX, top: hoveredCell.screenY }}
        >
          <div className="font-bold text-cyan-400 font-mono text-[10px]">
            {Math.abs(hoveredCell.lat).toFixed(1)}°{hoveredCell.lat >= 0 ? 'N' : 'S'}, {Math.abs(hoveredCell.lon).toFixed(1)}°{hoveredCell.lon >= 0 ? 'E' : 'W'}
          </div>
          <div className="text-[10px] text-slate-300">
            Slope: <strong className={hoveredCell.slope > 0 ? 'text-[#f59e0b]' : 'text-cyan-400'}>
              {hoveredCell.slope > 0 ? '+' : ''}{hoveredCell.slope?.toFixed(4)}
            </strong>
          </div>
          <div className="text-[9px] text-slate-500 font-mono">
            {hoveredCell.lisa_cluster ? `Regime: ${hoveredCell.lisa_cluster}` : 'Click to select'}
          </div>
        </div>
      )}
    </div>
  );
}
