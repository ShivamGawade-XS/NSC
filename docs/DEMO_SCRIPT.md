# EarthSift — Live Demonstration Script & 7-Slide Narrative

**Challenge:** NASA Space Apps 2026 — *Be An Earth System Trend Detective!*  
**Document:** `docs/DEMO_SCRIPT.md`  

---

## 1. Live Demonstration Narrative (3 Minutes)

This script tells one cohesive, compelling scientific story: detecting real, divergent Earth system changes with inspectable mathematical truth.

---

### Step 1: Open Application & Note Truthful Baseline (0:00 - 0:20)
- **Action:** Open `http://localhost:8000/`.
- **Narrative:**
  > "Welcome to EarthSift, an evidence-first trend discovery instrument built for the NASA Space Apps 2026 Challenge. Notice the banner at the top immediately: in offline demo mode, EarthSift honestly flags that it is running on a verified physical fixture, avoiding fake claims of live satellite streaming when disconnected."

---

### Step 2: Configure & Execute Trend Analysis (0:20 - 0:45)
- **Action:** Select NASA MERRA-2, Target Variable `2-Meter Air Temperature (T2M)`, Years `2000` to `2023`, ensure `Apply Benjamini-Hochberg FDR` is checked. Click **⚡ Run Trend Detection**.
- **Narrative:**
  > "We execute our vectorized trend engine across 24 consecutive years of atmospheric data. In under 200 milliseconds, EarthSift computes non-parametric Mann-Kendall statistics, Sen's robust slope rates, and Benjamini-Hochberg False Discovery Rate corrections across hundreds of spatial coordinates."

---

### Step 3: Inspect the Spatial Trend Field (0:45 - 1:10)
- **Action:** Examine the center map. Toggle `Highlight Significant Only`.
- **Narrative:**
  > "The map displays robust trend slopes in °C per decade. Red indicates warming; blue indicates cooling. Crucially, we do not paint every $p < 0.05$ point as proven: the stippled cyan rings show cells that survive multiple hypothesis testing under FDR $q \le 0.05$."

---

### Step 4: Click a Significant Warming Cell (1:10 - 1:35)
- **Action:** Click a coordinate in the northern warming sector (e.g. 45.0°N, -95.0°W).
- **Narrative:**
  > "Selecting a coordinate immediately updates the bottom time series and the right-hand Evidence Inspector. The amber trendline represents the Theil-Sen estimator—the median of all pairwise slopes—unaffected by isolated annual spikes. Kendall's rank correlation $\tau$ is calculated directly from the observations."

---

### Step 5: Audit the Structured Evidence Inspector (1:35 - 2:00)
- **Action:** Point to the 7 cards on the right panel.
- **Narrative:**
  > "Axiom 1 of EarthSift is Inspectable Truth. Every finding generates an immutable structured record: empirical observation, robust magnitude, statistical significance with p-value and q-value, 100% data coverage, the scientific method, and explicit scientific limitations reminding us that empirical trends do not prove physical causation without attribution modeling."

---

### Step 6: Trigger the Discovery Engine: "Find Something Interesting" (2:00 - 2:20)
- **Action:** Click the green **🎯 Find Something Interesting** button.
- **Narrative:**
  > "Rather than guessing where changes occur, the Discovery Engine scores every cell using a transparent composite formula balancing slope magnitude, statistical significance, coverage, and spatial cluster coherence. It automatically jumps our view to the highest-scoring candidate signal."

---

### Step 7: Trigger the Contrast Engine: Regional Divergence (2:20 - 2:40)
- **Action:** Click **Focus Contrasting Regions** in the divergence box.
- **Narrative:**
  > "NASA's challenge specifically asks us to investigate how variables can trend in opposite directions. The Contrast Engine pairs regions with simultaneous, statistically significant opposing trends—such as subpolar North Atlantic cooling anomalies contrasted with continental warming—enforcing strict caveats against implying unproven common causes."

---

### Step 8: Downstream AI Explanation (2:40 - 3:00)
- **Action:** Click **✨ Explain Finding with AI**.
- **Narrative:**
  > "Finally, our downstream AI explainer takes ONLY the verified evidence record as input. It never calculates or modifies numbers. If the AI service is offline, our deterministic template engine guarantees a zero-hallucination, perfectly structured scientific summary."

---

## 2. Seven-Slide Video Fallback Narrative

1. **Slide 1 — Title & Challenge:** EarthSift: Find the changes worth investigating. NASA Space Apps 2026.
2. **Slide 2 — The Scientific Trap:** False positives from multiple spatial testing and serial red noise autocorrelation.
3. **Slide 3 — The Engine:** Mann-Kendall + Hamed-Rao (1998) + Theil-Sen + Benjamini-Hochberg FDR.
4. **Slide 4 — Discovery Engine:** Transparent composite scoring to surface candidate signals worth investigating.
5. **Slide 5 — Contrast Engine:** Detecting regional divergence (warming vs cooling, wetting vs drying) over identical periods.
6. **Slide 6 — Inspectable Evidence & Downstream AI:** Zero-hallucination explainer downstream of mathematical truth.
7. **Slide 7 — Open Science & NASA Impact:** Built for NASA MERRA-2 and Earthdata CMR; fully reproducible, open source under MIT.
