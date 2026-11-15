import { useRef, useEffect, useState, useCallback } from 'react';
import { playTactileClick } from '../utils/audio';

// High-Fidelity World Coastline & Island Vectors [lon, lat] (Degrees)
// Covers all continents, major subcontinents, peninsulas, archipelagos, and polar ice sheets
const DETAILED_WORLD_LANDMASSES = [
  // ── 1. North America (Contiguous, Canada & Alaska) ─────────────────
  {
    name: 'North America',
    biome: 'temperate',
    points: [
      [-168, 66], [-162, 60], [-168, 53], [-160, 55], [-152, 58], [-140, 60], [-135, 54],
      [-128, 51], [-124, 48], [-124, 38], [-120, 34], [-117, 32], [-115, 30], [-110, 23],
      [-105, 20], [-97, 18], [-92, 16], [-88, 16], [-83, 10], [-80, 9], [-77, 8],
      // Gulf of Mexico & Florida
      [-82, 14], [-88, 21], [-90, 21], [-97, 26], [-97, 28], [-94, 29], [-90, 30],
      [-85, 30], [-82, 28], [-80, 25], [-81, 31], [-76, 35], [-74, 40], [-71, 42],
      // East Coast & Canada
      [-64, 45], [-60, 46], [-65, 49], [-60, 52], [-62, 56], [-66, 60], [-76, 62],
      [-80, 58], [-82, 52], [-90, 50], [-95, 60], [-95, 69], [-105, 69], [-115, 68],
      [-130, 70], [-140, 70], [-155, 71], [-165, 71], [-168, 66]
    ]
  },
  // ── 2. Greenland (Polar Ice Sheet) ──────────────────────────────────
  {
    name: 'Greenland',
    biome: 'ice',
    points: [
      [-44, 60], [-50, 64], [-53, 70], [-58, 76], [-52, 82], [-30, 83], [-18, 80],
      [-22, 70], [-35, 65], [-44, 60]
    ]
  },
  // ── 3. Central America & Caribbean Islands ──────────────────────────
  {
    name: 'Caribbean / Cuba',
    biome: 'tropical',
    points: [
      [-84, 22], [-80, 23], [-75, 20], [-77, 20], [-82, 21], [-84, 22]
    ]
  },
  // ── 4. South America ────────────────────────────────────────────────
  {
    name: 'South America',
    biome: 'tropical',
    points: [
      [-77, 8], [-75, 11], [-70, 12], [-62, 10], [-58, 6], [-50, 0], [-44, -2],
      [-36, -5], [-35, -8], [-37, -12], [-39, -18], [-42, -23], [-48, -28], [-53, -33],
      [-57, -38], [-65, -43], [-66, -48], [-65, -55], [-70, -55], [-74, -52], [-74, -45],
      [-72, -38], [-71, -30], [-70, -20], [-76, -14], [-81, -5], [-80, 2], [-77, 8]
    ]
  },
  // ── 5. Europe ───────────────────────────────────────────────────────
  {
    name: 'Europe',
    biome: 'temperate',
    points: [
      [-9, 36], [-9, 43], [-1, 44], [-2, 47], [-4, 48], [1, 51], [5, 53], [8, 55],
      [12, 55], [14, 54], [18, 54], [22, 57], [28, 60], [32, 60], [30, 46], [24, 45],
      [22, 40], [24, 38], [22, 36], [16, 38], [15, 41], [13, 45], [10, 44], [3, 42],
      [-1, 37], [-5, 36], [-9, 36]
    ]
  },
  // ── 6. Scandinavia ──────────────────────────────────────────────────
  {
    name: 'Scandinavia',
    biome: 'temperate',
    points: [
      [5, 58], [10, 58], [12, 56], [16, 56], [19, 60], [24, 65], [30, 70],
      [25, 71], [18, 69], [12, 65], [5, 62], [5, 58]
    ]
  },
  // ── 7. British Isles ────────────────────────────────────────────────
  {
    name: 'British Isles',
    biome: 'temperate',
    points: [
      [-5, 50], [1, 51], [0, 53], [-2, 57], [-5, 58], [-6, 55], [-3, 53], [-5, 50]
    ]
  },
  // ── 8. Africa ───────────────────────────────────────────────────────
  {
    name: 'Africa',
    biome: 'desert',
    points: [
      [-6, 36], [10, 37], [12, 33], [15, 32], [24, 32], [30, 31], [33, 30],
      // Red Sea & Horn of Africa
      [36, 22], [42, 13], [51, 11], [46, 5], [40, -4], [39, -10], [35, -20],
      [33, -27], [28, -32], [20, -34], [18, -34], [15, -28], [12, -18], [11, -8],
      [9, 2], [2, 6], [-4, 5], [-12, 7], [-17, 14], [-17, 21], [-13, 28], [-6, 36]
    ]
  },
  // ── 9. Madagascar ───────────────────────────────────────────────────
  {
    name: 'Madagascar',
    biome: 'tropical',
    points: [
      [44, -12], [50, -14], [48, -25], [44, -25], [44, -18], [44, -12]
    ]
  },
  // ── 10. Middle East & Arabian Peninsula ─────────────────────────────
  {
    name: 'Arabia',
    biome: 'desert',
    points: [
      [35, 30], [40, 30], [48, 30], [50, 26], [55, 25], [60, 22], [58, 18],
      [53, 16], [45, 13], [43, 15], [38, 20], [35, 28], [35, 30]
    ]
  },
  // ── 11. India & South Asia ──────────────────────────────────────────
  {
    name: 'Indian Subcontinent',
    biome: 'tropical',
    points: [
      [68, 24], [72, 21], [74, 15], [77, 8], [80, 10], [80, 16], [85, 20],
      [89, 22], [88, 26], [80, 28], [72, 28], [68, 24]
    ]
  },
  // ── 12. East Asia & Siberia (Continental Eurasia) ───────────────────
  {
    name: 'Eurasia',
    biome: 'temperate',
    points: [
      [30, 46], [40, 44], [50, 40], [60, 38], [65, 35], [75, 35], [85, 36],
      [95, 28], [105, 20], [108, 14], [105, 10], [102, 5], [104, 1], [108, 10],
      [115, 22], [120, 25], [122, 32], [121, 38], [126, 40], [130, 42], [135, 48],
      [142, 50], [155, 58], [165, 62], [178, 66], [180, 68], [170, 71], [145, 73],
      [115, 76], [85, 74], [60, 70], [45, 68], [32, 60], [30, 46]
    ]
  },
  // ── 13. Japan ───────────────────────────────────────────────────────
  {
    name: 'Japan',
    biome: 'temperate',
    points: [
      [130, 32], [133, 34], [138, 36], [141, 41], [143, 44], [141, 45],
      [140, 41], [136, 36], [132, 34], [130, 32]
    ]
  },
  // ── 14. Southeast Asia & Indonesia ──────────────────────────────────
  {
    name: 'Indonesia Archipelago',
    biome: 'tropical',
    points: [
      [96, 5], [104, -4], [114, -8], [125, -9], [130, -5], [122, 0], [115, 4],
      [108, 4], [100, 0], [96, 5]
    ]
  },
  // ── 15. Australia ───────────────────────────────────────────────────
  {
    name: 'Australia',
    biome: 'desert',
    points: [
      [114, -22], [115, -34], [120, -35], [130, -32], [135, -35], [138, -38],
      [148, -38], [151, -34], [153, -28], [150, -22], [145, -15], [142, -11],
      [136, -12], [130, -15], [125, -15], [118, -20], [114, -22]
    ]
  },
  // ── 16. New Zealand ─────────────────────────────────────────────────
  {
    name: 'New Zealand',
    biome: 'temperate',
    points: [
      [168, -46], [172, -43], [175, -41], [178, -38], [175, -36], [172, -40],
      [170, -44], [168, -46]
    ]
  },
  // ── 17. Antarctica (South Polar Ice Sheet) ──────────────────────────
  {
    name: 'Antarctica',
    biome: 'ice',
    points: [
      [-180, -78], [-150, -75], [-120, -73], [-90, -72], [-60, -65], [-55, -63],
      [-50, -70], [-20, -71], [10, -69], [40, -68], [70, -66], [100, -65],
      [130, -66], [160, -70], [180, -78]
    ]
  }
];

// Color palette mapping based on realistic terrestrial biomes
const BIOME_PALETTES = {
  natural: {
    ice:       { fill: '#e2e8f0', stroke: '#94a3b8' },
    desert:    { fill: '#9a7538', stroke: '#7c5e2d' },
    tropical:  { fill: '#1b4321', stroke: '#14351a' },
    temperate: { fill: '#2a4d2a', stroke: '#203d20' },
    shelf:     'rgba(14, 165, 233, 0.22)',
  },
  nightMatrix: {
    ice:       { fill: '#0f172a', stroke: '#334155' },
    desert:    { fill: '#1e293b', stroke: '#475569' },
    tropical:  { fill: '#0f172a', stroke: '#38bdf8' },
    temperate: { fill: '#1e293b', stroke: '#38bdf8' },
    shelf:     'rgba(56, 189, 248, 0.3)',
  }
};

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
    return { lon: -98.0, lat: 35.0 }; // Center on North American transect
  };

  const [center, setCenter] = useState(getInitialCenter);
  const [radius, setRadius] = useState(225);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [globeTheme, setGlobeTheme] = useState('natural'); // 'natural' | 'night'
  const [showPillars, setShowPillars] = useState(true);
  const [showClouds, setShowClouds] = useState(true);

  // Physics-based momentum drag refs
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const centerRef = useRef(center);
  const radiusRef = useRef(radius);
  const cloudOffsetRef = useRef(0);

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

  // Main Photorealistic 3D Globe Render Pipeline
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

    // ── 1. Clear & Deep Cosmos Starfield ───────────────────────────
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, width, height);

    // Deep space realistic twinkling stars with varied magnitudes
    ctx.save();
    for (let i = 0; i < 75; i++) {
      const sx = ((Math.sin(i * 127.1) * 43758.5453) % 1) * width;
      const sy = ((Math.cos(i * 311.7) * 43758.5453) % 1) * height;
      const size = (i % 3 === 0) ? 1.6 : (i % 2 === 0 ? 1.2 : 0.8);
      const alpha = 0.25 + ((Math.sin(i * 45) + 1) / 2) * 0.55;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(Math.abs(sx), Math.abs(sy), size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ── 2. Atmospheric Rayleigh Scattering (Outer Planetary Glow) ─
    const atmosphereRadius = r * 1.18;
    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.94, cx, cy, atmosphereRadius);
    if (globeTheme === 'natural') {
      glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.42)'); // Stratospheric Cyan
      glowGrad.addColorStop(0.35, 'rgba(2, 132, 199, 0.20)');
      glowGrad.addColorStop(0.7, 'rgba(3, 105, 161, 0.08)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      glowGrad.addColorStop(0, 'rgba(99, 102, 241, 0.35)'); // Deep Indigo Aurora
      glowGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.12)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, atmosphereRadius, 0, Math.PI * 2);
    ctx.fill();

    // ── 3. Ocean Body with Spherical Specular Depth ────────────────
    const oceanGrad = ctx.createRadialGradient(
      cx - r * 0.38, cy - r * 0.38, r * 0.08, // Sunlit ocean specular point
      cx, cy, r
    );
    if (globeTheme === 'natural') {
      oceanGrad.addColorStop(0, '#1d4ed8');   // Sunlit brilliant ocean
      oceanGrad.addColorStop(0.35, '#1e40af'); // Deep open water
      oceanGrad.addColorStop(0.75, '#0f172a'); // Abyssal bathymetry
      oceanGrad.addColorStop(1, '#020617');    // Night limb
    } else {
      oceanGrad.addColorStop(0, '#0f172a');
      oceanGrad.addColorStop(0.65, '#090d16');
      oceanGrad.addColorStop(1, '#020408');
    }
    ctx.fillStyle = oceanGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // ── 4. Clip to Globe Sphere for Land, Clouds & Graticules ──────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // ── 5. Latitude/Longitude Graticule Lines ──────────────────────
    ctx.strokeStyle = globeTheme === 'natural' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 0.75;

    // Parallels (-60° to +60°)
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 4) {
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
    // Meridians (-180° to +180°)
    for (let lon = -180; lon <= 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 4) {
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

    // Equator Line (Emphasized)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let eqStarted = false;
    for (let lon = -180; lon <= 180; lon += 3) {
      const p = project(lon, 0, cLon, cLat, r, cx, cy);
      if (p.visible) {
        if (!eqStarted) { ctx.moveTo(p.x, p.y); eqStarted = true; }
        else { ctx.lineTo(p.x, p.y); }
      } else {
        eqStarted = false;
      }
    }
    ctx.stroke();

    // ── 6. Continental Shelves & Coastal Glow ──────────────────────
    const palette = BIOME_PALETTES[globeTheme] || BIOME_PALETTES.natural;
    ctx.strokeStyle = palette.shelf;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    DETAILED_WORLD_LANDMASSES.forEach((land) => {
      ctx.beginPath();
      let started = false;
      land.points.forEach(([lon, lat]) => {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else { ctx.lineTo(p.x, p.y); }
        } else {
          started = false;
        }
      });
      ctx.stroke();
    });

    // ── 7. Detailed Continental Landmasses with Biome Shading ──────
    DETAILED_WORLD_LANDMASSES.forEach((land) => {
      const colors = palette[land.biome] || palette.temperate;
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      let started = false;
      land.points.forEach(([lon, lat]) => {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else { ctx.lineTo(p.x, p.y); }
        } else {
          started = false;
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });

    // ── 8. Night Lights on the Dark Side of Earth ──────────────────
    if (globeTheme === 'night') {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.75)'; // Warm sodium city lights
      DETAILED_WORLD_LANDMASSES.forEach((land, idx) => {
        land.points.forEach(([lon, lat], pIdx) => {
          if (pIdx % 2 === 0) {
            const p = project(lon + 1.2, lat - 0.8, cLon, cLat, r, cx, cy);
            if (p.visible && p.depth < 0.6) {
              const flicker = 0.5 + Math.sin(idx * 10 + pIdx) * 0.3;
              ctx.fillRect(p.x, p.y, 1.4 * flicker, 1.4 * flicker);
            }
          }
        });
      });
    }

    // ── 9. Semi-Transparent Dynamic Swirling Cloud Layer ───────────
    if (showClouds) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      const cloudShift = cloudOffsetRef.current;
      for (let c = -50; c <= 50; c += 25) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const lat = c + Math.sin((lon + cloudShift) * 0.06) * 6;
          const p = project(lon, lat, cLon, cLat, r * 1.015, cx, cy);
          if (p.visible) {
            if (!started) { ctx.moveTo(p.x, p.y); started = true; }
            else { ctx.lineTo(p.x, p.y); }
          } else {
            started = false;
          }
        }
        ctx.lineWidth = 12 * (r / 200);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 10. Specular Ocean Sun Glint Reflection ───────────────────
    const glintGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.35, cy - r * 0.35, r * 0.45);
    glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    glintGrad.addColorStop(0.4, 'rgba(186, 230, 253, 0.12)');
    glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glintGrad;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // ── 11. 3D Extruded Climate Trend Pillars & Data Beacons ──────
    grid.forEach((cell) => {
      const p = project(cell.lon, cell.lat, cLon, cLat, r, cx, cy);
      if (!p.visible) return;

      const slope = cell.slope ?? cell.temp_slope ?? 0;
      const isWarm = slope > 0;
      const baseRadius = Math.max(2, 4.5 * p.depth);

      // Color mapping
      const isHH = cell.lisa_cluster === 'HH';
      const beaconColor = isHH ? '#f59e0b' : (isWarm ? '#fbbf24' : '#38bdf8');
      const groundColor = isHH ? 'rgba(245, 158, 11, 0.75)' : (isWarm ? 'rgba(239, 68, 68, 0.65)' : 'rgba(6, 182, 212, 0.65)');

      // Ground footprint disc
      ctx.fillStyle = groundColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // 3D Extruded Pillar (Vertical Column along Earth Normal)
      if (showPillars && p.depth > 0.15) {
        const pillarHeight = Math.min(32, Math.max(8, Math.abs(slope) * 45)) * p.depth;
        
        // Pillar stem gradient
        const stemGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y - pillarHeight);
        stemGrad.addColorStop(0, groundColor);
        stemGrad.addColorStop(1, beaconColor);
        
        ctx.strokeStyle = stemGrad;
        ctx.lineWidth = Math.max(1.5, 2.5 * p.depth);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - pillarHeight);
        ctx.stroke();

        // Glowing Beacon Head on Top
        ctx.fillStyle = beaconColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y - pillarHeight, Math.max(2, 3 * p.depth), 0, Math.PI * 2);
        ctx.fill();

        // High-High Hotspot Animated Sonar Halo
        if (cell.lisa_cluster === 'HH' || cell.is_significant_fdr) {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, baseRadius * 2.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });

    // ── 12. Selected Cell Reticle Target ───────────────────────────
    if (selectedCell) {
      const sp = project(selectedCell.lon, selectedCell.lat, cLon, cLat, r, cx, cy);
      if (sp.visible) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 16, 0, Math.PI * 2);
        ctx.stroke();

        // Cardinal crosshair lines
        ctx.beginPath();
        ctx.moveTo(sp.x - 20, sp.y); ctx.lineTo(sp.x - 12, sp.y);
        ctx.moveTo(sp.x + 12, sp.y); ctx.lineTo(sp.x + 20, sp.y);
        ctx.moveTo(sp.x, sp.y - 20); ctx.lineTo(sp.x, sp.y - 12);
        ctx.moveTo(sp.x, sp.y + 12); ctx.lineTo(sp.x, sp.y + 20);
        ctx.stroke();
      }
    }

    ctx.restore(); // Restore from Globe Sphere Clip

    // ── 13. Outer Precision Glass Rim Highlight ────────────────────
    ctx.strokeStyle = globeTheme === 'natural' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(99, 102, 241, 0.55)';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }, [project, grid, selectedCell, globeTheme, showPillars, showClouds]);

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

  // Animation & Momentum Physics Loop
  useEffect(() => {
    let frameId;
    const loop = () => {
      cloudOffsetRef.current = (cloudOffsetRef.current + 0.15) % 360;

      if (!isDraggingRef.current) {
        if (autoRotate) {
          setCenter((prev) => ({
            ...prev,
            lon: (prev.lon + 0.35) % 360
          }));
        } else if (Math.abs(velocityRef.current.vx) > 0.01 || Math.abs(velocityRef.current.vy) > 0.01) {
          // Inertial momentum decay
          setCenter((prev) => ({
            lon: (prev.lon - velocityRef.current.vx) % 360,
            lat: Math.max(-85, Math.min(85, prev.lat + velocityRef.current.vy))
          }));
          velocityRef.current.vx *= 0.92;
          velocityRef.current.vy *= 0.92;
        }
      }
      renderGlobe();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [autoRotate, renderGlobe]);

  // Mouse / Touch Drag Handlers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { vx: 0, vy: 0 };
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

      const sens = 0.42;
      velocityRef.current = { vx: dx * sens, vy: dy * sens };

      setCenter((prev) => ({
        lon: (prev.lon - dx * sens) % 360,
        lat: Math.max(-85, Math.min(85, prev.lat + dy * sens))
      }));
    } else {
      // Raycast hover check against 3D data grid points
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
          if (dist < 12) {
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
    setRadius((prev) => Math.max(130, Math.min(520, prev + delta)));
  };

  const handleClick = () => {
    if (hoveredCell) {
      playTactileClick(850);
      onSelectCell(hoveredCell.lat, hoveredCell.lon);
    }
  };

  const handleFocusRegion = () => {
    playTactileClick(700);
    setCenter(getInitialCenter());
    setRadius(230);
  };

  return (
    <div className="relative w-full h-full bg-[#05070b] select-none overflow-hidden font-mono">
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

      {/* Floating Planetary Cockpit HUD Controls */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[280px]">
        <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-lg p-3 text-xs text-slate-200 shadow-2xl">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold tracking-wide uppercase text-[10px] text-cyan-400 font-sans">
                Photorealistic 3D Globe
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
              Orthographic
            </span>
          </div>

          <div className="text-[10px] text-slate-400 space-y-0.5 font-mono">
            <div className="flex justify-between">
              <span>Sub-satellite Point:</span>
              <span className="text-white font-bold">{Math.abs(Math.round(center.lat))}°{center.lat >= 0 ? 'N' : 'S'}, {Math.abs(Math.round(center.lon))}°{center.lon >= 0 ? 'E' : 'W'}</span>
            </div>
            <div className="flex justify-between">
              <span>NASA Data Pillars:</span>
              <span className="text-cyan-400 font-bold">{grid.length} cells</span>
            </div>
            <div className="text-[9px] text-slate-500 pt-1 border-t border-slate-800 flex justify-between">
              <span>Drag to spin • Scroll to zoom</span>
              <span>Inertia Active</span>
            </div>
          </div>
        </div>

        {/* Orbit, Focus & Style Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              playTactileClick(600);
              setAutoRotate(!autoRotate);
            }}
            className={`px-2.5 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              autoRotate
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Toggle smooth planetary orbit"
          >
            {autoRotate ? '⏸ Pause Orbit' : '▶ Auto Orbit'}
          </button>

          <button
            type="button"
            onClick={handleFocusRegion}
            className="px-2 py-1 rounded text-[11px] bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all font-mono cursor-pointer"
            title="Focus on active analysis bounding box"
          >
            🎯 Focus Area
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              setGlobeTheme(globeTheme === 'natural' ? 'night' : 'natural');
            }}
            className="px-2 py-1 rounded text-[11px] bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all font-mono cursor-pointer"
            title="Switch between Natural NASA Biomes and Night Lights Matrix"
          >
            {globeTheme === 'natural' ? '☀️ Natural' : '🌌 Night'}
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              setShowPillars(!showPillars);
            }}
            className={`px-2 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all cursor-pointer ${
              showPillars
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle 3D Extruded Climate Trend Pillars"
          >
            {showPillars ? '📊 3D Pillars' : '⚪ Flat Grid'}
          </button>

          <button
            type="button"
            onClick={() => {
              playTactileClick(500);
              setShowClouds(!showClouds);
            }}
            className={`px-2 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all cursor-pointer ${
              showClouds
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                : 'bg-slate-900/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle Atmospheric Swirling Clouds"
          >
            ☁️ Clouds
          </button>
        </div>
      </div>

      {/* Return to 2D GIS Map Action */}
      <div className="absolute top-3 right-3 z-20">
        <button
          type="button"
          onClick={() => {
            playTactileClick(700);
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-xl transition-all cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          <span>Return to 2D GIS Map</span>
        </button>
      </div>

      {/* 3D Data Legend Overlay Docked at Bottom-Right */}
      <div className="absolute bottom-3 right-3 z-20 bg-slate-950/90 border border-slate-800 rounded p-2 text-[10px] text-slate-300 backdrop-blur-md font-mono flex items-center gap-3 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />
          <span>Warming Pillar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
          <span>LISA Hotspot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm" />
          <span>Cooling/Wet</span>
        </div>
      </div>

      {/* Hovered Cell Tooltip on 3D Globe */}
      {hoveredCell && (
        <div
          className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 rounded-lg bg-slate-950/95 border border-cyan-500/40 text-slate-200 text-xs shadow-2xl backdrop-blur-md"
          style={{ left: hoveredCell.screenX, top: hoveredCell.screenY }}
        >
          <div className="font-bold text-cyan-400 font-mono text-[10px] flex items-center justify-between gap-3">
            <span>{Math.abs(hoveredCell.lat).toFixed(1)}°{hoveredCell.lat >= 0 ? 'N' : 'S'}, {Math.abs(hoveredCell.lon).toFixed(1)}°{hoveredCell.lon >= 0 ? 'E' : 'W'}</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300">NASA Cell</span>
          </div>
          <div className="text-[11px] text-slate-200 font-mono pt-1">
            Trend: <strong className={hoveredCell.slope > 0 ? 'text-[#f59e0b]' : 'text-cyan-400'}>
              {hoveredCell.slope > 0 ? '+' : ''}{hoveredCell.slope?.toFixed(4)} {hoveredCell.slope_units || '°C/dec'}
            </strong>
          </div>
          <div className="text-[9px] text-slate-400 font-mono pt-0.5">
            {hoveredCell.lisa_cluster ? `Regime: ${hoveredCell.lisa_cluster}` : 'Click to inspect in Evidence Panel'}
          </div>
        </div>
      )}
    </div>
  );
}
