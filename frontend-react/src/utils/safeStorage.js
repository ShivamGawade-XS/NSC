/**
 * Safe localStorage wrapper handling strict Safari Private Browsing,
 * hardened Firefox (dom.storage.enabled=false), QuotaExceededError,
 * and iframe permission restrictions without throwing unhandled exceptions.
 */
export const safeStorage = {
  getItem: (key, defaultValue = null) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
      const val = window.localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  setItem: (key, value) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  },
  removeItem: (key) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};
