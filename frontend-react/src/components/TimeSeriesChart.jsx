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
    const xPos = scales.x.getPixelForValue(cpYear);
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
      ? (cpPVal < 0.001 ? '<0.001' : Number(cpPVal).toFixed(3))
      : '0.0X';
    const labelText = `Regime Shift: ${cpYear} (p=${pStr})`;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
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

export default function TimeSeriesChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const selectedCell = useStore((s) => s.selectedCell);
  const isAnomalyMode = useStore((s) => s.isAnomalyMode);

  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioTelemetry, setAudioTelemetry] = useState(null);

  useEffect(() => {
    return () => stopSonification();
  }, []);

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
            label: 'ci_lower_hidden',
            data: [],
            yAxisID: 'y',
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            order: 4,
          },
          {
            label: '95% CI (Gilbert 1987)',
            data: [],
            yAxisID: 'y',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            borderWidth: 1,
            borderDash: [3, 3],
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            pointRadius: 0,
            fill: '-1',
            tension: 0,
            order: 3,
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
              filter: (item) => item.text !== 'ci_lower_hidden',
              color: tickColor,
              font: { size: 10, family: 'Inter' },
              boxWidth: 10,
              padding: 10,
            },
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(14, 16, 20, 0.96)' : 'rgba(255, 255, 255, 0.96)',
            titleColor: isDark ? '#f3f2ee' : '#0f172a',
            bodyColor: isDark ? '#9fa3af' : '#475569',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 4,
            titleFont: { family: 'Space Grotesk', size: 11, weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono', size: 10 },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 9, family: 'JetBrains Mono' } },
          },
          y: {
            position: 'left',
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 9, family: 'JetBrains Mono' } },
          },
          y1: {
            position: 'right',
            display: false,
            grid: { drawOnChartArea: false },
            ticks: { color: '#06b6d4', font: { size: 9, family: 'JetBrains Mono' } },
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
        font: { size: 10, family: 'Inter' },
      };
      chart.options.scales.y1.title = {
        display: true,
        text: 'Precipitation (mm/day)',
        color: '#06b6d4',
        font: { size: 10, family: 'Inter' },
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
    const hasChangepoint = cell.changepoint_year && cell.changepoint_p_value !== undefined && cell.changepoint_p_value < 0.05;
    chart.options.plugins.changepoint = {
      year: hasChangepoint ? cell.changepoint_year : null,
      pVal: hasChangepoint ? cell.changepoint_p_value : null,
    };

    const obs = cell.observations || [];
    const meanObs = obs.length > 0 ? obs.reduce((s, v) => s + v, 0) / obs.length : 0;

    // Compute Gilbert CI envelope
    let ciLower = [];
    let ciUpper = [];
    if (cell.ci_lower !== undefined && cell.ci_upper !== undefined && cell.fitted_values?.length > 0) {
      const startY = cell.years[0];
      const slopeDeltaL = (cell.ci_lower - cell.slope) / 10.0;
      const slopeDeltaU = (cell.ci_upper - cell.slope) / 10.0;
      ciLower = cell.fitted_values.map((fv, i) => +(fv + slopeDeltaL * (cell.years[i] - startY)).toFixed(3));
      ciUpper = cell.fitted_values.map((fv, i) => +(fv + slopeDeltaU * (cell.years[i] - startY)).toFixed(3));
    } else {
      ciLower = cell.fitted_values || [];
      ciUpper = cell.fitted_values || [];
    }

    chart.data.labels = cell.years;

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
        label: 'ci_lower_hidden',
        data: ciLower.map((v) => +(v - meanObs).toFixed(3)),
        yAxisID: 'y',
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
        order: 4,
      };
      chart.data.datasets[4] = {
        label: '95% CI (Gilbert 1987)',
        data: ciUpper.map((v) => +(v - meanObs).toFixed(3)),
        yAxisID: 'y',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        pointRadius: 0,
        fill: '-1',
        tension: 0,
        order: 3,
      };
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: `Anomaly [Δ ${cell.display_units || ''}]`,
          color: '#9fa3af',
          font: { size: 10, family: 'Inter' },
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
        label: 'ci_lower_hidden',
        data: ciLower,
        yAxisID: 'y',
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
        order: 4,
      };
      chart.data.datasets[4] = {
        label: '95% CI (Gilbert 1987)',
        data: ciUpper,
        yAxisID: 'y',
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderWidth: 1,
        borderDash: [3, 3],
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        pointRadius: 0,
        fill: '-1',
        tension: 0,
        order: 3,
      };
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: cell.display_units || '',
          color: '#9fa3af',
          font: { size: 10, family: 'Inter' },
        };
      }
    }
    chart.update();
  }, [selectedCell, isAnomalyMode]);

  return (
    <div className="w-full h-full flex flex-col" style={{ minHeight: '220px' }}>
      {/* Dynamic Scientific Indicator Ribbon */}
      {selectedCell?.isCompound ? (
        <div className="flex items-center justify-between px-2 py-1 mb-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded text-[10px] font-mono text-[#f59e0b]">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
            Dual-Axis Bivariate: Temperature (°C, Left) vs Precipitation (mm/day, Right)
          </span>
          <span className="text-[9px] text-[var(--color-text-secondary)]">CAI Aridification Index</span>
        </div>
      ) : selectedCell?.changepoint_year && selectedCell?.changepoint_p_value < 0.05 ? (
        <div className="flex items-center justify-between px-2 py-1 mb-1 bg-red-950/20 border border-red-500/30 rounded text-[10px] font-mono text-red-400">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Pettitt (1979) Regime Shift: Year {selectedCell.changepoint_year} (p = {selectedCell.changepoint_p_value < 0.001 ? '<0.001' : selectedCell.changepoint_p_value.toFixed(4)})
          </span>
          <span className="text-[9px] text-[var(--color-text-secondary)]">Abrupt Changepoint</span>
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
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-xs'
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
                <span>Sonify Atmosphere 🎵</span>
              </>
            )}
          </button>

          {isPlayingAudio && audioTelemetry ? (
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-text-secondary)]">
              <span className="font-bold text-[var(--color-accent-blue)]">{audioTelemetry.year}</span>
              <span>•</span>
              <span>{audioTelemetry.freq} Hz</span>
              {audioTelemetry.isChangepoint && (
                <span className="px-1 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30 animate-pulse">
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
      </div>

      <div className="flex-1 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
