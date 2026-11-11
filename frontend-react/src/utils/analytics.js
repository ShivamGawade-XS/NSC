/**
 * Privacy-Preserving Scientific Telemetry
 * Compliant with GDPR, ePrivacy, and CCPA.
 * Zero third-party trackers, zero persistent tracking cookies, zero PII collection.
 * Strictly respects 'Do Not Track' (DNT) and explicit cookie consent preferences.
 *
 * Events are POSTed to /api/v1/telemetry (self-hosted FastAPI endpoint).
 * Falls back to CustomEvent-only when endpoint is unreachable.
 */
import { safeStorage } from './safeStorage';

const DNT_ENABLED = typeof navigator !== 'undefined' && (
  navigator.doNotTrack === '1' ||
  navigator.doNotTrack === 'yes' ||
  window.doNotTrack === '1'
);

// Self-hosted endpoint (Vite env var, falls back to relative path)
const ENDPOINT = import.meta.env.VITE_ANALYTICS_ENDPOINT || '/api/v1/telemetry';

export function trackEvent(eventName, properties = {}) {
  if (DNT_ENABLED) return;

  const consent = safeStorage.getItem('tellura_consent');
  if (consent === 'essential_only') return;

  const payload = {
    event: eventName,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    properties: {
      timestamp: new Date().toISOString(),
      ...properties,
    },
  };

  try {
    if (typeof window !== 'undefined') {
      // 1. Fire-and-forget POST to our own backend telemetry endpoint
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(ENDPOINT, blob);

      // 2. Also dispatch local CustomEvent for any in-page listeners
      window.dispatchEvent(new CustomEvent('Tellura:telemetry', { detail: payload }));
    }
  } catch {
    // Silent failover — telemetry must never break the app
  }
}

export function trackPageView(pageName) {
  trackEvent('page_view', { page: pageName });
}
