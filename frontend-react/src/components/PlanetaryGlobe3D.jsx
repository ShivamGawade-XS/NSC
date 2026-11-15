import { useRef, useEffect, useState, useCallback } from 'react';
import { playTactileClick } from '../utils/audio';

// ─── Major City Lights Database [lon, lat, population-weight 1-5] ──────────
const CITY_LIGHTS = [
  // North America
  [-74.0,40.7,5],[-87.6,41.9,4],[-118.2,34.0,5],[-95.4,29.8,4],[-122.4,37.8,4],
  [-73.9,45.5,3],[-79.4,43.6,4],[-123.1,49.3,3],[-99.1,19.4,5],[-80.2,26.0,3],
  [-77.0,38.9,4],[-84.4,33.7,4],[-71.1,42.4,3],[-96.8,32.8,4],[-112.1,33.4,3],
  [-83.0,42.3,3],[-93.3,45.0,3],[-90.2,38.6,3],[-122.3,47.6,3],[-104.9,39.7,3],
  // Europe
  [-0.1,51.5,5],[2.3,48.9,5],[13.4,52.5,4],[12.5,41.9,3],[-3.7,40.4,4],
  [23.7,38.0,3],[14.4,50.1,3],[21.0,52.2,3],[18.1,59.3,3],[24.9,60.2,2],
  [4.9,52.4,3],[4.4,50.8,2],[16.4,48.2,3],[19.0,47.5,3],[12.6,55.7,2],
  [10.8,59.9,2],[30.3,59.9,4],[37.6,55.8,4],
  // Asia
  [139.7,35.7,5],[121.5,31.2,5],[116.4,39.9,5],[126.9,37.6,5],[114.2,22.3,4],
  [72.9,19.1,5],[77.2,28.6,4],[88.4,22.6,4],[103.8,1.3,4],[100.5,13.8,4],
  [106.8,-6.2,4],[106.7,10.8,3],[120.9,14.6,4],[44.4,33.3,3],[51.4,35.7,4],
  // Africa
  [31.2,30.0,4],[36.8,-1.3,2],[28.0,-26.2,3],[3.4,6.5,4],[32.6,0.3,2],
  [-7.6,33.6,2],[2.1,13.5,2],[38.7,9.0,2],[18.4,-34.0,2],
  // South America
  [-43.2,-22.9,5],[-46.6,-23.5,5],[-58.4,-34.6,4],[-70.6,-33.4,3],
  [-77.0,-12.0,3],[-66.9,10.5,3],[-74.1,4.6,3],[-79.9,-2.2,2],
  // Oceania
  [151.2,-33.9,4],[144.9,-37.8,3],[174.8,-41.3,2],[172.6,-43.5,2],
];

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
  const [showBBox, setShowBBox] = useState(true);

  // Physics-based momentum drag refs
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const centerRef = useRef(center);
  const radiusRef = useRef(radius);
  const cloudOffsetRef = useRef(0);
  const tickRef = useRef(0);

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

    const tick = tickRef.current;

    // Multi-layer realistic starfield with twinkling and color temperature
    ctx.save();
    for (let i = 0; i < 120; i++) {
      const sx = ((Math.sin(i * 127.1) * 43758.5453) % 1) * width;
      const sy = ((Math.cos(i * 311.7) * 43758.5453) % 1) * height;
      const mag = (i % 5 === 0) ? 2.0 : (i % 3 === 0 ? 1.4 : (i % 2 === 0 ? 1.0 : 0.6));
      // Subtle twinkle animation
      const twinkle = 0.3 + ((Math.sin(tick * 0.02 + i * 1.7) + 1) / 2) * 0.6;
      // Color temperature variety: blue-white, yellow, warm white
      const temp = i % 7;
      const starColor = temp < 2 ? `rgba(180, 210, 255, ${twinkle.toFixed(2)})` :
                        temp < 4 ? `rgba(255, 255, 240, ${twinkle.toFixed(2)})` :
                                   `rgba(255, 220, 180, ${(twinkle * 0.7).toFixed(2)})`;
      ctx.fillStyle = starColor;
      ctx.beginPath();
      ctx.arc(Math.abs(sx), Math.abs(sy), mag, 0, Math.PI * 2);
      ctx.fill();
      // Cross diffraction spikes on brightest stars
      if (mag > 1.8) {
        ctx.strokeStyle = `rgba(200, 220, 255, ${(twinkle * 0.3).toFixed(2)})`;
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.abs(sx) - 4, Math.abs(sy));
        ctx.lineTo(Math.abs(sx) + 4, Math.abs(sy));
        ctx.moveTo(Math.abs(sx), Math.abs(sy) - 4);
        ctx.lineTo(Math.abs(sx), Math.abs(sy) + 4);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── 2. Multi-Layer Atmospheric Rayleigh Scattering ──────────────
    // Outer diffuse glow
    const outerAtmo = r * 1.22;
    const outerGrad = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, outerAtmo);
    if (globeTheme === 'natural') {
      outerGrad.addColorStop(0, 'rgba(56, 189, 248, 0.50)');
      outerGrad.addColorStop(0.25, 'rgba(14, 165, 233, 0.28)');
      outerGrad.addColorStop(0.55, 'rgba(2, 132, 199, 0.12)');
      outerGrad.addColorStop(0.85, 'rgba(3, 105, 161, 0.04)');
      outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      outerGrad.addColorStop(0, 'rgba(99, 102, 241, 0.40)');
      outerGrad.addColorStop(0.3, 'rgba(129, 140, 248, 0.18)');
      outerGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.08)');
      outerGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, outerAtmo, 0, Math.PI * 2);
    ctx.fill();

    // Inner limb brightening (Fresnel-like edge glow inside the sphere)
    const limbGrad = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r);
    limbGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    limbGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    limbGrad.addColorStop(1, globeTheme === 'natural' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(99, 102, 241, 0.15)');

    // ── 3. Ocean Body with Subsurface Scattering & Bathymetry ──────
    const oceanGrad = ctx.createRadialGradient(
      cx - r * 0.38, cy - r * 0.38, r * 0.08,
      cx, cy, r
    );
    if (globeTheme === 'natural') {
      oceanGrad.addColorStop(0, '#2563eb');   // Sunlit brilliant ocean
      oceanGrad.addColorStop(0.2, '#1d4ed8');  // Open water
      oceanGrad.addColorStop(0.5, '#1e40af');  // Deep blue
      oceanGrad.addColorStop(0.8, '#0f172a');  // Abyssal
      oceanGrad.addColorStop(1, '#020617');     // Night limb
    } else {
      oceanGrad.addColorStop(0, '#0f172a');
      oceanGrad.addColorStop(0.65, '#090d16');
      oceanGrad.addColorStop(1, '#020408');
    }
    ctx.fillStyle = oceanGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Apply inner limb glow on top of ocean
    ctx.fillStyle = limbGrad;
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

    // ── 7. Detailed Continental Landmasses with Terrain Relief ──────
    DETAILED_WORLD_LANDMASSES.forEach((land) => {
      const colors = palette[land.biome] || palette.temperate;
      
      // Compute land centroid for terrain relief gradient
      let sumX = 0, sumY = 0, visCount = 0;
      const projPts = land.points.map(([lon, lat]) => {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) { sumX += p.x; sumY += p.y; visCount++; }
        return p;
      });
      
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      let started = false;
      projPts.forEach((p) => {
        if (p.visible) {
          if (!started) { ctx.moveTo(p.x, p.y); started = true; }
          else { ctx.lineTo(p.x, p.y); }
        } else {
          started = false;
        }
      });
      ctx.closePath();

      // Terrain relief: subtle gradient from sunlit to shadow side
      if (visCount > 2 && globeTheme === 'natural') {
        const centX = sumX / visCount;
        const centY = sumY / visCount;
        const reliefGrad = ctx.createRadialGradient(
          centX - 15, centY - 15, 2,
          centX, centY, r * 0.35
        );
        reliefGrad.addColorStop(0, colors.fill);
        reliefGrad.addColorStop(0.6, colors.fill);
        reliefGrad.addColorStop(1, colors.stroke);
        ctx.fillStyle = reliefGrad;
      } else {
        ctx.fillStyle = colors.fill;
      }
      ctx.strokeStyle = colors.stroke;
      ctx.fill();
      ctx.stroke();
    });

    // ── 8. City Lights on Dark Hemisphere (Real Metro Database) ────
    if (globeTheme === 'night') {
      CITY_LIGHTS.forEach(([lon, lat, weight]) => {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (!p.visible) return;
        // Brighter on limb (darker side), dimmer toward center (sunlit)
        const limbFactor = Math.max(0, 1 - p.depth * 1.2);
        if (limbFactor < 0.15) return;
        const glow = limbFactor * (0.5 + weight * 0.1);
        const sz = Math.max(1, weight * 0.7 * (0.5 + p.depth));
        // Warm sodium core
        ctx.fillStyle = `rgba(255, 200, 80, ${(glow * 0.9).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fill();
        // Metro light spill halo for major cities
        if (weight >= 4) {
          ctx.fillStyle = `rgba(255, 180, 50, ${(glow * 0.25).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, sz * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // ── 9. Multi-Band Atmospheric Cloud System ─────────────────────
    if (showClouds) {
      ctx.save();
      const cloudShift = cloudOffsetRef.current;
      // ITCZ tropical band, mid-latitude cyclone tracks, polar vortex wisps
      const cloudBands = [
        { base: -55, amp: 4, width: 6, opacity: 0.06 },   // Southern polar
        { base: -35, amp: 8, width: 14, opacity: 0.10 },   // Southern mid-lat
        { base: -5,  amp: 5, width: 18, opacity: 0.14 },   // ITCZ equatorial
        { base: 15,  amp: 6, width: 10, opacity: 0.08 },   // Northern subtropical
        { base: 42,  amp: 10, width: 16, opacity: 0.12 },  // Northern storm track
        { base: 65,  amp: 3, width: 8, opacity: 0.07 },    // Arctic front
      ];
      cloudBands.forEach(({ base, amp, width, opacity }) => {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 4) {
          const lat = base + Math.sin((lon + cloudShift) * 0.05) * amp
                     + Math.cos((lon + cloudShift * 0.7) * 0.08) * (amp * 0.4);
          const p = project(lon, lat, cLon, cLat, r * 1.012, cx, cy);
          if (p.visible) {
            if (!started) { ctx.moveTo(p.x, p.y); started = true; }
            else { ctx.lineTo(p.x, p.y); }
          } else {
            started = false;
          }
        }
        ctx.lineWidth = width * (r / 225);
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.stroke();
      });
      ctx.restore();
    }

    // ── 10. Multi-Layer Specular Ocean Sun Glint ─────────────────
    // Primary specular highlight
    const glintGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 0, cx - r * 0.35, cy - r * 0.35, r * 0.4);
    glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    glintGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.22)');
    glintGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.08)');
    glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glintGrad;
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Secondary diffuse highlight (wider, softer)
    const diffGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx - r * 0.1, cy - r * 0.1, r * 0.7);
    diffGrad.addColorStop(0, 'rgba(186, 230, 253, 0.10)');
    diffGrad.addColorStop(0.5, 'rgba(147, 197, 253, 0.04)');
    diffGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = diffGrad;
    ctx.beginPath();
    ctx.arc(cx - r * 0.1, cy - r * 0.1, r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // ── 11. 3D Extruded Climate Trend Pillars & Data Beacons ──────
    // Sort by depth for proper painter's order (back-to-front)
    const sortedGrid = [...grid].map(cell => ({
      ...cell,
      _p: project(cell.lon, cell.lat, cLon, cLat, r, cx, cy)
    })).filter(c => c._p.visible).sort((a, b) => a._p.depth - b._p.depth);

    sortedGrid.forEach((cell) => {
      const p = cell._p;
      const slope = cell.slope ?? cell.temp_slope ?? 0;
      const isWarm = slope > 0;
      const baseRadius = Math.max(2, 4.5 * p.depth);

      // Color mapping
      const isHH = cell.lisa_cluster === 'HH';
      const beaconColor = isHH ? '#f59e0b' : (isWarm ? '#fbbf24' : '#38bdf8');
      const groundColor = isHH ? 'rgba(245, 158, 11, 0.75)' : (isWarm ? 'rgba(239, 68, 68, 0.65)' : 'rgba(6, 182, 212, 0.65)');

      // Ground footprint disc with shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x + 1, p.y + 1, baseRadius * 1.3, baseRadius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = groundColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // 3D Extruded Pillar (Vertical Column along Earth Normal)
      if (showPillars && p.depth > 0.15) {
        const pillarHeight = Math.min(38, Math.max(8, Math.abs(slope) * 50)) * p.depth;
        
        // Pillar stem gradient
        const stemGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y - pillarHeight);
        stemGrad.addColorStop(0, groundColor);
        stemGrad.addColorStop(1, beaconColor);
        
        // Pillar shadow
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = Math.max(2.5, 3.5 * p.depth);
        ctx.beginPath();
        ctx.moveTo(p.x + 1, p.y + 1);
        ctx.lineTo(p.x + 1, p.y - pillarHeight + 1);
        ctx.stroke();
        
        // Pillar body
        ctx.strokeStyle = stemGrad;
        ctx.lineWidth = Math.max(1.5, 2.5 * p.depth);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - pillarHeight);
        ctx.stroke();

        // Glowing Beacon Head on Top with bloom
        const beaconRadius = Math.max(2, 3 * p.depth);
        // Bloom halo
        const bloomGrad = ctx.createRadialGradient(p.x, p.y - pillarHeight, 0, p.x, p.y - pillarHeight, beaconRadius * 3);
        bloomGrad.addColorStop(0, isWarm ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.4)');
        bloomGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y - pillarHeight, beaconRadius * 3, 0, Math.PI * 2);
        ctx.fill();
        // Core beacon
        ctx.fillStyle = beaconColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y - pillarHeight, beaconRadius, 0, Math.PI * 2);
        ctx.fill();

        // Animated Pulsing Sonar Halo for Hotspots
        if (isHH || cell.is_significant_fdr) {
          const pulse = (Math.sin(tick * 0.04) + 1) / 2; // 0-1 oscillation
          const haloR = baseRadius * (2.0 + pulse * 1.2);
          const haloAlpha = 0.55 - pulse * 0.35;
          ctx.strokeStyle = `rgba(245, 158, 11, ${haloAlpha.toFixed(2)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
          ctx.stroke();
          // Second ripple ring
          const haloR2 = baseRadius * (3.0 + pulse * 1.5);
          ctx.strokeStyle = `rgba(245, 158, 11, ${(haloAlpha * 0.4).toFixed(2)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloR2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    });

    // ── 12. Analysis Bounding Box Rectangle on Globe ─────────────
    if (showBBox && bbox && bbox.length === 4) {
      const [lonMin, latMin, lonMax, latMax] = bbox;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      // Draw 4 edges of the bbox
      const drawEdge = (lonA, latA, lonB, latB, steps = 20) => {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const lon = lonA + (lonB - lonA) * t;
          const lat = latA + (latB - latA) * t;
          const p = project(lon, lat, cLon, cLat, r, cx, cy);
          if (p.visible) {
            if (!started) { ctx.moveTo(p.x, p.y); started = true; }
            else { ctx.lineTo(p.x, p.y); }
          } else { started = false; }
        }
        ctx.stroke();
      };
      drawEdge(lonMin, latMin, lonMax, latMin); // Bottom
      drawEdge(lonMax, latMin, lonMax, latMax); // Right
      drawEdge(lonMax, latMax, lonMin, latMax); // Top
      drawEdge(lonMin, latMax, lonMin, latMin); // Left
      ctx.setLineDash([]);

      // Semi-transparent fill for the bbox area
      ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.beginPath();
      let bboxStarted = false;
      const bboxPts = [];
      for (let lon = lonMin; lon <= lonMax; lon += 1) bboxPts.push([lon, latMin]);
      for (let lat = latMin; lat <= latMax; lat += 1) bboxPts.push([lonMax, lat]);
      for (let lon = lonMax; lon >= lonMin; lon -= 1) bboxPts.push([lon, latMax]);
      for (let lat = latMax; lat >= latMin; lat -= 1) bboxPts.push([lonMin, lat]);
      bboxPts.forEach(([lon, lat]) => {
        const p = project(lon, lat, cLon, cLat, r, cx, cy);
        if (p.visible) {
          if (!bboxStarted) { ctx.moveTo(p.x, p.y); bboxStarted = true; }
          else { ctx.lineTo(p.x, p.y); }
        }
      });
      ctx.closePath();
      ctx.fill();
    }

    // ── 13. Selected Cell Reticle Target ───────────────────────────
    if (selectedCell) {
      const sp = project(selectedCell.lon, selectedCell.lat, cLon, cLat, r, cx, cy);
      if (sp.visible) {
        // Outer rotating reticle
        const rotAngle = tick * 0.015;
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(rotAngle);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        // Corner brackets instead of full circle
        const sz = 14;
        const brk = 5;
        [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.moveTo(dx * sz, dy * (sz - brk));
          ctx.lineTo(dx * sz, dy * sz);
          ctx.lineTo(dx * (sz - brk), dy * sz);
          ctx.stroke();
        });
        ctx.restore();

        // Inner steady ring
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2, 0, Math.PI * 2);
        ctx.fill();

        // Outer pulse ring
        const pulseR = 18 + Math.sin(tick * 0.05) * 4;
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.3 - Math.sin(tick * 0.05) * 0.15).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore(); // Restore from Globe Sphere Clip

    // ── 14. Outer Precision Glass Rim with Double Stroke ───────────
    // Inner glow ring
    ctx.strokeStyle = globeTheme === 'natural' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(99, 102, 241, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
    ctx.stroke();
    // Sharp outer rim
    ctx.strokeStyle = globeTheme === 'natural' ? 'rgba(56, 189, 248, 0.65)' : 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // ── 15. Sun Position Indicator (Upper-Left Radiance) ──────────
    if (globeTheme === 'natural') {
      const sunX = cx - r * 1.35;
      const sunY = cy - r * 1.35;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 18);
      sunGrad.addColorStop(0, 'rgba(253, 224, 71, 0.7)');
      sunGrad.addColorStop(0.4, 'rgba(250, 204, 21, 0.2)');
      sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 18, 0, Math.PI * 2);
      ctx.fill();
      // Sun core
      ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [project, grid, selectedCell, globeTheme, showPillars, showClouds, showBBox, bbox]);

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
      tickRef.current += 1;

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
            <div className="flex justify-between">
              <span>Zoom Level:</span>
              <span className="text-white font-bold">{((radius / 225) * 100).toFixed(0)}%</span>
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

          {bbox && bbox.length === 4 && (
            <button
              type="button"
              onClick={() => {
                playTactileClick(500);
                setShowBBox(!showBBox);
              }}
              className={`px-2 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all cursor-pointer ${
                showBBox
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                  : 'bg-slate-900/80 text-slate-400 border-slate-700'
              }`}
              title="Toggle Analysis Bounding Box Overlay"
            >
              📐 BBox
            </button>
          )}
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
