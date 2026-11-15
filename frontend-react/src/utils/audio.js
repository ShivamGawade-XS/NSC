/**
 * NASA JPL Mission Control Synthesized Audio Feedback
 * Creates subtle, micro-tactile acoustic confirmation using Web Audio API.
 * Never requires external audio files; 100% offline and low-latency.
 * Defaults to MUTED to ensure zero unsolicited audio across workstations.
 */

import { safeStorage } from './safeStorage';

let audioCtx = null;
let soundEnabled = false; // Muted by default
const stopCallbacks = new Set();

/**
 * Register a sub-system audio stopper (e.g. data sonification).
 */
export function registerAudioStopper(fn) {
  stopCallbacks.add(fn);
  return () => stopCallbacks.delete(fn);
}

/**
 * Stop all playing Web Audio nodes, sonifications, and suspend audio context.
 */
export function stopAllAudio() {
  stopCallbacks.forEach((fn) => {
    try {
      fn();
    } catch {}
  });

  if (audioCtx && audioCtx.state === 'running') {
    try {
      audioCtx.suspend().catch(() => {});
    } catch {}
  }
}

export function isAudioMuted() {
  if (typeof window === 'undefined') return true;

  const stored = safeStorage.getItem('Tellura_audio_muted');
  if (stored !== null) {
    return stored === 'true' || stored === '1';
  }

  // Audio defaults to MUTED unless explicitly enabled by user
  return !soundEnabled;
}

export function isAudioEnabled() {
  return !isAudioMuted();
}

export function toggleAudio() {
  const nextMuted = !isAudioMuted();
  soundEnabled = !nextMuted;
  safeStorage.setItem('Tellura_audio_muted', String(nextMuted));

  if (nextMuted) {
    stopAllAudio();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tellura-audio-toggle', { detail: { muted: nextMuted } })
    );
  }
  return !nextMuted;
}

export function setAudioMuted(muted) {
  soundEnabled = !muted;
  safeStorage.setItem('Tellura_audio_muted', String(muted));

  if (muted) {
    stopAllAudio();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tellura-audio-toggle', { detail: { muted: Boolean(muted) } })
    );
  }
}

function getAudioContext(forceResume = false) {
  if (typeof window === 'undefined') return null;
  if (!audioCtx && forceResume) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (forceResume && audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTactileClick(freq = 600, duration = 0.04) {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext(true);
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Audio optional; never throw in restricted environments
  }
}

export function playTelemetryChime() {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext(true);
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.03, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.15);
    });
  } catch {}
}

// Stop audio automatically when window is blurred or backgrounded
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAllAudio();
    }
  });
}
