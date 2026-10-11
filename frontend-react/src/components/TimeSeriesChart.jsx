import { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import useStore from '../store/useStore';

Chart.register(...registerables);

export default function TimeSeriesChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const selectedCell = useStore((s) => s.selectedCell);
  const isAnomalyMode = useStore((s) => s.isAnomalyMode);

  // Create chart once
  useEffect(() => {
    if (chartRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Observations',
            data: [],
            backgroundColor: '#38bdf8',
            borderColor: '#38bdf8',
            pointRadius: 4,
            pointHoverRadius: 6,
            showLine: false,
            order: 2,
          },
          {
            label: "Sen's Robust Trendline",
            data: [],
            borderColor: '#f59e0b',
            borderWidth: 2.5,
            pointRadius: 0,
            fill: false,
            tension: 0,
            order: 1,
          },
          {
            label: 'Climatology Baseline (μ)',
            data: [],
            borderColor: '#64748b',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0,
            order: 5,
          },
          {
            label: 'ci_lower_hidden',
            data: [],
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            fill: false,
            order: 4,
          },
          {
            label: '95% CI (Gilbert 1987)',
            data: [],
            borderColor: 'rgba(245, 158, 11, 0.35)',
            borderWidth: 1,
            borderDash: [3, 3],
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
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
        animation: { duration: 250 },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              filter: (item) => item.text !== 'ci_lower_hidden',
              color: '#94a3b8',
              font: { size: 10, family: 'Inter' },
              boxWidth: 12,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(10, 15, 29, 0.92)',
            titleColor: '#00f0ff',
            bodyColor: '#f8fafc',
            borderColor: 'rgba(0, 240, 255, 0.3)',
            borderWidth: 1,
            padding: 8,
            titleFont: { family: 'Outfit', size: 11 },
            bodyFont: { family: 'JetBrains Mono', size: 10 },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 9, family: 'JetBrains Mono' } },
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 9, family: 'JetBrains Mono' } },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  // Update chart data when cell or anomaly mode changes
  useEffect(() => {
    if (!chartRef.current || !selectedCell) return;
    const chart = chartRef.current;
    const cell = selectedCell;
    const obs = cell.observations;
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
      chart.data.datasets[0].label = 'Anomalies (Δ)';
      chart.data.datasets[0].data = obs.map((v) => +(v - meanObs).toFixed(3));
      chart.data.datasets[1].label = "Sen's Trend (Anomaly Space)";
      chart.data.datasets[1].data = cell.fitted_values.map((v) => +(v - meanObs).toFixed(3));
      chart.data.datasets[2].label = 'Baseline Zero Reference';
      chart.data.datasets[2].data = cell.years.map(() => 0.0);
      chart.data.datasets[3].data = ciLower.map((v) => +(v - meanObs).toFixed(3));
      chart.data.datasets[4].data = ciUpper.map((v) => +(v - meanObs).toFixed(3));
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: `Anomaly [Δ ${cell.display_units || ''}]`,
          color: '#94a3b8',
          font: { size: 10, family: 'Inter' },
        };
      }
    } else {
      chart.data.datasets[0].label = 'Observations';
      chart.data.datasets[0].data = obs;
      chart.data.datasets[1].label = "Sen's Robust Trendline";
      chart.data.datasets[1].data = cell.fitted_values;
      chart.data.datasets[2].label = `Climatology Baseline (μ = ${meanObs.toFixed(2)})`;
      chart.data.datasets[2].data = cell.years.map(() => +meanObs.toFixed(2));
      chart.data.datasets[3].data = ciLower;
      chart.data.datasets[4].data = ciUpper;
      if (chart.options.scales.y) {
        chart.options.scales.y.title = {
          display: true,
          text: cell.display_units || '',
          color: '#94a3b8',
          font: { size: 10, family: 'Inter' },
        };
      }
    }
    chart.update();
  }, [selectedCell, isAnomalyMode]);

  return (
    <div className="w-full h-full" style={{ minHeight: '220px' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
