/**
 * NASA EarthSift — Climate Sonification Engine
 * Maps multi-decadal atmospheric time series and non-parametric drift into
 * harmonic acoustic sweeps using high-precision Web Audio API synthesis.
 * Fully offline, Section 508 accessibility compliant, zero dependencies.
 */

let activeTimeouts = [];
let activeGainNodes = [];
let audioCtx = null;

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

  if (!years.length || !values.length) {
    callbacks.onEnd?.();
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    callbacks.onEnd?.();
    return;
  }

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valRange = maxVal > minVal ? maxVal - minVal : 1;

  // Master Compressor to prevent distortion on rapid bursts
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-20, ctx.currentTime);
  compressor.knee.setValueAtTime(25, ctx.currentTime);
  compressor.ratio.setValueAtTime(8, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.15, ctx.currentTime);
  compressor.connect(ctx.destination);

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
        activeGainNodes.push(gain);

        // Warm timber for warming trends, crisp bell for cooling
        osc.type = slope >= 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Low-pass filter for smooth organic warmth
        const filter = ctx.createBiquadFilter();
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
          }, stepDurationMs);
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
