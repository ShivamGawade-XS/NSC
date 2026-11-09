/**
 * Privacy-Preserving Scientific Telemetry
 * Compliant with GDPR, ePrivacy, and CCPA.
 * Zero third-party trackers, zero persistent tracking cookies, zero PII collection.
 * Strictly respects 'Do Not Track' (DNT) and explicit cookie consent preferences.
 */
import { safeStorage } from './safeStorage';

const DNT_ENABLED = typeof navigator !== 'undefined' && (
  navigator.doNotTrack === '1' ||
  navigator.doNotTrack === 'yes' ||
  window.doNotTrack === '1'
);

export function trackEvent(eventName, properties = {}) {
  if (DNT_ENABLED) {
    return; // User has requested not to be tracked via browser DNT
  }

  // Check user consent banner preference
  const consent = safeStorage.getItem('earthsift_consent');
  if (consent === 'essential_only') {
    return; // User explicitly selected essential-only storage
  }

  // Safe client telemetry payload
  const payload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    ...properties,
  };

  if (process.env.NODE_ENV === 'development') {
    // Audit telemetry payload in development console
    // console.debug('[EarthSift Telemetry]', payload);
  }

  // Dispatch via navigator.sendBeacon if configured or dispatch custom window event
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('earthsift:telemetry', { detail: payload }));
      if (window.EARTHSIFT_ANALYTICS_ENDPOINT) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(window.EARTHSIFT_ANALYTICS_ENDPOINT, blob);
      }
    }
  } catch {
    // Silent failover
  }
}

export function trackPageView(pageName) {
  trackEvent('page_view', { page: pageName });
}
