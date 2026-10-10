# EarthSift — Design System & Visual Specification

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/DESIGN_SYSTEM.md`  

---

## 1. Aesthetic Vision: Human-Designed Scientific Instrument
EarthSift is intentionally styled as a high-density, mission-critical scientific instrument rather than a generic startup marketing page or AI-generated demo.

### Banned Anti-Patterns:
- ❌ No AI-generated stock imagery or decorative astronauts.
- ❌ No generic gradient-heavy hero banners with one empty sentence.
- ❌ No fake NASA branding or decorative 3D Earth widgets.
- ❌ No neon cyberpunk / sci-fi glowing particle effects.
- ❌ No giant empty whitespace with cards floating in isolation.

### Enforced Patterns:
- ✅ Restrained, high-contrast dark theme optimized for multi-hour research.
- ✅ Dense-but-calm 4-panel split workstation layout:
  - **LEFT:** Investigation controls and discovery feeds.
  - **CENTER:** Geospatial trend field map.
  - **BOTTOM:** Observation time series and robust Sen trendline.
  - **RIGHT:** Structured evidence inspector.
- ✅ Clear, unambiguous labeling of synthetic demo data versus live observational streams.
- ✅ Distinct typography: Inter for readable UI labels; JetBrains Mono for coordinates, slopes, p-values, and test statistics.

---

## 2. Color Palette & Thematic Tokens

| Token | Hex / Value | Purpose |
|---|---|---|
| `--bg-deep` | `#070b14` | Application baseline background |
| `--bg-surface` | `#0e1626` | Panel containers and toolbars |
| `--bg-card` | `rgba(22, 35, 58, 0.7)` | Elevated metric cards and inspector fields |
| `--border-subtle` | `#1e2e4a` | Thin structural boundaries |
| `--text-main` | `#f1f5f9` | High-readability primary text |
| `--text-muted` | `#94a3b8` | Subtitles and coordinate descriptors |
| `--text-subtle` | `#64748b` | Field hints and minor metadata |
| `--accent-cyan` | `#38bdf8` | Significant observations and coordinate focus |
| `--accent-amber` | `#f59e0b` | Sen's robust fitted trendlines |
| `--accent-emerald` | `#10b981` | Discovery engine highlights and positive confirmations |
| `--accent-rose` | `#f43f5e` | Strong positive warming / drying anomalies |
| `--banner-synthetic` | `rgba(239, 68, 68, 0.12)` | Unmistakable demo mode warning background |

---

## 3. Diverging Cartographic Palette
For trend visualization:
- **Increasing Trends ($\beta > 0$):** Interpolates from dark neutral (`rgba(100, 116, 139, 0.4)`) to vivid crimson (`rgba(255, 60, 60, 0.85)`).
- **Decreasing Trends ($\beta < 0$):** Interpolates from dark neutral to vivid ocean blue (`rgba(30, 180, 240, 0.85)`).
- **Multiplicity Stippling:** FDR-significant cells ($q \le 0.05$) are highlighted with distinct cyan borders and larger radius ($r=9\text{px}$ vs $r=6\text{px}$).
