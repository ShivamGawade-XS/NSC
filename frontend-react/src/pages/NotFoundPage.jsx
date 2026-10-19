import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-deep)] text-[var(--color-text-main)] flex flex-col justify-between">
      <Header />
      <main className="pt-24 pb-16 px-4 sm:px-6 flex-1 flex items-center justify-center">
        <div className="max-w-md w-full p-8 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-center shadow-lg">
          <span className="eyebrow-label text-[var(--color-accent-blue)] block mb-2">404 • PAGE NOT FOUND</span>
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold text-[var(--color-text-main)] mb-3">
            Route Out of Bounds
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mb-6 leading-relaxed">
            The requested resource or scientific path does not exist in this EarthSift deployment.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              to="/"
              className="interface-btn-primary w-full sm:w-auto !text-xs !py-2"
            >
              Return to Overview
            </Link>
            <Link
              to="/dashboard"
              className="interface-btn-secondary w-full sm:w-auto !text-xs !py-2"
            >
              Launch Workspace
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
