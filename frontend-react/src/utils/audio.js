/**
 * NASA JPL Mission Control Synthesized Audio Feedback
 * Creates subtle, micro-tactile acoustic confirmation using Web Audio API.
 * Never requires external audio files; 100% offline and low-latency.
 */

import { safeStorage } from './safeStorage';

let audioCtx = null;
let soundEnabled = true;

export function isAudioMuted() {
  if (typeof window === 'undefined') return true;

  const stored = safeStorage.getItem('earthsift_audio_muted');
  if (stored !== null) {
    return stored === 'true' || stored === '1';
  }

  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
  } catch {}

  return !soundEnabled;
}

export function isAudioEnabled() {
  return !isAudioMuted();
}

export function toggleAudio() {
  const nextMuted = !isAudioMuted();
  soundEnabled = !nextMuted;
  safeStorage.setItem('earthsift_audio_muted', String(nextMuted));
  return !nextMuted;
}

export function setAudioMuted(muted) {
  soundEnabled = !muted;
  safeStorage.setItem('earthsift_audio_muted', String(muted));
}

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

export function playTactileClick(freq = 600, duration = 0.04) {
  if (isAudioMuted()) return;
  try {
    const ctx = getAudioContext();
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
    const ctx = getAudioContext();
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
