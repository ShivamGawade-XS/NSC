# Tellura — Brand Identity & Visual Guidelines

Official brand guidelines for **Tellura — Planetary Intelligence** (NASA Space Apps Challenge 2026).

---

## 1. Visual Identity Philosophy

Tellura pairs mathematical rigor with planetary observation aesthetics. The identity communicates:
1. **Planetary Scale**: Observation across 44 years of continuous NASA satellite and reanalysis data.
2. **Signal Detection**: Extracting genuine, statistically defensible trend signals out of high-entropy noise.
3. **Institutional Authority**: Precision typography, unembellished geometry, and scientific clarity.

---

## 2. Core Symbol: The Orbit Signal

The Tellura symbol consists of three integrated elements:
- **Planetary Orbit Ring**: A dual-arc circle divided along the signal trajectory.
  - **Upper Arc**: Atmosphere White (`#F8FAFC`) representing atmospheric observational layers.
  - **Lower Arc**: Signal Blue (`#2563EB`) representing the oceanic and terrestrial Earth surface.
- **Signal Vector**: An ascending diagonal vector (`-29.2°`) slicing through the focal center, representing upward statistical trend detection.
- **Orbital Node**: A satellite telemetry node positioned at the upper-right intersection of the ring and vector.

---

## 3. Official Color Palette

| Token | Hex | RGB | Application |
| :--- | :--- | :--- | :--- |
| **Deep Orbit** | `#0B1120` | `11, 17, 32` | Application canvas, terminal backgrounds, primary dark ground |
| **Signal Blue** | `#2563EB` | `37, 99, 235` | Active data vectors, signal highlights, interactive focus states |
| **Atmosphere White** | `#F8FAFC` | `248, 250, 252` | Primary brand wordmark, high-contrast headings, upper planetary arc |
| **Telemetry Slate** | `#64748B` | `100, 116, 139` | Subtitles, scientific metadata, gridlines, axis labels |
| **Orbital Border** | `#1E293B` | `30, 41, 59` | Bounding cards, divider rules, subtle structural geometry |

---

## 4. Typography

### Primary Wordmark
- **Glyph Style**: Custom architectural geometry
- **Glyphs**:
  - `T`: Flat horizontal lintel with centered vertical stem
  - `E`: Three isolated horizontal strata bars (`≡`)
  - `L / L`: Orthogonal base arms with generous tracking
  - `U`: Uniform radius trough
  - `R`: Clean loop and anchored diagonal leg
  - `A`: High-apex chevron (`⋀`) without crossbar

### Official Tagline
```
PLANETARY INTELLIGENCE
```
- **Typeface**: Montserrat / Space Grotesk / Inter
- **Tracking**: `0.25em` (Wide tracking)
- **Weight**: 400 (Regular)
- **Casing**: All Caps

---

## 5. Asset Directory

| Asset | Path | Format & Dimension |
| :--- | :--- | :--- |
| Master Symbol (Transparent) | `frontend-react/public/tellura_icon.png` | Native Alpha PNG (Direct from Master Board) |
| Master Hero Lockup | `frontend-react/public/tellura_hero_lockup.png` | 732×150 px PNG (Symbol + Custom Wordmark) |
| Vector Symbol | `frontend-react/public/favicon.svg` | Scalable Vector Graphic (Embedded Master Data) |
| Multi-res Favicon | `frontend-react/public/favicon.ico` | 16x16, 32x32, 48x48 Multi-res ICO |
| Small Browser Tab | `frontend-react/public/favicon-16x16.png` | 16×16 px PNG |
| Standard Browser Tab | `frontend-react/public/favicon-32x32.png` | 32×32 px PNG |
| iOS Web App | `frontend-react/public/apple-touch-icon.png` | 180×180 px PNG |
| PWA Launcher | `frontend-react/public/android-chrome-192x192.png` | 192×192 px PNG |
| PWA Splash | `frontend-react/public/android-chrome-512x512.png` | 512×512 px PNG |
| Open Graph Preview | `frontend-react/public/og-image.png` | 1200×630 px Social Media Card |

