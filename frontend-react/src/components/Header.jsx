import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { playTactileClick } from '../utils/audio';
import { safeStorage } from '../utils/safeStorage';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const analysisData = useStore((s) => s.analysisData);
  const [utc, setUtc] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const savedTheme = safeStorage.getItem('earthsift_theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
  });

  // Synchronize document dark class whenever isDark changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    playTactileClick(600);
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      safeStorage.setItem('earthsift_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      safeStorage.setItem('earthsift_theme', 'light');
    }
  };

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setUtc(
        `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const isDashboard = location.pathname === '/dashboard';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-bg-deep)]/90 backdrop-blur-md border-b border-[var(--color-border-subtle)] transition-colors">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Brand & Primary Navigation */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0066ff] rounded py-1 px-1"
            aria-label="EarthSift Home"
          >
            <div className="w-7 h-7 rounded bg-[var(--color-accent-blue)] flex items-center justify-center text-white font-mono font-bold text-xs shadow-sm">
              ES
            </div>
            <div className="flex flex-col">
              <span className="font-['Space_Grotesk'] font-bold text-sm tracking-tight text-[var(--color-text-main)] group-hover:text-[var(--color-accent-blue)] transition-colors">
                EarthSift
              </span>
              <span className="text-[9px] font-mono tracking-wider text-[var(--color-text-muted)] hidden sm:inline-block">
                Atmospheric Trend Analysis
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-[var(--color-border-subtle)]" aria-label="Main Navigation">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                !isDashboard
                  ? 'text-[var(--color-text-main)] bg-[var(--color-bg-elevated)] font-semibold'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              Overview
            </Link>
            <Link
              to="/dashboard"
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isDashboard
                  ? 'text-white bg-[var(--color-accent-blue)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              Analysis Workspace
            </Link>
            <a
              href="https://github.com/ShivamGawade-XS/NSC"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)] transition-colors flex items-center gap-1"
            >
              <span>Repository</span>
              <span className="text-[10px] text-[var(--color-text-muted)]" aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>

        {/* Center/Right: Action Buttons, Theme Toggle, & Telemetry */}
        <div className="hidden lg:flex items-center gap-3">
          <button
            onClick={() => {
              playTactileClick(700);
              useStore.getState().setCustomDataModalOpen(true);
              if (!isDashboard) navigate('/dashboard');
            }}
            className="interface-btn-secondary !text-xs !py-1.5 !px-3 font-mono"
            aria-label="Ingest Custom GeoJSON Dataset"
          >
            <svg className="w-3.5 h-3.5 text-[var(--color-accent-blue)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Ingest Data</span>
          </button>

          <button
            onClick={() => {
              playTactileClick(800);
              useStore.getState().openCaseStudyTour();
              if (!isDashboard) navigate('/dashboard');
            }}
            className="interface-btn-secondary !text-xs !py-1.5 !px-3"
            aria-label="Open Curated Case Studies"
          >
            <svg className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            <span>Case Studies</span>
          </button>

          <button
            onClick={() => {
              playTactileClick(700);
              useStore.getState().setNlqModalOpen(true);
            }}
            className="interface-btn-secondary !text-xs !py-1.5 !px-2.5 font-mono"
            aria-label="Open Command Palette (Ctrl+K)"
          >
            <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Query Palette</span>
            <kbd className="ml-1 text-[9px] px-1 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">⌘K</kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] transition-colors"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Provenance Integrity Status */}
          {analysisData?.provenance && (
            <div className="hidden xl:flex items-center pl-3 border-l border-[var(--color-border-subtle)]">
              {analysisData.provenance.is_synthetic === true ? (
                <div
                  role="alert"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[11px] font-mono font-bold animate-pulse"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Synthetic test data — not NASA observations.</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Verified NASA CF-1.8 Observations</span>
                  {analysisData.provenance.doi && (
                    <a
                      href={`https://doi.org/${analysisData.provenance.doi.replace(/^https?:\/\/doi\.org\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 hover:text-emerald-100 underline decoration-emerald-500/50 text-[10px] ml-0.5"
                      title={`View dataset DOI: ${analysisData.provenance.doi}`}
                    >
                      DOI ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Observatory Clock */}
          <div className="pl-3 border-l border-[var(--color-border-subtle)] text-right">
            <div className="text-xs font-mono text-[var(--color-text-main)] tabular-nums font-medium">
              {utc || '00:00:00 UTC'}
            </div>
            <div className="text-[9px] font-mono tracking-wider uppercase text-[var(--color-text-muted)]">
              Universal Time
            </div>
          </div>
        </div>

        {/* Mobile Actions & Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          {/* Mobile Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
            aria-label="Toggle light or dark theme"
          >
            {isDark ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {!isDashboard && (
            <Link
              to="/dashboard"
              className="interface-btn-primary !text-xs !py-1.5 !px-3"
            >
              Workspace
            </Link>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)] transition-colors focus-visible:ring-1 focus-visible:ring-[#0066ff]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Collapse */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-4 py-4 space-y-3">
          <nav className="flex flex-col space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded text-sm font-medium ${
                !isDashboard ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-main)] font-semibold' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
            >
              Overview
            </Link>
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded text-sm font-medium ${
                isDashboard ? 'bg-[var(--color-accent-blue)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
            >
              Analysis Workspace
            </Link>
            <a
              href="https://github.com/ShivamGawade-XS/NSC"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] flex items-center justify-between"
            >
              <span>GitHub Repository</span>
              <span className="text-[var(--color-text-muted)]" aria-hidden="true">↗</span>
            </a>
          </nav>

          <div className="pt-3 border-t border-[var(--color-border-subtle)] flex flex-col gap-2">
            <button
              onClick={() => {
                playTactileClick(700);
                useStore.getState().setCustomDataModalOpen(true);
                if (!isDashboard) navigate('/dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full interface-btn-secondary !text-xs !py-2 justify-center font-mono"
            >
              Ingest Dataset (GeoJSON)
            </button>
            <button
              onClick={() => {
                playTactileClick(800);
                useStore.getState().openCaseStudyTour();
                if (!isDashboard) navigate('/dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full interface-btn-secondary !text-xs !py-2 justify-center"
            >
              Curated Case Studies
            </button>
            <button
              onClick={() => {
                playTactileClick(700);
                useStore.getState().setNlqModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full interface-btn-secondary !text-xs !py-2 justify-center font-mono"
            >
              Query Palette (Ctrl+K)
            </button>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
            <span>{utc}</span>
            {analysisData?.provenance?.is_synthetic === true ? (
              <span className="text-amber-400 font-bold">Synthetic test data — not NASA observations.</span>
            ) : analysisData?.provenance?.is_synthetic === false ? (
              <span className="text-emerald-400 font-semibold">Verified NASA CF-1.8 Observations</span>
            ) : (
              <span className="text-[11px] text-[var(--color-text-secondary)]">CF-1.8 Compliant</span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
