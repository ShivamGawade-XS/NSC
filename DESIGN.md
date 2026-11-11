---
name: Tellura
description: Autonomous spatiotemporal climate trend discovery instrument for NASA Earth-system observations.
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-subtle: "rgba(37, 99, 235, 0.12)"
  deep-orbit: "#0B1120"
  surface-dark: "#0E1014"
  card-dark: "#111318"
  atmosphere-white: "#F8FAFC"
  telemetry-slate: "#64748B"
  orbital-border: "#1E293B"
  accent-warming: "#EF4444"
  accent-cooling: "#06B6D4"
  accent-sig: "#10B981"
  accent-anomaly: "#F59E0B"
typography:
  display:
    fontFamily: "Space Grotesk, -apple-system, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Space Grotesk, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.atmosphere-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
---

# Design System: Tellura — Planetary Intelligence

## Overview

**Creative North Star: "The Observational Observatory"**

Tellura is structured as a mission-control instrument for high-dimensional planetary observations. Built for researchers, geoscientists, and the NASA Space Apps Challenge 2026, the interface prioritizes mathematical truth over decorative embellishment. The visual hierarchy emphasizes high information density, non-parametric certainty boundaries, and zero-distraction dark mode defaults.

The spatial philosophy is grounded in restraint: high-contrast telemetry lines, precise coordinate grids, and discrete data clusters. Motion is purposeful and restrained—serving exclusively to orient the researcher during temporal scrubbing, spatial subsetting, and statistical significance toggling.

**Key Characteristics:**
- **Observational Rigor**: Every data visualization carries confidence intervals, p-values, or False Discovery Rate (FDR) bounds.
- **Deep Space Ground**: Deep Orbit (`#0B1120`) canvas paired with Signal Blue (`#2563EB`) focal accents.
- **Dual-State Fidelity**: Dedicated adaptive assets guaranteeing equal contrast and legibility across both Dark and Light themes.
- **Sub-Second Responsiveness**: Native Web Workers and Canvas layers ensuring 60 FPS spatial rendering.

## Colors

The Tellura palette balances deep aerospace darkness with electric telemetry indicators.

### Primary
- **Signal Blue** (`#2563EB`): The primary action and focal signal color. Used for significant trend vectors, active map indicators, and confirmed statistical signals.

### Secondary
- **Atmosphere White** (`#F8FAFC`): Primary display typography, upper planetary limb arc, and high-priority scientific labels.
- **Telemetry Slate** (`#64748B`): Coordinates, uncertainty bounds, disabled states, and metadata footnotes.

### Status & Scientific Phenotypes
- **Warming Red** (`#EF4444`): Statistically significant positive trend slopes (e.g. surface air temperature increase).
- **Cooling Cyan** (`#06B6D4`): Statistically significant negative trend slopes.
- **Significance Green** (`#10B981`): Rejection of null hypothesis ($p < 0.05$, $q < 0.05$ under Benjamini-Hochberg).
- **Hazard Amber** (`#F59E0B`): Bivariate compound climate hazard extremes (copula joint exceedance).

### Named Rules
**The Rarity of Signal Rule.** Signal Blue and trend colors are reserved exclusively for data vectors and verified telemetry. No card background or decorative container may claim primary accent saturation.

## Typography

**Display Font:** Space Grotesk (fallback: system-ui, sans-serif)  
**Body Font:** Inter (fallback: system-ui, sans-serif)  
**Data/Mono Font:** JetBrains Mono (fallback: monospace)

**Character:** The pairing of Space Grotesk's architectural geometries with JetBrains Mono's unvarnished tabular clarity gives Tellura the authority of an official research laboratory monograph.

### Hierarchy
- **Display** (700, `3.75rem`, `1.12` line-height): Hero landing headline; maximum impact with balanced line length.
- **Headline** (700, `2.25rem`, `1.2` line-height): Section titles and primary module headers.
- **Title** (600, `1.25rem`, `1.3` line-height): Modal titles, inspector drawer headers, map layer titles.
- **Body** (400, `0.875rem`, `1.5` line-height): Scientific methodology prose, analytical dossiers, user documentation.
- **Label** (500, `0.6875rem`, `0.08em` tracking, uppercase): Coordinates, p-values, variable IDs, and telemetry badges.

### Named Rules
**The Tabular Data Doctrine.** All numerical data, timestamps, coordinates, and statistical metrics must render in monospace or with `font-variant-numeric: tabular-nums` to guarantee vertical decimal alignment across comparative tables.

## Layout

Tellura employs a continuous 12-column responsive grid with an adaptive maximum container width of `1920px` for ultra-wide scientific monitors:
- **Navigation Height**: Strict `h-14` (56px) fixed glassmorphism bar.
- **Spatial Map Canvas**: Full-bleed fluid container occupying the primary viewport with docked float inspector panels.
- **Rhythm**: Standard 8px spatial grid (`gap-2`, `gap-4`, `gap-6`, `gap-8`).

## Elevation & Depth

Surfaces rely on tonal layering and hairline borders rather than heavy blur or soft ambient shadows.
- **Surface Elevation**: Ground (`#08090B`) $\to$ Surface (`#0E1014`) $\to$ Card (`#111318`) $\to$ Floating Modal (`#15181F`).
- **Hairline Definition**: Borders are consistently `1px solid rgba(255, 255, 255, 0.08)` in dark mode and `rgba(15, 23, 42, 0.08)` in light mode.

### Named Rules
**The Tonal Stack Rule.** Depth is created by lightening container backgrounds by 3–5% per layer, never by applying zero-offset drop shadow halos.

## Shapes

- **Radius Strategy**: Strict geometric consistency: `rounded-md` (8px) for buttons, inputs, and chips; `rounded-xl` (16px) for modals and analytical floating cards; `rounded-full` for status badges.
- **Borders**: Subtle hairlines defining all data partitions without visual heaviness.

## Components

### Buttons
- **Shape**: `rounded-md` (8px)
- **Primary**: Background `{colors.primary}`, text `{colors.atmosphere-white}`, padding `8px 16px`. Smooth exponential hover deceleration.
- **Secondary / Ghost**: Hairline border with subtle background hover tint `rgba(255, 255, 255, 0.04)`.

### Cards & Panels
- **Shape**: `rounded-xl` (16px)
- **Background**: Tonal elevated surface with subtle backdrop blur.
- **Internal Padding**: `p-4 sm:p-6`.

### Inputs & Selectors
- **Shape**: `rounded-md` (8px), height `36px` or `40px`.
- **Focus**: Distinctive hairline ring in Signal Blue (`focus:ring-1 focus:ring-[#2563EB]`).

### Navigation
- **Style**: Fixed glassmorphism bar hosting the official Primary Horizontal Lockup (`tellura_primary_lockup_transparent.png` in dark, `tellura_primary_lockup_light.png` in light).

## Do's and Don'ts

### Do:
- **Do** format all scientific uncertainty bounds with symmetric or asymmetric brackets: `[+0.12, +0.34]`.
- **Do** use exponential easing (`ease-out`) for micro-interactions and modal entrances.
- **Do** provide clear keyboard focus outlines on every interactive button, tab, and slider.
- **Do** preserve the official Tellura Primary Horizontal Lockup image in headers and footers.

### Don't:
- **Don't** use cartoonish bounce or elastic easing (`animate-bounce`).
- **Don't** use decorative gradient text that compromises readability.
- **Don't** hardcode raw gray on colored surfaces; derive tints from the surface or foreground hue.
- **Don't** truncate p-values or confidence levels to arbitrary whole numbers.
