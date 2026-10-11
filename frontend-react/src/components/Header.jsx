import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function Header() {
  const [utc, setUtc] = useState('');

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#08080B]/90 backdrop-blur-xl border-b border-white/[0.08] px-6 py-3">
      <div className="flex items-center justify-between max-w-[1920px] mx-auto">
        {/* Left: Logo & Nav */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <span className="text-sm font-black text-bg-deep">ES</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-[var(--font-display)] tracking-tight text-text-main group-hover:text-accent-cyan transition-colors">
                  EarthSift
                </h1>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan font-mono border border-accent-cyan/20">v1.0</span>
              </div>
              <p className="text-[10px] text-zinc-400 tracking-wider uppercase font-mono">
                Earth System Spatiotemporal Explorer
              </p>
            </div>
          </Link>
          <div className="hidden lg:flex items-center gap-1.5 pl-4 border-l border-white/10">
            <Link to="/" className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded transition-colors font-medium">
              Overview
            </Link>
            <Link to="/dashboard" className="text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20 font-medium">
              Analysis Workspace
            </Link>
          </div>
        </div>

        {/* Center: Mission Controls & Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playTactileClick(800);
              useStore.getState().openCaseStudyTour();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 text-amber-300 text-xs font-medium font-mono transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
            </svg>
            <span>Curated Case Studies</span>
          </button>

          <button
            onClick={() => {
              playTactileClick(700);
              useStore.getState().setNlqModalOpen(true);
            }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/10 hover:border-blue-400/50 text-zinc-300 text-xs font-mono transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Query Palette</span>
            <kbd className="text-[10px] px-1 py-0.2 rounded bg-white/10 text-zinc-400 border border-white/10">Ctrl+K</kbd>
          </button>
        </div>

        {/* Right: UTC Clock + Status */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-[var(--font-mono)] text-accent-cyan tracking-wider tabular-nums">
              {utc}
            </div>
            <div className="text-[9px] text-text-muted uppercase tracking-widest">
              Mission Clock
            </div>
          </div>
          <div className="w-px h-6 bg-border-subtle hidden sm:block" />
          <div className="text-[10px] text-text-muted">
            <span className="text-accent-sig">●</span> JPL Synced
          </div>
        </div>
      </div>
    </header>
  );
}
