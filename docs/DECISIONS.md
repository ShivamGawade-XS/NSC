# EarthSift — Architecture Decision Records (ADR)

| ID | Decision | Rationale | Alternatives Considered | Status |
| :--- | :--- | :--- | :--- | :---: |
| **ADR-001** | Use Mann-Kendall + Sen's Slope over Ordinary Least Squares (OLS) | OLS is distorted by environmental outliers and non-normal residuals. Sen's slope provides a robust median-of-slopes estimator. | OLS linear regression, polynomial fitting | Accepted |
| **ADR-002** | Implement Benjamini-Hochberg (BH) False Discovery Rate | Multiple pixel hypothesis testing inflates false alarms; BH controls the expected proportion of false positives without being overly conservative like Bonferroni. | Bonferroni correction, no correction | Accepted |
| **ADR-003** | Decouple Data Adapter from Frontend | Prevents vendor lock-in to specific NASA endpoints and enables pluggable datasets (MERRA-2, MODIS, CERES). | Direct client-side NASA API fetching | Accepted |
| **ADR-004** | AI as Downstream Explainer, Not Calculator | AI models hallucinate numerical trend slopes. All calculations are strictly deterministic; LLMs only interpret the verified structured evidence record. | End-to-end LLM data analysis | Accepted |
| **ADR-005** | MapLibre GL JS for Map Visualization | Hardware-accelerated GPU rendering capable of displaying multi-thousand cell grids and vectors smoothly. | Leaflet, Google Maps API | Accepted |
