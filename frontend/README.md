# Legacy Vanilla Frontend (Deprecated Prototype)

This directory contains the legacy vanilla HTML/JS prototype (`index.html`, `landing.html`, `style.css`, `app.js`).

### Active Production SPA
The active modern presentation layer is located in [`/frontend-react`](../frontend-react):
- **Framework**: React 19 + Vite 8
- **Styling**: Tailwind CSS v4 + Vanilla CSS design tokens
- **Cartography**: Leaflet 1.9.4 with Canvas hardware acceleration
- **State Management**: Zustand
- **Web Workers**: Dedicated client-side worker for Mann-Kendall, Theil-Sen, and FDR inference

The legacy mount fallback in `backend/app/main.py` has been decommissioned in favor of `frontend-react/dist`.
