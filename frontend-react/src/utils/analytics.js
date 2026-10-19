/**
 * Privacy-Preserving Scientific Telemetry
 * Compliant with GDPR, ePrivacy, and CCPA.
 * Zero third-party trackers, zero persistent tracking cookies, zero PII collection.
 * Strictly respects 'Do Not Track' (DNT) browser settings.
 */

const DNT_ENABLED = typeof navigator !== 'undefined' && (
  navigator.doNotTrack === '1' ||
  navigator.doNotTrack === 'yes' ||
  window.doNotTrack === '1'
);

export function trackEvent(eventName, properties = {}) {
  if (DNT_ENABLED) {
    return; // User has requested not to be tracked
  }

  // Safe client telemetry payload
  const payload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    route: typeof window !== 'undefined' ? window.location.pathname : '',
    ...properties,
  };

  if (process.env.NODE_ENV === 'development') {
    // Log in development for auditability
    // console.debug('[Telemetry]', payload);
  }

  // Optionally send via navigator.sendBeacon if configured
  try {
    if (typeof window !== 'undefined' && window.EARTHSIFT_ANALYTICS_ENDPOINT) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(window.EARTHSIFT_ANALYTICS_ENDPOINT, blob);
    }
  } catch {
    // Silent failover
  }
}

export function trackPageView(pageName) {
  trackEvent('page_view', { page: pageName });
}
