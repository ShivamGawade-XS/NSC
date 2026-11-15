import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { playTactileClick } from '../utils/audio';
import { safeStorage } from '../utils/safeStorage';
import ContactModal from './ContactModal';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const analysisData = useStore((s) => s.analysisData);
  const [utc, setUtc] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const savedTheme = safeStorage.getItem('tellura_theme');
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
      safeStorage.setItem('tellura_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      safeStorage.setItem('tellura_theme', 'light');
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

  const isWorkspace = ['/dashboard', '/investigate', '/policy'].includes(location.pathname);
  const isDashboard = isWorkspace;
  const workstationMode = useStore((s) => s.workstationMode);
  const backendOffline = useStore((s) => s.backendOffline);
  const setBackendOffline = useStore((s) => s.setBackendOffline);

  const handleSwitchTrack = (track) => {
    playTactileClick(600);
    useStore.getState().launchPersona(track);
    const targetUrl = track === 'detective' ? '/investigate' : track === 'policy' ? '/policy' : '/dashboard';
    if (location.pathname !== targetUrl) {
      navigate(targetUrl);
    }
  };

  useEffect(() => {
    let active = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/v1/ready', { cache: 'no-store' });
        if (active) setBackendOffline(!res.ok);
      } catch {
        if (active) setBackendOffline(true);
      }
    };
    checkHealth();
    const id = setInterval(checkHealth, 25000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [setBackendOffline]);

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-[var(--color-bg-deep)]/90 backdrop-blur-md border-b border-[var(--color-border-subtle)] transition-colors">
      {backendOffline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-500/90 text-amber-950 px-4 py-1 text-center font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-inner"
        >
          <span className="w-2 h-2 rounded-full bg-amber-900" />
          <span>Scientific Engine API Offline — Operating in cached / browser standalone mode. Real-time compute suspended.</span>
        </div>
      )}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Brand & Primary Navigation */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            to="/"
            className="flex items-center group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0066ff] rounded py-1 px-1"
            aria-label="Tellura Home"
          >
            <img
              src="/tellura_primary_lockup_transparent.png"
              alt="Tellura — Planetary Intelligence"
              className="h-8 sm:h-9 w-auto object-contain shrink-0 hidden dark:block"
              height="36"
            />
            <img
              src="/tellura_primary_lockup_light.png"
              alt="Tellura — Planetary Intelligence"
              className="h-8 sm:h-9 w-auto object-contain shrink-0 block dark:hidden"
              height="36"
            />
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
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                setContactOpen(true);
              }}
              className="px-3 py-1.5 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              Contact
            </button>
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
        <div className="hidden lg:flex items-center gap-2.5">
          {/* Persona Workstation Mode Selector */}
          {/* Evaluator Adaptive Track Switcher */}
          <div className="flex items-center p-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] font-mono text-[11px]" title="Evaluator Adaptive Persona Switcher">
            <button
              type="button"
              onClick={() => handleSwitchTrack('detective')}
              className={`px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer ${
                workstationMode === 'detective'
                  ? 'bg-[var(--color-accent-blue)] text-white font-semibold shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
              title="Student & Citizen Detective: Simplified clues, audio sonification, and guided hypothesis wizard"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              <span>Detective</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTrack('policy')}
              className={`px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer ${
                workstationMode === 'policy'
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
              title="City Planner & Policy: Compound hazards, joint Copula return periods, and climate velocity"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.5M4.5 21V10.5" />
              </svg>
              <span>Policy</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTrack('pro')}
              className={`px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer ${
                workstationMode === 'pro'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
              }`}
              title="Climate Scientist & NASA Judge: Full non-parametric rigor, LISA, FDR control, and NetCDF/LaTeX"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.943A4.5 4.5 0 0115.86 17H8.14a4.5 4.5 0 01-2.37-.657L4.2 15.3" />
              </svg>
              <span>Pro</span>
            </button>
          </div>

          <button
            onClick={() => {
              playTactileClick(750);
              useStore.getState().setDetectiveWizardModalOpen(true);
              if (!isDashboard) navigate('/dashboard');
            }}
            className="interface-btn-secondary !text-xs !py-1.5 !px-3 font-semibold text-[var(--color-accent-blue)] border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/5"
            aria-label="Open 3-Step Detective Wizard"
          >
            <svg className="w-3.5 h-3.5 text-[var(--color-accent-blue)] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
              <path d="M11 8v6" />
              <path d="M8 11h6" />
            </svg>
            <span>Detective Wizard</span>
          </button>

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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/30 text-slate-900 dark:text-slate-100 border border-amber-200 dark:border-amber-700/50 text-[11px] font-mono font-semibold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>Synthetic test data — not NASA observations.</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-main)] border border-[var(--color-border-subtle)] text-[11px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Verified NASA CF-1.8 Observations</span>
                  {analysisData.provenance.doi && (
                    <a
                      href={`https://doi.org/${analysisData.provenance.doi.replace(/^https?:\/\/doi\.org\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] underline decoration-slate-400/50 text-[10px] ml-0.5 font-bold"
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
            <div className="text-[9px] font-mono tracking-wider uppercase text-[var(--color-text-secondary)]">
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
            <button
              type="button"
              onClick={() => {
                playTactileClick(600);
                setContactOpen(true);
                setMobileMenuOpen(false);
              }}
              className="px-3 py-2 rounded text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)] text-left"
            >
              Contact Team
            </button>
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

          {/* Mobile Persona Switcher */}
          <div className="p-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] font-semibold px-1">
              Workstation Persona
            </div>
            <div className="grid grid-cols-3 gap-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  playTactileClick(600);
                  useStore.getState().setWorkstationMode('detective');
                }}
                className={`py-1.5 px-1 rounded text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  workstationMode === 'detective'
                    ? 'bg-[var(--color-accent-blue)] text-white font-semibold'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
                <span className="text-[10px]">Detective</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTactileClick(600);
                  useStore.getState().setWorkstationMode('policy');
                }}
                className={`py-1.5 px-1 rounded text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  workstationMode === 'policy'
                    ? 'bg-amber-600 text-white font-semibold'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.5M4.5 21V10.5" />
                </svg>
                <span className="text-[10px]">Policy</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playTactileClick(600);
                  useStore.getState().setWorkstationMode('pro');
                }}
                className={`py-1.5 px-1 rounded text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  workstationMode === 'pro'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)]'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.943A4.5 4.5 0 0115.86 17H8.14a4.5 4.5 0 01-2.37-.657L4.2 15.3" />
                </svg>
                <span className="text-[10px]">Pro</span>
              </button>
            </div>
          </div>

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
              <span className="text-amber-800 dark:text-amber-200 font-bold">Synthetic test data — not NASA observations.</span>
            ) : analysisData?.provenance?.is_synthetic === false ? (
              <span className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Verified NASA CF-1.8 Observations</span>
            ) : (
              <span className="text-[11px] text-[var(--color-text-secondary)]">CF-1.8 Compliant</span>
            )}
          </div>
        </div>
      )}
      <ContactModal isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </header>
  );
}
