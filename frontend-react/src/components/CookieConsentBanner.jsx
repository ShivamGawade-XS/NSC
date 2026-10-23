import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { playTactileClick } from '../utils/audio';
import { safeStorage } from '../utils/safeStorage';

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = safeStorage.getItem('earthsift_consent');
    if (!consent) {
      // Delay slightly for smooth non-intrusive entrance
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    playTactileClick(600);
    safeStorage.setItem('earthsift_consent', 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    playTactileClick(500);
    safeStorage.setItem('earthsift_consent', 'essential_only');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie and Storage Preferences"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[8000] p-4 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-strong)] shadow-2xl backdrop-blur-md text-[var(--color-text-main)]"
    >
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded bg-[var(--color-accent-blue)]/10 text-[var(--color-accent-blue)] flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01" />
            <path d="M16 15.5v.01" />
            <path d="M12 12v.01" />
            <path d="M11 17v.01" />
            <path d="M7 13v.01" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-['Space_Grotesk'] text-xs font-bold mb-1 text-[var(--color-text-main)]">
            Privacy & Essential Storage
          </h4>
          <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mb-3">
            EarthSift stores local preferences (theme selection, recent coordinate bounds, and cached NASA query responses) in your browser. We never deploy third-party advertising cookies or tracking scripts. Learn more in our{' '}
            <Link to="/privacy" className="text-[var(--color-accent-blue)] underline hover:text-[var(--color-accent-blue-hover)]">
              Privacy Policy
            </Link>.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAccept}
              className="interface-btn-primary !py-1.5 !px-3 !text-xs font-medium"
            >
              Accept Preferences
            </button>
            <button
              onClick={handleDecline}
              className="interface-btn-secondary !py-1.5 !px-3 !text-xs font-medium"
            >
              Essential Only
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
