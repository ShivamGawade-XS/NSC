import { useRef, useEffect, useState, useCallback } from 'react';
import { playTactileClick } from '../utils/audio';

// ─── 70+ Major City Lights [lon, lat, weight 1-5] ──────────────────────────
const CITY_LIGHTS = [
  [-74.0,40.7,5],[-87.6,41.9,4],[-118.2,34.0,5],[-95.4,29.8,4],[-122.4,37.8,4],
  [-73.9,45.5,3],[-79.4,43.6,4],[-123.1,49.3,3],[-99.1,19.4,5],[-80.2,26.0,3],
  [-77.0,38.9,4],[-84.4,33.7,4],[-71.1,42.4,3],[-96.8,32.8,4],[-112.1,33.4,3],
  [-83.0,42.3,3],[-93.3,45.0,3],[-90.2,38.6,3],[-122.3,47.6,3],[-104.9,39.7,3],
  [-0.1,51.5,5],[2.3,48.9,5],[13.4,52.5,4],[12.5,41.9,3],[-3.7,40.4,4],
  [23.7,38.0,3],[14.4,50.1,3],[21.0,52.2,3],[18.1,59.3,3],[24.9,60.2,2],
  [4.9,52.4,3],[4.4,50.8,2],[16.4,48.2,3],[19.0,47.5,3],[12.6,55.7,2],
  [10.8,59.9,2],[30.3,59.9,4],[37.6,55.8,4],
  [139.7,35.7,5],[121.5,31.2,5],[116.4,39.9,5],[126.9,37.6,5],[114.2,22.3,4],
  [72.9,19.1,5],[77.2,28.6,4],[88.4,22.6,4],[103.8,1.3,4],[100.5,13.8,4],
  [106.8,-6.2,4],[106.7,10.8,3],[120.9,14.6,4],[44.4,33.3,3],[51.4,35.7,4],
  [31.2,30.0,4],[36.8,-1.3,2],[28.0,-26.2,3],[3.4,6.5,4],[32.6,0.3,2],
  [-7.6,33.6,2],[2.1,13.5,2],[38.7,9.0,2],[18.4,-34.0,2],
  [-43.2,-22.9,5],[-46.6,-23.5,5],[-58.4,-34.6,4],[-70.6,-33.4,3],
  [-77.0,-12.0,3],[-66.9,10.5,3],[-74.1,4.6,3],[-79.9,-2.2,2],
  [151.2,-33.9,4],[144.9,-37.8,3],[174.8,-41.3,2],[172.6,-43.5,2],
];

// ─── 17 Continental Landmass Vectors [lon, lat] ────────────────────────────
const LANDS = [
  { n:'NA', b:'temperate', p:[[-168,66],[-162,60],[-168,53],[-160,55],[-152,58],[-140,60],[-135,54],[-128,51],[-124,48],[-124,38],[-120,34],[-117,32],[-115,30],[-110,23],[-105,20],[-97,18],[-92,16],[-88,16],[-83,10],[-80,9],[-77,8],[-82,14],[-88,21],[-90,21],[-97,26],[-97,28],[-94,29],[-90,30],[-85,30],[-82,28],[-80,25],[-81,31],[-76,35],[-74,40],[-71,42],[-64,45],[-60,46],[-65,49],[-60,52],[-62,56],[-66,60],[-76,62],[-80,58],[-82,52],[-90,50],[-95,60],[-95,69],[-105,69],[-115,68],[-130,70],[-140,70],[-155,71],[-165,71],[-168,66]] },
  { n:'GL', b:'ice', p:[[-44,60],[-50,64],[-53,70],[-58,76],[-52,82],[-30,83],[-18,80],[-22,70],[-35,65],[-44,60]] },
  { n:'CB', b:'tropical', p:[[-84,22],[-80,23],[-75,20],[-77,20],[-82,21],[-84,22]] },
  { n:'SA', b:'tropical', p:[[-77,8],[-75,11],[-70,12],[-62,10],[-58,6],[-50,0],[-44,-2],[-36,-5],[-35,-8],[-37,-12],[-39,-18],[-42,-23],[-48,-28],[-53,-33],[-57,-38],[-65,-43],[-66,-48],[-65,-55],[-70,-55],[-74,-52],[-74,-45],[-72,-38],[-71,-30],[-70,-20],[-76,-14],[-81,-5],[-80,2],[-77,8]] },
  { n:'EU', b:'temperate', p:[[-9,36],[-9,43],[-1,44],[-2,47],[-4,48],[1,51],[5,53],[8,55],[12,55],[14,54],[18,54],[22,57],[28,60],[32,60],[30,46],[24,45],[22,40],[24,38],[22,36],[16,38],[15,41],[13,45],[10,44],[3,42],[-1,37],[-5,36],[-9,36]] },
  { n:'SC', b:'temperate', p:[[5,58],[10,58],[12,56],[16,56],[19,60],[24,65],[30,70],[25,71],[18,69],[12,65],[5,62],[5,58]] },
  { n:'BI', b:'temperate', p:[[-5,50],[1,51],[0,53],[-2,57],[-5,58],[-6,55],[-3,53],[-5,50]] },
  { n:'AF', b:'desert', p:[[-6,36],[10,37],[12,33],[15,32],[24,32],[30,31],[33,30],[36,22],[42,13],[51,11],[46,5],[40,-4],[39,-10],[35,-20],[33,-27],[28,-32],[20,-34],[18,-34],[15,-28],[12,-18],[11,-8],[9,2],[2,6],[-4,5],[-12,7],[-17,14],[-17,21],[-13,28],[-6,36]] },
  { n:'MG', b:'tropical', p:[[44,-12],[50,-14],[48,-25],[44,-25],[44,-18],[44,-12]] },
  { n:'AR', b:'desert', p:[[35,30],[40,30],[48,30],[50,26],[55,25],[60,22],[58,18],[53,16],[45,13],[43,15],[38,20],[35,28],[35,30]] },
  { n:'IN', b:'tropical', p:[[68,24],[72,21],[74,15],[77,8],[80,10],[80,16],[85,20],[89,22],[88,26],[80,28],[72,28],[68,24]] },
  { n:'EA', b:'temperate', p:[[30,46],[40,44],[50,40],[60,38],[65,35],[75,35],[85,36],[95,28],[105,20],[108,14],[105,10],[102,5],[104,1],[108,10],[115,22],[120,25],[122,32],[121,38],[126,40],[130,42],[135,48],[142,50],[155,58],[165,62],[178,66],[180,68],[170,71],[145,73],[115,76],[85,74],[60,70],[45,68],[32,60],[30,46]] },
  { n:'JP', b:'temperate', p:[[130,32],[133,34],[138,36],[141,41],[143,44],[141,45],[140,41],[136,36],[132,34],[130,32]] },
  { n:'ID', b:'tropical', p:[[96,5],[104,-4],[114,-8],[125,-9],[130,-5],[122,0],[115,4],[108,4],[100,0],[96,5]] },
  { n:'AU', b:'desert', p:[[114,-22],[115,-34],[120,-35],[130,-32],[135,-35],[138,-38],[148,-38],[151,-34],[153,-28],[150,-22],[145,-15],[142,-11],[136,-12],[130,-15],[125,-15],[118,-20],[114,-22]] },
  { n:'NZ', b:'temperate', p:[[168,-46],[172,-43],[175,-41],[178,-38],[175,-36],[172,-40],[170,-44],[168,-46]] },
  { n:'AN', b:'ice', p:[[-180,-78],[-150,-75],[-120,-73],[-90,-72],[-60,-65],[-55,-63],[-50,-70],[-20,-71],[10,-69],[40,-68],[70,-66],[100,-65],[130,-66],[160,-70],[180,-78]] },
];

// Biome fill+stroke palette
const BIOME = {
  natural: { ice:['#dde4ed','#a0aec0'], desert:['#8b6914','#6b4f10'], tropical:['#14532d','#0f3d1f'], temperate:['#1a3a1a','#143014'], shelf:'rgba(14,165,233,0.18)' },
  night:   { ice:['#0f172a','#334155'], desert:['#1e293b','#475569'], tropical:['#0f172a','#1e3a5f'], temperate:['#1e293b','#1e3a5f'], shelf:'rgba(56,189,248,0.25)' },
};

// ─── Pre-computed Trig: deg→rad constant ────────────────────────────────────
const D2R = Math.PI / 180;

// ─── Inline Orthographic Projection (no object alloc) ───────────────────────
function proj(lonDeg, latDeg, cLonRad, sinP0, cosP0, r, cx, cy) {
  const lambda = lonDeg * D2R;
  const phi = latDeg * D2R;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const dLam = lambda - cLonRad;
  const cosDLam = Math.cos(dLam);
  const cosC = sinP0 * sinPhi + cosP0 * cosPhi * cosDLam;
  if (cosC <= 0) return null; // back-face
  return [
    cx + r * cosPhi * Math.sin(dLam),
    cy - r * (cosP0 * sinPhi - sinP0 * cosPhi * cosDLam),
    cosC
  ];
}

export default function PlanetaryGlobe3D({
  grid = [],
  bbox = null,
  selectedCell = null,
  onSelectCell = () => {},
  onClose = () => {}
}) {
  const canvasRef = useRef(null);
  // Offscreen buffer for static earth (ocean + continents + graticules)
  const earthBufferRef = useRef(null);
  const earthKeyRef = useRef('');

  const getInitialCenter = () => {
    if (bbox && bbox.length === 4) return { lon: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 };
    return { lon: -98.0, lat: 35.0 };
  };

  const [center, setCenter] = useState(getInitialCenter);
  const [radius, setRadius] = useState(225);
  const [autoRotate, setAutoRotate] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [globeTheme, setGlobeTheme] = useState('natural');
  const [showPillars, setShowPillars] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  const [showBBox, setShowBBox] = useState(true);

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const centerRef = useRef(center);
  const radiusRef = useRef(radius);
  const cloudOffsetRef = useRef(0);
  const tickRef = useRef(0);

  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { radiusRef.current = radius; }, [radius]);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC EARTH RENDERER — cached to offscreen canvas, redrawn only when
  // center / radius / theme changes (NOT every animation frame)
  // ═══════════════════════════════════════════════════════════════════════════
  const renderEarthBuffer = useCallback((w, h, cLon, cLat, r, theme) => {
    const key = `${w}|${h}|${cLon.toFixed(2)}|${cLat.toFixed(2)}|${r}|${theme}`;
    if (earthKeyRef.current === key && earthBufferRef.current) return earthBufferRef.current;

    let offCanvas = earthBufferRef.current;
    if (!offCanvas || offCanvas.width !== w || offCanvas.height !== h) {
      offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
    }
    const ctx = offCanvas.getContext('2d');
    const cx = w / 2, cy = h / 2;
    const cLonRad = cLon * D2R;
    const sinP0 = Math.sin(cLat * D2R);
    const cosP0 = Math.cos(cLat * D2R);
    const pal = BIOME[theme] || BIOME.natural;
    const isNight = theme === 'night';

    ctx.clearRect(0, 0, w, h);

    // Ocean with realistic depth gradient
    const oceanGrad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.06, cx, cy, r);
    if (!isNight) {
      oceanGrad.addColorStop(0, '#2563eb');
      oceanGrad.addColorStop(0.18, '#1d4ed8');
      oceanGrad.addColorStop(0.45, '#1e40af');
      oceanGrad.addColorStop(0.75, '#172554');
      oceanGrad.addColorStop(1, '#020617');
    } else {
      oceanGrad.addColorStop(0, '#0f172a');
      oceanGrad.addColorStop(0.6, '#090d16');
      oceanGrad.addColorStop(1, '#020408');
    }
    ctx.fillStyle = oceanGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Fresnel limb glow
    const limbGrad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    limbGrad.addColorStop(0, 'rgba(0,0,0,0)');
    limbGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    limbGrad.addColorStop(1, isNight ? 'rgba(99,102,241,0.15)' : 'rgba(56,189,248,0.20)');
    ctx.fillStyle = limbGrad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Clip to sphere
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();

    // Graticule lines (wider spacing for perf: every 30° parallel, 30° meridian)
    ctx.strokeStyle = isNight ? 'rgba(56,189,248,0.10)' : 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 0.6;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let on = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const p = proj(lon, lat, cLonRad, sinP0, cosP0, r, cx, cy);
        if (p) { if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); }
        else on = false;
      }
      ctx.stroke();
    }
    for (let lon = -180; lon <= 150; lon += 30) {
      ctx.beginPath();
      let on = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const p = proj(lon, lat, cLonRad, sinP0, cosP0, r, cx, cy);
        if (p) { if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); }
        else on = false;
      }
      ctx.stroke();
    }
    // Equator (brighter)
    ctx.strokeStyle = isNight ? 'rgba(56,189,248,0.22)' : 'rgba(56,189,248,0.20)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let eqOn = false;
    for (let lon = -180; lon <= 180; lon += 3) {
      const p = proj(lon, 0, cLonRad, sinP0, cosP0, r, cx, cy);
      if (p) { if (!eqOn) { ctx.moveTo(p[0], p[1]); eqOn = true; } else ctx.lineTo(p[0], p[1]); }
      else eqOn = false;
    }
    ctx.stroke();

    // Continental shelf glow
    ctx.strokeStyle = pal.shelf;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    LANDS.forEach(land => {
      ctx.beginPath();
      let on = false;
      for (const pt of land.p) {
        const p = proj(pt[0], pt[1], cLonRad, sinP0, cosP0, r, cx, cy);
        if (p) { if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); }
        else on = false;
      }
      ctx.stroke();
    });

    // Landmasses with depth-based shading (sunlit hemisphere = lighter, limb = darker)
    LANDS.forEach(land => {
      const colors = pal[land.b] || pal.temperate;
      const pts = [];
      let visCount = 0, sumDepth = 0;
      for (const pt of land.p) {
        const p = proj(pt[0], pt[1], cLonRad, sinP0, cosP0, r, cx, cy);
        pts.push(p);
        if (p) { visCount++; sumDepth += p[2]; }
      }
      if (visCount < 2) return;

      ctx.beginPath();
      let on = false;
      for (const p of pts) {
        if (p) { if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); }
        else on = false;
      }
      ctx.closePath();

      // Depth-weighted brightness: front-face is brighter, edge-on is darker
      const avgDepth = sumDepth / visCount;
      if (!isNight) {
        // Lighten sunlit face, darken limb
        const bright = 0.7 + avgDepth * 0.3; // 0.7–1.0
        ctx.fillStyle = colors[0];
        ctx.globalAlpha = bright;
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = colors[0];
        ctx.fill();
      }
      ctx.strokeStyle = colors[1];
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // Night city lights
    if (isNight) {
      for (const [lon, lat, w] of CITY_LIGHTS) {
        const p = proj(lon, lat, cLonRad, sinP0, cosP0, r, cx, cy);
        if (!p) continue;
        const sz = Math.max(0.8, w * 0.6 * (0.4 + p[2] * 0.6));
        const alpha = 0.3 + w * 0.12;
        ctx.fillStyle = `rgba(255,200,80,${alpha.toFixed(2)})`;
        ctx.beginPath(); ctx.arc(p[0], p[1], sz, 0, Math.PI * 2); ctx.fill();
        if (w >= 4) {
          ctx.fillStyle = `rgba(255,180,50,${(alpha * 0.22).toFixed(2)})`;
          ctx.beginPath(); ctx.arc(p[0], p[1], sz * 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Specular sun glint (on static layer — doesn't change per-frame)
    if (!isNight) {
      const glX = cx - r * 0.35, glY = cy - r * 0.35;
      const glGrad = ctx.createRadialGradient(glX, glY, 0, glX, glY, r * 0.35);
      glGrad.addColorStop(0, 'rgba(255,255,255,0.42)');
      glGrad.addColorStop(0.25, 'rgba(255,255,255,0.18)');
      glGrad.addColorStop(0.6, 'rgba(186,230,253,0.06)');
      glGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glGrad;
      ctx.beginPath(); ctx.arc(glX, glY, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore(); // un-clip

    earthBufferRef.current = offCanvas;
    earthKeyRef.current = key;
    return offCanvas;
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC LAYER — drawn every frame on top of cached earth buffer
  // Only: stars bg, atmosphere, clouds, data pillars, bbox, reticle, rim, sun
  // ═══════════════════════════════════════════════════════════════════════════
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const r = radiusRef.current;
    const cLon = centerRef.current.lon;
    const cLat = centerRef.current.lat;
    const tick = tickRef.current;
    const isNight = globeTheme === 'night';
    const cLonRad = cLon * D2R;
    const sinP0 = Math.sin(cLat * D2R);
    const cosP0 = Math.cos(cLat * D2R);

    // ── 1. Cosmos Background (static star positions, animate alpha only) ──
    ctx.fillStyle = '#050709';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const sx = Math.abs(((Math.sin(i * 127.1) * 43758.5453) % 1) * w);
      const sy = Math.abs(((Math.cos(i * 311.7) * 43758.5453) % 1) * h);
      const mag = (i % 5 === 0) ? 1.6 : (i % 3 === 0 ? 1.1 : 0.65);
      const twinkle = 0.35 + ((Math.sin(tick * 0.018 + i * 1.7) + 1) * 0.5) * 0.5;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = i % 5 < 2 ? '#b4d2ff' : (i % 5 < 4 ? '#fffff0' : '#ffdcb4');
      ctx.fillRect(sx - mag * 0.5, sy - mag * 0.5, mag, mag); // fillRect faster than arc
      ctx.globalAlpha = 1;
    }

    // ── 2. Atmospheric Glow ───────────────────────────────────────────────
    const atmoR = r * 1.18;
    const atmoGrad = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, atmoR);
    if (!isNight) {
      atmoGrad.addColorStop(0, 'rgba(56,189,248,0.45)');
      atmoGrad.addColorStop(0.3, 'rgba(14,165,233,0.22)');
      atmoGrad.addColorStop(0.6, 'rgba(2,132,199,0.08)');
      atmoGrad.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      atmoGrad.addColorStop(0, 'rgba(99,102,241,0.38)');
      atmoGrad.addColorStop(0.4, 'rgba(129,140,248,0.14)');
      atmoGrad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    ctx.fillStyle = atmoGrad;
    ctx.beginPath(); ctx.arc(cx, cy, atmoR, 0, Math.PI * 2); ctx.fill();

    // ── 3. Blit Cached Earth Buffer ──────────────────────────────────────
    const earthBuf = renderEarthBuffer(w, h, cLon, cLat, r, globeTheme);
    if (earthBuf) ctx.drawImage(earthBuf, 0, 0);

    // ── 4. Dynamic Layers (clipped to sphere) ────────────────────────────
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();

    // Clouds
    if (showClouds) {
      const cs = cloudOffsetRef.current;
      const bands = [[-55,3,5,0.05],[-35,7,12,0.08],[-5,4,16,0.11],[15,5,9,0.07],[42,9,14,0.10],[65,2,7,0.05]];
      for (const [base, amp, wid, op] of bands) {
        ctx.beginPath();
        let on = false;
        for (let lon = -180; lon <= 180; lon += 6) {
          const lat = base + Math.sin((lon + cs) * 0.05) * amp + Math.cos((lon + cs * 0.7) * 0.08) * amp * 0.35;
          const p = proj(lon, lat, cLonRad, sinP0, cosP0, r * 1.01, cx, cy);
          if (p) { if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); }
          else on = false;
        }
        ctx.lineWidth = wid * (r / 225);
        ctx.strokeStyle = `rgba(255,255,255,${op})`;
        ctx.stroke();
      }
    }

    // Data pillars — depth-sorted, batched color sets
    const visGrid = [];
    for (let i = 0; i < grid.length; i++) {
      const cell = grid[i];
      const p = proj(cell.lon, cell.lat, cLonRad, sinP0, cosP0, r, cx, cy);
      if (p) visGrid.push({ cell, px: p[0], py: p[1], depth: p[2] });
    }
    visGrid.sort((a, b) => a.depth - b.depth); // painter's order

    for (const { cell, px, py, depth } of visGrid) {
      const slope = cell.slope ?? cell.temp_slope ?? 0;
      const isWarm = slope > 0;
      const isHH = cell.lisa_cluster === 'HH';
      const br = Math.max(1.5, 4 * depth);

      // Ground dot
      ctx.fillStyle = isHH ? 'rgba(245,158,11,0.7)' : isWarm ? 'rgba(239,68,68,0.6)' : 'rgba(6,182,212,0.6)';
      ctx.beginPath(); ctx.arc(px, py, br, 0, Math.PI * 2); ctx.fill();

      if (showPillars && depth > 0.15) {
        const pH = Math.min(36, Math.max(7, Math.abs(slope) * 48)) * depth;
        const topColor = isHH ? '#f59e0b' : isWarm ? '#fbbf24' : '#38bdf8';

        // Pillar stem (single strokeStyle, no gradient alloc for perf)
        ctx.strokeStyle = topColor;
        ctx.globalAlpha = 0.5 + depth * 0.4;
        ctx.lineWidth = Math.max(1.2, 2 * depth);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - pH); ctx.stroke();
        ctx.globalAlpha = 1;

        // Beacon head
        const bR = Math.max(1.5, 2.5 * depth);
        ctx.fillStyle = topColor;
        ctx.beginPath(); ctx.arc(px, py - pH, bR, 0, Math.PI * 2); ctx.fill();

        // Hotspot pulsing sonar
        if (isHH || cell.is_significant_fdr) {
          const pulse = (Math.sin(tick * 0.04) + 1) * 0.5;
          const hR = br * (2 + pulse);
          ctx.strokeStyle = `rgba(245,158,11,${(0.5 - pulse * 0.3).toFixed(2)})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(px, py, hR, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // BBox overlay
    if (showBBox && bbox && bbox.length === 4) {
      const [lonMin, latMin, lonMax, latMax] = bbox;
      ctx.strokeStyle = 'rgba(56,189,248,0.65)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 3]);
      const edge = (la, lo, lb, lob, n = 16) => {
        ctx.beginPath(); let on = false;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const p = proj(la + (lb - la) * t, lo + (lob - lo) * t, cLonRad, sinP0, cosP0, r, cx, cy);
          if (p) { if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else ctx.lineTo(p[0], p[1]); } else on = false;
        }
        ctx.stroke();
      };
      edge(lonMin, latMin, lonMax, latMin);
      edge(lonMax, latMin, lonMax, latMax);
      edge(lonMax, latMax, lonMin, latMax);
      edge(lonMin, latMax, lonMin, latMin);
      ctx.setLineDash([]);
    }

    // Selected cell reticle
    if (selectedCell) {
      const sp = proj(selectedCell.lon, selectedCell.lat, cLonRad, sinP0, cosP0, r, cx, cy);
      if (sp) {
        const rot = tick * 0.015;
        ctx.save(); ctx.translate(sp[0], sp[1]); ctx.rotate(rot);
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
        const sz = 13, brk = 4;
        for (const [dx, dy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
          ctx.beginPath();
          ctx.moveTo(dx * sz, dy * (sz - brk));
          ctx.lineTo(dx * sz, dy * sz);
          ctx.lineTo(dx * (sz - brk), dy * sz);
          ctx.stroke();
        }
        ctx.restore();
        // Center dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(sp[0], sp[1], 2, 0, Math.PI * 2); ctx.fill();
        // Pulse ring
        const pR = 16 + Math.sin(tick * 0.05) * 3;
        ctx.strokeStyle = `rgba(56,189,248,${(0.28 - Math.sin(tick * 0.05) * 0.12).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sp[0], sp[1], pR, 0, Math.PI * 2); ctx.stroke();
      }
    }

    ctx.restore(); // un-clip

    // ── 5. Outer Rim ─────────────────────────────────────────────────────
    ctx.strokeStyle = isNight ? 'rgba(99,102,241,0.20)' : 'rgba(56,189,248,0.20)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = isNight ? 'rgba(99,102,241,0.55)' : 'rgba(56,189,248,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

    // ── 6. Sun Indicator ─────────────────────────────────────────────────
    if (!isNight) {
      const sX = cx - r * 1.3, sY = cy - r * 1.3;
      const sg = ctx.createRadialGradient(sX, sY, 0, sX, sY, 14);
      sg.addColorStop(0, 'rgba(253,224,71,0.7)');
      sg.addColorStop(0.4, 'rgba(250,204,21,0.18)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sX, sY, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(253,224,71,0.85)';
      ctx.beginPath(); ctx.arc(sX, sY, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }, [renderEarthBuffer, grid, selectedCell, globeTheme, showPillars, showClouds, showBBox, bbox]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio > 1 ? 2 : 1);
      canvas.height = rect.height * (window.devicePixelRatio > 1 ? 2 : 1);
      renderFrame();
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [renderFrame]);

  // Animation loop with throttle
  useEffect(() => {
    let frameId;
    const loop = () => {
      cloudOffsetRef.current = (cloudOffsetRef.current + 0.12) % 360;
      tickRef.current += 1;

      if (!isDraggingRef.current) {
        if (autoRotate) {
          setCenter(prev => ({ ...prev, lon: (prev.lon + 0.3) % 360 }));
        } else {
          const vx = velocityRef.current.vx;
          const vy = velocityRef.current.vy;
          if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01) {
            setCenter(prev => ({
              lon: (prev.lon - vx) % 360,
              lat: Math.max(-85, Math.min(85, prev.lat + vy))
            }));
            velocityRef.current.vx *= 0.93;
            velocityRef.current.vy *= 0.93;
          }
        }
      }
      renderFrame();
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [autoRotate, renderFrame]);

  // Mouse handlers
  const handleMouseDown = (e) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    velocityRef.current = { vx: 0, vy: 0 };
  };

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const sens = 0.42;
      velocityRef.current = { vx: dx * sens, vy: dy * sens };
      setCenter(prev => ({
        lon: (prev.lon - dx * sens) % 360,
        lat: Math.max(-85, Math.min(85, prev.lat + dy * sens))
      }));
    } else {
      // Hover check (throttled by rAF)
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const r = radiusRef.current;
      const c = centerRef.current;
      const cLonRad = c.lon * D2R;
      const sinP0 = Math.sin(c.lat * D2R);
      const cosP0 = Math.cos(c.lat * D2R);
      const cxC = canvas.width / 2, cyC = canvas.height / 2;

      let found = null;
      for (const cell of grid) {
        const p = proj(cell.lon, cell.lat, cLonRad, sinP0, cosP0, r, cxC, cyC);
        if (p && Math.hypot(p[0] - mx, p[1] - my) < 14) {
          found = { ...cell, screenX: p[0] / (canvas.width / rect.width), screenY: p[1] / (canvas.height / rect.height) };
          break;
        }
      }
      setHoveredCell(found);
    }
  }, [grid]);

  const handleMouseUp = () => { isDraggingRef.current = false; };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setRadius(prev => Math.max(130, Math.min(520, prev + (e.deltaY < 0 ? 18 : -18))));
  }, []);

  const handleClick = () => {
    if (hoveredCell) { playTactileClick(850); onSelectCell(hoveredCell.lat, hoveredCell.lon); }
  };

  const handleFocusRegion = () => {
    playTactileClick(700);
    setCenter(getInitialCenter());
    setRadius(230);
  };

  return (
    <div className="relative w-full h-full bg-[#050709] select-none overflow-hidden font-mono">
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

      {/* HUD */}
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

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button type="button" onClick={() => { playTactileClick(600); setAutoRotate(!autoRotate); }}
            className={`px-2.5 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all flex items-center gap-1.5 cursor-pointer ${autoRotate ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold' : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:text-white'}`}
            title="Toggle smooth planetary orbit"
          >{autoRotate ? '⏸ Pause Orbit' : '▶ Auto Orbit'}</button>

          <button type="button" onClick={handleFocusRegion}
            className="px-2 py-1 rounded text-[11px] bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all font-mono cursor-pointer"
            title="Focus on active analysis bounding box">🎯 Focus Area</button>

          <button type="button" onClick={() => { playTactileClick(500); setGlobeTheme(globeTheme === 'natural' ? 'night' : 'natural'); }}
            className="px-2 py-1 rounded text-[11px] bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all font-mono cursor-pointer"
            title="Switch Natural / Night Lights">{globeTheme === 'natural' ? '☀️ Natural' : '🌌 Night'}</button>

          <button type="button" onClick={() => { playTactileClick(500); setShowPillars(!showPillars); }}
            className={`px-2 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all cursor-pointer ${showPillars ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-bold' : 'bg-slate-900/80 text-slate-400 border-slate-700'}`}
            title="Toggle 3D Pillars">{showPillars ? '📊 3D Pillars' : '⚪ Flat Grid'}</button>

          <button type="button" onClick={() => { playTactileClick(500); setShowClouds(!showClouds); }}
            className={`px-2 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all cursor-pointer ${showClouds ? 'bg-sky-500/15 text-sky-300 border-sky-500/40' : 'bg-slate-900/80 text-slate-400 border-slate-700'}`}
            title="Toggle Clouds">☁️ Clouds</button>

          {bbox && bbox.length === 4 && (
            <button type="button" onClick={() => { playTactileClick(500); setShowBBox(!showBBox); }}
              className={`px-2 py-1 rounded text-[11px] border backdrop-blur-md font-mono transition-all cursor-pointer ${showBBox ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40' : 'bg-slate-900/80 text-slate-400 border-slate-700'}`}
              title="Toggle BBox">📐 BBox</button>
          )}
        </div>
      </div>

      {/* Return to 2D */}
      <div className="absolute top-3 right-3 z-20">
        <button type="button" onClick={() => { playTactileClick(700); onClose(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-xl transition-all cursor-pointer">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          <span>Return to 2D GIS Map</span>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-20 bg-slate-950/90 border border-slate-800 rounded p-2 text-[10px] text-slate-300 backdrop-blur-md font-mono flex items-center gap-3 shadow-xl">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" /><span>Warming</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" /><span>Hotspot</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm" /><span>Cooling</span></div>
      </div>

      {/* Hover Tooltip */}
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
