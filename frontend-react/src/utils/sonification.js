/**
 * NASA EarthSift — Climate Sonification Engine
 * Maps multi-decadal atmospheric time series and non-parametric drift into
 * harmonic acoustic sweeps using high-precision Web Audio API synthesis.
 * Fully offline, Section 508 accessibility compliant, zero dependencies.
 */

import { isAudioMuted } from './audio';

let activeTimeouts = [];
let activeGainNodes = [];
let audioCtx = null;
let masterCompressor = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function getMasterCompressor(ctx) {
  if (!masterCompressor || masterCompressor.context !== ctx) {
    masterCompressor = ctx.createDynamicsCompressor();
    masterCompressor.threshold.setValueAtTime(-20, ctx.currentTime);
    masterCompressor.knee.setValueAtTime(25, ctx.currentTime);
    masterCompressor.ratio.setValueAtTime(8, ctx.currentTime);
    masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
    masterCompressor.release.setValueAtTime(0.15, ctx.currentTime);
    masterCompressor.connect(ctx.destination);
  }
  return masterCompressor;
}

// Scientific Pentatonic Tuning (C4 - C6) for pleasing harmonic exploration
const PENTATONIC_FREQS = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  1046.50 // C6
];

export function stopSonification() {
  activeTimeouts.forEach((id) => clearTimeout(id));
  activeTimeouts = [];

  const ctx = getAudioContext();
  if (ctx) {
    const now = ctx.currentTime;
    activeGainNodes.forEach((gain) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        setTimeout(() => {
          try {
            gain.disconnect();
          } catch {}
        }, 60);
      } catch {
        // Safe cleanup
      }
    });
  }
  activeGainNodes = [];
}

/**
 * Sonifies a multi-decadal time series across annual steps.
 * @param {Array<number>} years - Array of calendar years
 * @param {Array<number>} values - Annual observed anomalies or temperatures
 * @param {number} slope - Theil-Sen slope (deg/decade or units/decade)
 * @param {number} changepointYear - Pettitt regime shift year
 * @param {Object} callbacks - { onStep, onEnd }
 * @param {number} stepDurationMs - Playback duration per annual point (default 140ms)
 */
export function sonifyTimeSeries(
  years = [],
  values = [],
  slope = 0,
  changepointYear = null,
  callbacks = {},
  stepDurationMs = 140
) {
  stopSonification();

  if (isAudioMuted() || !years.length || !values.length) {
    callbacks.onEnd?.();
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    callbacks.onEnd?.();
    return;
  }

  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  if (!isFinite(minVal)) minVal = 0;
  if (!isFinite(maxVal)) maxVal = 1;
  const valRange = maxVal > minVal ? maxVal - minVal : 1;

  // Single Reusable Master Compressor to prevent distortion on rapid bursts
  const compressor = getMasterCompressor(ctx);

  years.forEach((yr, idx) => {
    const timeoutId = setTimeout(() => {
      try {
        const val = values[idx];
        const normalized = (val - minVal) / valRange; // 0.0 -> 1.0

        // Map normalized value to pentatonic scale index
        const noteIndex = Math.min(
          PENTATONIC_FREQS.length - 1,
          Math.max(0, Math.floor(normalized * PENTATONIC_FREQS.length))
        );
        const baseFreq = PENTATONIC_FREQS[noteIndex];

        // Microtonal pitch modulation proportional to normalized value within bin
        const freq = baseFreq * (1 + (normalized * 0.06 - 0.03));

        const now = ctx.currentTime;
        const dur = (stepDurationMs / 1000) * 0.95;

        // Primary Oscillator (Tone)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        activeGainNodes.push(gain);

        osc.onended = () => {
          try {
            osc.disconnect();
            filter.disconnect();
            gain.disconnect();
          } catch {}
        };

        // Warm timber for warming trends, crisp bell for cooling
        osc.type = slope >= 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Low-pass filter for smooth organic warmth
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(3000, freq * 3.5), now);

        // ADSR Envelope
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.09, now + dur * 0.15); // Attack
        gain.gain.exponentialRampToValueAtTime(0.04, now + dur * 0.5);  // Decay / Sustain
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);      // Release

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(compressor);

        osc.start(now);
        osc.stop(now + dur);

        // If this year matches the Pettitt Changepoint, play high resonant chime
        if (changepointYear && yr === changepointYear) {
          const chimeOsc = ctx.createOscillator();
          const chimeGain = ctx.createGain();
          activeGainNodes.push(chimeGain);

          chimeOsc.onended = () => {
            try {
              chimeOsc.disconnect();
              chimeGain.disconnect();
            } catch {}
          };

          chimeOsc.type = 'sine';
          chimeOsc.frequency.setValueAtTime(1318.51, now); // E6 chime
          chimeGain.gain.setValueAtTime(0.07, now);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + dur * 2.2);

          chimeOsc.connect(chimeGain);
          chimeGain.connect(compressor);

          chimeOsc.start(now);
          chimeOsc.stop(now + dur * 2.2);
        }

        // Notify UI of active year & spectrum
        callbacks.onStep?.({
          year: yr,
          value: val,
          freq: Math.round(freq),
          progress: (idx + 1) / years.length,
          isChangepoint: yr === changepointYear
        });

        // End of sequence
        if (idx === years.length - 1) {
          const finalId = setTimeout(() => {
            callbacks.onEnd?.();
            stopSonification();
          }, stepDurationMs + 100);
          activeTimeouts.push(finalId);
        }
      } catch {
        // Fallback gracefully
        if (idx === years.length - 1) callbacks.onEnd?.();
      }
    }, idx * stepDurationMs);

    activeTimeouts.push(timeoutId);
  });
}
