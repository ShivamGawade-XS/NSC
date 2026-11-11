import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { usePageMetadata } from '../utils/usePageMetadata';
import { playTactileClick } from '../utils/audio';

export default function NotFoundPage() {
  usePageMetadata({
    title: '404: Route Not Found — Tellura',
    description: 'The requested scientific instrument route or resource does not exist in this Tellura deployment.',
    canonicalPath: '/404',
  });

  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] flex flex-col justify-between">
      <Header />
      <main className="pt-24 pb-16 px-4 sm:px-6 flex-1 flex items-center justify-center">
        <div className="max-w-lg w-full p-8 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/30 font-mono font-bold text-sm">
            404
          </div>
          <span className="eyebrow-label text-[var(--color-accent-blue)] block mb-2">SPATIAL INDEX • OUT OF BOUNDS</span>
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-[var(--color-text-main)] mb-3">
            Trajectory Not Found
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mb-6 leading-relaxed max-w-sm mx-auto">
            The requested resource or observation coordinate does not exist. Return to active scientific transects or initialize the workspace below.
          </p>

          {/* Suggested Quick Links */}
          <div className="mb-6 text-left p-3.5 rounded bg-[var(--color-bg-deep)] border border-[var(--color-border-subtle)] font-mono text-[11px] space-y-2">
            <span className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider block">Recommended Trajectories:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-sans">
              <Link
                to="/dashboard?dataset=nasa_power&var=T2M&start=2000&end=2023&fdr=true&lat=31&lon=-101.875"
                className="p-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-blue)] text-[var(--color-text-main)] transition-colors block"
              >
                <div className="font-semibold text-[11px]">Texas Thermal Basin</div>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono">+0.48 °C / decade</div>
              </Link>
              <Link
                to="/dashboard?dataset=merra2_reanalysis&compound=true&start=2000&end=2020&fdr=true"
                className="p-2 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] hover:border-[var(--color-accent-blue)] text-[var(--color-text-main)] transition-colors block"
              >
                <div className="font-semibold text-[11px]">Southwest Arid Transect</div>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono">CAI Aridification</div>
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              to="/dashboard"
              onClick={() => playTactileClick(800)}
              className="interface-btn-primary w-full sm:w-auto !text-xs !py-2.5 !px-5"
            >
              Launch Workspace
            </Link>
            <Link
              to="/"
              onClick={() => playTactileClick(500)}
              className="interface-btn-secondary w-full sm:w-auto !text-xs !py-2.5 !px-5"
            >
              Return to Overview
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
