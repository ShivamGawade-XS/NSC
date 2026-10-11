import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';

export default function Header() {
  const [utc, setUtc] = useState('');
  const navigate = useNavigate();

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
              <p className="text-[10px] text-text-muted tracking-widest uppercase font-mono">
                Earth System Trend Detective
              </p>
            </div>
          </Link>
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-white/10">
            <Link to="/" className="text-xs text-text-muted hover:text-text-main px-2.5 py-1 rounded transition-colors font-medium">
              Home
            </Link>
            <Link to="/dashboard" className="text-xs text-accent-cyan bg-accent-cyan/10 px-2.5 py-1 rounded border border-accent-cyan/20 font-medium">
              Mission Console
            </Link>
          </div>
        </div>

        {/* Center: Mission Badge */}
        <motion.div
          className="hidden md:flex items-center gap-3"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className="badge-live rounded-full px-3 py-1 text-[10px] font-semibold font-[var(--font-mono)] tracking-wide flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-sig animate-pulse-glow" />
            NASA SPACE APPS 2026
          </span>
        </motion.div>

        {/* Right: UTC Clock + Status */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-[var(--font-mono)] text-accent-cyan tracking-wider tabular-nums">
              {utc}
            </div>
            <div className="text-[9px] text-text-muted uppercase tracking-widest">
              Mission Clock
            </div>
          </div>
          <div className="w-px h-6 bg-border-subtle" />
          <div className="text-[10px] text-text-muted">
            <span className="text-accent-sig">●</span> API Online
          </div>
        </div>
      </div>
    </header>
  );
}
