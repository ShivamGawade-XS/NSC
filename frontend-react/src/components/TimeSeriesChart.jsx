import { useState, useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import { sonifyTimeSeries, stopSonification } from '../utils/sonification';
import { playTactileClick } from '../utils/audio';

Chart.register(...registerables);

// Pettitt (1979) Abrupt Regime Shift Demarcation Plugin
const changepointPlugin = {
  id: 'changepointPlugin',
  afterDraw: (chart) => {
    const cpYear = chart.options?.plugins?.changepoint?.year;
    const cpPVal = chart.options?.plugins?.changepoint?.pVal;
    if (!cpYear) return;

    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.x) return;

    // Chart.js category scale lookup
    let xPos = NaN;
    const labels = chart.data.labels || [];
    const idx = labels.findIndex((l) => Number(l) === Number(cpYear));
    if (idx !== -1) {
      xPos = scales.x.getPixelForValue(idx);
    } else {
      xPos = scales.x.getPixelForValue(String(cpYear));
    }
    if (xPos === undefined || isNaN(xPos) || xPos < chartArea.left || xPos > chartArea.right) return;

    ctx.save();
    // 1. Vertical demarcation line
    ctx.beginPath();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = '#ef4444';
    ctx.moveTo(xPos, chartArea.top);
    ctx.lineTo(xPos, chartArea.bottom);
    ctx.stroke();

    // 2. Regime Shift Marker Badge
    ctx.setLineDash([]);
    const pStr = cpPVal !== undefined && cpPVal !== null
      ? (typeof cpPVal === 'number' ? Number(cpPVal.toFixed(4)) : cpPVal)
      : '';
    const labelText = `Regime Shift: ${cpYear} (p=${pStr})`;
    ctx.font = 'bold 9px "IBM Plex Mono", monospace';
    const textWidth = ctx.measureText(labelText).width;

    const pillWidth = textWidth + 14;
    const pillHeight = 16;
    const pillX = Math.max(
      chartArea.left + 4,
      Math.min(xPos - pillWidth / 2, chartArea.right - pillWidth - 4)
    );
    const pillY = chartArea.top + 6;

    ctx.fillStyle = 'rgba(239, 68, 68, 0.92)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 3);
    } else {
      ctx.rect(pillX, pillY, pillWidth, pillHeight);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, pillX + 7, pillY + 8);
    ctx.restore();
  },
};

Chart.register(changepointPlugin);

function getStripeColor(z) {
  if (z <= -2.0) return '#08306b';
  if (z <= -1.5) return '#2171b5';
  if (z <= -1.0) return '#4292c6';
  if (z <= -0.5) return '#6baed6';
  if (z <= -0.1) return '#9ecae1';
  if (z < 0.1) return '#f1f5f9';
  if (z < 0.5) return '#fcae91';
  if (z < 1.0) return '#fb6a4a';
  if (z < 1.5) return '#de2d26';
  if (z < 2.0) return '#a50f15';
  return '#67000d';
}

export default function TimeSeriesChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const selectedCell = useStore((s) => s.selectedCell);
  const analysisId = useStore((s) => s.analysisId);
  const isAnomalyMode = useStore((s) => s.isAnomalyMode);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioTelemetry, setAudioTelemetry] = useState(null);
  const [chartView, setChartView] = useState('trend'); // 'trend' | 'stripes'
  const [ciConfidence, setCiConfidence] = useState(0.95); // 0.90 | 0.95 | 0.99

  useEffect(() => {
    return () => {
      stopSonification();
      setIsPlayingAudio(false);
      setAudioTelemetry(null);
    };
  }, [selectedCell?.lat, selectedCell?.lon, analysisId]);

  const toggleSonification = () => {
    if (isPlayingAudio) {
      stopSonification();
      setIsPlayingAudio(false);
      setAudioTelemetry(null);
      return;
    }

    let cell = selectedCell;
    if (!cell) {
      const firstSignal = useStore.getState().candidateSignals?.[0];
      const gridCell = useStore.getState().analysisData?.grid?.[0];
      const target = firstSignal || gridCell;
      if (target) {
        useStore.getState().selectCell(target.lat, target.lon);
        toast.success('Sonifying primary candidate coordinate');
        cell = target;
      } else {
        toast('Select a spatial cell on the map to sonify');
        return;
      }
    }

    const obs = cell?.observations || cell?.values || [];
    const yrs = cell?.years || [];
    if (!yrs.length || !obs.length) {
      toast('Observations data pending for this coordinate');
      return;
    }

    playTactileClick(700);
    setIsPlayingAudio(true);

    sonifyTimeSeries(
      yrs,
      obs,
      cell.slope || cell.temp_slope || 0,
      cell.changepoint_year,
      {
        onStep: (data) => setAudioTelemetry(data),
        onEnd: () => {
          setIsPlayingAudio(false);
          setAudioTelemetry(null);
        }
      }
    );
  };

  const exportHighResFigure = () => {
    if (!canvasRef.current || !selectedCell) {
      toast('Select a coordinate to export figure');
      return;
    }
    playTactileClick(800);
    const srcCanvas = canvasRef.current;
    const isDark = document.documentElement.classList.contains('dark');

    const dpr = 2;
    const padX = 32 * dpr;
    const padTop = 100 * dpr;
    const padBot = 90 * dpr;
    const outW = srcCanvas.width * dpr + padX * 2;
    const outH = srcCanvas.height * dpr + padTop + padBot;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d');

    // Background
    ctx.fillStyle = isDark ? '#0b0d11' : '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    // Frame border
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1 * dpr;
    ctx.strokeRect(10 * dpr, 10 * dpr, outW - 20 * dpr, outH - 20 * dpr);

    // Header Title
    ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
    ctx.font = `bold ${14 * dpr}px "Space Grotesk", sans-serif`;
    ctx.fillText('TELLURA PLANETARY OBSERVATIONAL TRANSECT', padX, 40 * dpr);

    // Header Subtitle
    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    ctx.font = `${9 * dpr}px "IBM Plex Sans", sans-serif`;
    const sub = `Variable: ${selectedCell.variable_id || 'T2M'} • Coordinate: [${selectedCell.lat?.toFixed(2)}°N, ${selectedCell.lon?.toFixed(2)}°E] • Baseline: ${selectedCell.years?.[0]}–${selectedCell.years?.[selectedCell.years.length - 1]}`;
    ctx.fillText(sub, padX, 62 * dpr);

    // Draw Chart Canvas
    ctx.drawImage(srcCanvas, padX, padTop, srcCanvas.width * dpr, srcCanvas.height * dpr);

    // Footer telemetry panel
    const botY = outH - 68 * dpr;
    ctx.fillStyle = isDark ? '#13171f' : '#f8fafc';
    ctx.fillRect(padX, botY, outW - padX * 2, 44 * dpr);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.strokeRect(padX, botY, outW - padX * 2, 44 * dpr);

    // Metrics text
    ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
    ctx.font = `bold ${8.5 * dpr}px "IBM Plex Mono", monospace`;
    const slopeStr = `Sen's Rate: ${selectedCell.slope >= 0 ? '+' : ''}${selectedCell.slope?.toFixed(4)} ${selectedCell.slope_units || '°C/dec'}`;
    const pStr = `p-value: ${selectedCell.p_value?.toFixed(4)} (${selectedCell.is_significant_fdr ? 'FDR Pass' : 'Raw'})`;
    const tauStr = `Kendall τ: ${selectedCell.tau?.toFixed(3)}`;
    const cpStr = selectedCell.changepoint_year ? `Regime Shift: ${selectedCell.changepoint_year}` : 'Stable Monotonic';
    ctx.fillText(`${slopeStr}   |   ${pStr}   |   ${tauStr}   |   ${cpStr}`, padX + 14 * dpr, botY + 18 * dpr);

    // Citation watermark
    ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    ctx.font = `${7.5 * dpr}px "IBM Plex Sans", sans-serif`;
    ctx.fillText('Data: NASA POWER / MERRA-2 (CF-1.8) • Tellura Non-Parametric Discovery Engine', padX + 14 * dpr, botY + 33 * dpr);

    // Download trigger
    outCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tellura_Figure_${selectedCell.variable_id || 'T2M'}_${selectedCell.lat?.toFixed(1)}N_${selectedCell.lon?.toFixed(1)}E.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('High-resolution publication figure exported');
    });
  };

  // Create chart once
  useEffect(() => {
    if (chartRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)';
    const tickColor = isDark ? '#9fa3af' : '#64748b';

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Observations',
            data: [],
            yAxisID: 'y',
            backgroundColor: '#0066ff',
            borderColor: '#0066ff',
            pointRadius: 3.5,
            pointHoverRadius: 5.5,
            showLine: false,
            order: 2,
          },
          {
            label: "Sen's Robust Trendline",
            data: [],
            yAxisID: 'y',
            borderColor: '#f59e0b',
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0,
            order: 1,
          },
          {
            label: 'Climatology Baseline (μ)',
            data: [],
            yAxisID: 'y',
            borderColor: '#636775',
            borderWidth: 1.25,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            tension: 0,
            order: 5,
          },
          {
            label: '95% CI (Gilbert 1987)',
            data: [],
            yAxisID: 'y',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            borderDash: [3, 3],
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            pointRadius: 0,
            fill: '+1',
            tension: 0,
            order: 3,
          },
          {
            label: 'ci_lower_hidden',
            data: [],
            yAxisID: 'y',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            borderDash: [3, 3],
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            tension: 0,
            order: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 200 },
        plugins: {
          changepoint: {
            year: null,
            pVal: null,
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              filter: (item) => !item.text?.startsWith('hidden') && item.text !== 'ci_lower_hidden',
              color: tickColor,
              font: { size: 10, family: 'IBM Plex Sans, sans-serif' },
              boxWidth: 10,
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 17, 21, 0.96)' : 'rgba(255, 255, 255, 0.96)',
            titleColor: isDark ? '#eceef2' : '#0f172a',
            bodyColor: isDark ? '#9399a6' : '#3f4654',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            titleFont: { family: 'Space Grotesk, IBM Plex Sans, sans-serif', size: 11, weight: 'bold' },
            bodyFont: { family: 'IBM Plex Mono, monospace', size: 10 },
            filter: (item) => !item.dataset?.label?.startsWith('hidden') && item.dataset?.label !== 'ci_lower_hidden',
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { size: 9, family: 'IBM Plex Mono, monospace' },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
          y: {
            position: 'left',
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 9, family: 'IBM Plex Mono, monospace' } },
          },
          y1: {
            position: 'right',
            display: false,
            grid: { drawOnChartArea: false },
            ticks: { color: '#06b6d4', font: { size: 9, family: 'IBM Plex Mono, monospace' } },
          },
        },
      },
    });

    const observer = new MutationObserver(() => {
      const darkNow = document.documentElement.classList.contains('dark');
      const gColor = darkNow ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)';
      const tColor = darkNow ? '#9fa3af' : '#64748b';
      if (chartRef.current) {
        chartRef.current.options.scales.x.grid.color = gColor;
        chartRef.current.options.scales.y.grid.color = gColor;
        chartRef.current.options.scales.x.ticks.color = tColor;
        chartRef.current.options.scales.y.ticks.color = tColor;
        chartRef.current.options.plugins.legend.labels.color = tColor;
        chartRef.current.update('none');
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  // Update chart data when cell or anomaly mode changes
  useEffect(() => {
    if (!chartRef.current || !selectedCell) return;
    const chart = chartRef.current;
    const cell = selectedCell;

    // Compound Hazard Mode (Dual-Axis Synchronized)
    if (cell.isCompound) {
      chart.options.scales.y1.display = true;
      chart.options.scales.y.title = {
        display: true,
        text: 'Temperature (°C)',
        color: '#ef4444',
        font: { size: 10, family: 'IBM Plex Sans, sans-serif' },
      };
      chart.options.scales.y1.title = {
        display: true,
        text: 'Precipitation (mm/day)',
        color: '#06b6d4',
        font: { size: 10, family: 'IBM Plex Sans, sans-serif' },
      };

      // Disable single-variable changepoint line in bivariate compound mode
      chart.options.plugins.changepoint = { year: null, pVal: null };

      chart.data.labels = cell.years;
      chart.data.datasets[0] = {
        label: 'Temp Obs (°C)',
        data: cell.observations,
        yAxisID: 'y',
        backgroundColor: '#ef4444',
        borderColor: '#ef4444',
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        showLine: false,
        order: 2,
      };
      chart.data.datasets[1] = {
        label: `Temp Trend (${cell.temp_slope > 0 ? '+' : ''}${cell.temp_slope?.toFixed(3)} °C/dec)`,
        data: cell.fitted_values,
        yAxisID: 'y',
        borderColor: '#f87171',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 1,
      };
      chart.data.datasets[2] = {
        label: 'Precip Obs (mm/d)',
        data: cell.precip_observations || [],
        yAxisID: 'y1',
        backgroundColor: '#06b6d4',
        borderColor: '#06b6d4',
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        showLine: false,
        order: 4,
      };
      chart.data.datasets[3] = {
        label: `Precip Trend (${cell.precip_slope > 0 ? '+' : ''}${cell.precip_slope?.toFixed(3)} mm/d/dec)`,
        data: cell.precip_fitted_values || [],
        yAxisID: 'y1',
        borderColor: '#38bdf8',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 3,
      };
      chart.data.datasets[4] = {
        label: 'ci_lower_hidden',
        data: [],
        yAxisID: 'y',
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
        order: 5,
      };
      chart.update();
      return;
    }

    // Standard Monovariate Mode (With Gilbert CI & Pettitt Demarcation)
    chart.options.scales.y1.display = false;

    // Check Pettitt changepoint
    const hasChangepoint =
      cell.changepoint_year &&
      cell.changepoint_p_value !== undefined &&
      cell.changepoint_p_value !== null &&
      Number(cell.changepoint_p_value) <= 0.05;
    chart.options.plugins.changepoint = {
      year: hasChangepoint ? cell.changepoint_year : null,
      pVal: hasChangepoint ? cell.changepoint_p_value : null,
    };

    const obs = cell.observations || [];
    const meanObs = obs.length > 0 ? obs.reduce((s, v) => s + v, 0) / obs.length : 0;

    // Compute Gilbert CI envelope anchored at median time step (t - t_mid)
    let ciLower = [];
    let ciUpper = [];
    const hasCI =
      cell.ci_lower !== undefined &&
      cell.ci_lower !== null &&
      cell.ci_upper !== undefined &&
      cell.ci_upper !== null &&
      cell.fitted_values?.length > 0 &&
      cell.years?.length > 0;

    if (hasCI) {
      const n = cell.years.length;
      const tMid = cell.years[0] + (cell.years[n - 1] - cell.years[0]) / 2.0;
      const zScale = ciConfidence === 0.90 ? 1.645 / 1.960 : ciConfidence === 0.99 ? 2.576 / 1.960 : 1.0;
      const slopeDeltaU = ((cell.ci_upper - (cell.slope || 0)) / 10.0) * zScale;
      const slopeDeltaL = ((cell.ci_lower - (cell.slope || 0)) / 10.0) * zScale;

      ciUpper = cell.fitted_values.map((fv, i) => {
        const dt = cell.years[i] - tMid;
        const b1 = fv + slopeDeltaU * dt;
        const b2 = fv + slopeDeltaL * dt;
        return +Math.max(b1, b2).toFixed(3);
      });

      ciLower = cell.fitted_values.map((fv, i) => {
        const dt = cell.years[i] - tMid;
        const b1 = fv + slopeDeltaU * dt;
        const b2 = fv + slopeDeltaL * dt;
        return +Math.min(b1, b2).toFixed(3);
      });
    } else {
      ciLower = cell.fitted_values || [];
      ciUpper = cell.fitted_values || [];
    }

    chart.data.labels = cell.years;

    if (chartView === 'stripes' && !cell.isCompound) {
      chart.options.scales.y.display = false;
      chart.options.plugins.legend.display = false;
      const varObs = obs.length > 0 ? obs.reduce((s, v) => s + (v - meanObs) ** 2, 0) / obs.length : 1.0;
      const stdObs = Math.sqrt(varObs) || 1.0;
      const stripeColors = obs.map((v) => {
        const z = (v - meanObs) / stdObs;
        return getStripeColor(z);
      });

      chart.data.datasets[0] = {
        type: 'bar',
        label: 'Warming Stripe',
        data: cell.years.map(() => 1.0),
        backgroundColor: stripeColors,
        borderColor: stripeColors,
        borderWidth: 0,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        order: 10,
      };
      chart.data.datasets[1] = { label: 'hidden1', data: [], showLine: false, pointRadius: 0 };
      chart.data.datasets[2] = { label: 'hidden2', data: [], showLine: false, pointRadius: 0 };
      chart.data.datasets[3] = { label: 'hidden3', data: [], showLine: false, pointRadius: 0 };
      chart.data.datasets[4] = { label: 'hidden4', data: [], showLine: false, pointRadius: 0 };
      chart.update();
      return;
    }

    chart.options.scales.y.display = true;
    chart.options.plugins.legend.display = true;

    if (isAnomalyMode) {
      chart.data.datasets[0] = {
        label: 'Anomalies (Δ)',
        data: obs.map((v) => +(v - meanObs).toFixed(3)),
        yAxisID: 'y',
        backgroundColor: '#0066ff',
        borderColor: '#0066ff',
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        showLine: false,
        order: 2,
      };
      chart.data.datasets[1] = {
        label: "Sen's Trend (Anomaly Space)",
        data: cell.fitted_values.map((v) => +(v - meanObs).toFixed(3)),
        yAxisID: 'y',
        borderColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 1,
      };
      chart.data.datasets[2] = {
        label: 'Baseline Zero Reference',
        data: cell.years.map(() => 0.0),
        yAxisID: 'y',
        borderColor: '#636775',
        borderWidth: 1.25,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 5,
      };
      chart.data.datasets[3] = {
        label: '95% CI (Gilbert 1987)',
        data: ciUpper.map((v) => +(v - meanObs).toFixed(3)),
        yAxisID: 'y',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        pointRadius: 0,
        fill: '+1',
        tension: 0,
        order: 3,
      };
      chart.data.datasets[4] = {
        label: 'ci_lower_hidden',
        data: ciLower.map((v) => +(v - meanObs).toFixed(3)),
        yAxisID: 'y',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 4,
      };
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: `Anomaly [Δ ${cell.display_units || ''}]`,
          color: '#9fa3af',
          font: { size: 10, family: 'IBM Plex Sans, sans-serif' },
        };
      }
    } else {
      chart.data.datasets[0] = {
        label: 'Observations',
        data: obs,
        yAxisID: 'y',
        backgroundColor: '#0066ff',
        borderColor: '#0066ff',
        pointRadius: 3.5,
        pointHoverRadius: 5.5,
        showLine: false,
        order: 2,
      };
      chart.data.datasets[1] = {
        label: "Sen's Robust Trendline",
        data: cell.fitted_values,
        yAxisID: 'y',
        borderColor: '#f59e0b',
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 1,
      };
      chart.data.datasets[2] = {
        label: `Climatology Baseline (μ = ${meanObs.toFixed(2)})`,
        data: cell.years.map(() => +meanObs.toFixed(2)),
        yAxisID: 'y',
        borderColor: '#636775',
        borderWidth: 1.25,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 5,
      };
      chart.data.datasets[3] = {
        label: '95% CI (Gilbert 1987)',
        data: ciUpper,
        yAxisID: 'y',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        pointRadius: 0,
        fill: '+1',
        tension: 0,
        order: 3,
      };
      chart.data.datasets[4] = {
        label: 'ci_lower_hidden',
        data: ciLower,
        yAxisID: 'y',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 4,
      };
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: cell.display_units || '',
          color: '#9fa3af',
          font: { size: 10, family: 'IBM Plex Sans, sans-serif' },
        };
      }
    }
    chart.update();
  }, [selectedCell, isAnomalyMode, chartView, ciConfidence]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ minHeight: '240px' }}>
      {/* Dynamic Scientific Indicator Ribbon */}
      {selectedCell?.isCompound ? (
        <div className="flex items-center justify-between px-2.5 py-1 mb-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/40 rounded text-[10px] font-mono text-amber-900 dark:text-amber-300">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            Dual-Axis Bivariate: Temperature (°C, Left) vs Precipitation (mm/day, Right)
          </span>
          <span className="text-[9px] text-[var(--color-text-secondary)]">CAI Aridification Index</span>
        </div>
      ) : selectedCell?.changepoint_year && selectedCell?.changepoint_p_value !== undefined && selectedCell?.changepoint_p_value !== null && Number(selectedCell?.changepoint_p_value) <= 0.05 ? (
        <div className="flex items-center justify-between px-3 py-1.5 mb-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-xs font-mono text-[var(--color-text-main)]">
          <span className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>Pettitt (1979) Regime Shift: Year <strong className="font-bold">{selectedCell.changepoint_year}</strong> (p = {Number(selectedCell.changepoint_p_value) < 0.001 ? '<0.001' : Number(selectedCell.changepoint_p_value).toFixed(4)})</span>
          </span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-normal uppercase tracking-wider">Abrupt Changepoint</span>
        </div>
      ) : null}

      {/* Acoustic Climate Sonification Toolbar */}
      <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-[var(--color-border-subtle)] text-[10px] font-mono">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSonification}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
              isPlayingAudio
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/40 shadow-xs'
                : 'bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] text-[var(--color-accent-blue)] border border-[var(--color-border-subtle)]'
            }`}
            title="Acoustic time series synthesis (Web Audio Section 508)"
          >
            {isPlayingAudio ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.414 0-.75-.336-.75-.75V9c0-.414.336-.75.75-.75h2.24z" />
                </svg>
                <span>Sonify Atmosphere</span>
              </>
            )}
          </button>

          {isPlayingAudio && audioTelemetry ? (
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-text-secondary)]">
              <span className="font-bold text-[var(--color-accent-blue)]">{audioTelemetry.year}</span>
              <span>•</span>
              <span>{audioTelemetry.freq} Hz</span>
              {audioTelemetry.isChangepoint && (
                <span className="px-1 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                  Regime Shift
                </span>
              )}
            </div>
          ) : (
            <span className="text-[9px] text-[var(--color-text-muted)] hidden sm:inline-block">
              Acoustic Pitch Mapping (Section 508)
            </span>
          )}
        </div>

        {isPlayingAudio && (
          <div className="flex items-center gap-0.5 h-2.5">
            {[40, 75, 55, 90, 60, 85, 45].map((h, i) => (
              <span
                key={i}
                className="w-0.5 rounded-full bg-[var(--color-accent-blue)] animate-pulse"
                style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        )}

        {/* Right Scientific Controls: Trendline vs Stripes, CI Level, Figure Export */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Chart View Toggle: Trendline vs Warming Stripes */}
          {!selectedCell?.isCompound && (
            <div className="flex items-center rounded bg-[var(--color-bg-surface)] p-0.5 border border-[var(--color-border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  playTactileClick(650);
                  setChartView('trend');
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all cursor-pointer ${
                  chartView === 'trend'
                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-main)] shadow-xs font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
                title="Continuous line chart with Sen's slope and Gilbert 95% CI"
              >
                Trendline
              </button>
              <button
                type="button"
                onClick={() => {
                  playTactileClick(650);
                  setChartView('stripes');
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                  chartView === 'stripes'
                    ? 'bg-[var(--color-bg-elevated)] text-rose-500 dark:text-rose-400 shadow-xs font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                }`}
                title="Ed Hawkins Climate Warming Stripes annual anomaly visualization"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                Stripes
              </button>
            </div>
          )}

          {/* CI Level Selector (Trendline mode only) */}
          {chartView === 'trend' && !selectedCell?.isCompound && (
            <div className="flex items-center rounded bg-[var(--color-bg-surface)] p-0.5 border border-[var(--color-border-subtle)]">
              {[0.90, 0.95, 0.99].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    playTactileClick(600);
                    setCiConfidence(lvl);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all cursor-pointer ${
                    ciConfidence === lvl
                      ? 'bg-[var(--color-bg-elevated)] text-amber-600 dark:text-amber-400 font-bold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                  }`}
                  title={`Gilbert (1987) ${Math.round(lvl * 100)}% Confidence Interval`}
                >
                  {Math.round(lvl * 100)}% CI
                </button>
              ))}
            </div>
          )}

          {/* High-Resolution Figure Export */}
          <button
            type="button"
            onClick={exportHighResFigure}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-main)] border border-[var(--color-border-subtle)] transition-all cursor-pointer font-medium"
            title="Export publication-ready figure with coordinates, Sen's slope, and NASA citation (PNG)"
          >
            <svg className="w-3 h-3 text-[var(--color-accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Figure</span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
